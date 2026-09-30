"""FastAPI entry point: uvicorn backend_api:app --reload.

Only the Procurement slice is backed by this API. The React prototype may keep
its other demonstration services while Procurement uses these authoritative routes.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

from fastapi import Depends, FastAPI, Header, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, StrictBool, StrictInt

from procurement_agent import AgentHarness
from procurement_store import BusinessError, ProcurementStore
from retrieval.policy_agent import PolicyRetrievalHarness
from retrieval.policy_index import PolicyIndex, RetrievalError


class LoginInput(BaseModel):
    username: str
    password: str


class CreateInput(BaseModel):
    product_id: str
    quantity: StrictInt
    reason: str = ""
    confirmed: StrictBool


class ConfirmInput(BaseModel):
    confirmed: StrictBool


class DecisionInput(BaseModel):
    decision: Literal["approve", "reject"]
    confirmed: StrictBool
    reason: str | None = None


class AgentInput(BaseModel):
    message: str
    session_id: str | None = None


class AgentConfirmInput(BaseModel):
    product_id: str
    confirmed: StrictBool


def create_app(
    db_path: str | Path | None = None, model: Any | None = None,
    agent_limits: dict[str, Any] | None = None,
    policy_index_path: str | Path | None = None,
    policy_embedder: Any | None = None,
) -> FastAPI:
    configured_path = db_path if db_path is not None else os.getenv("PROCUREMENT_DB_PATH")
    store = ProcurementStore(configured_path) if configured_path else ProcurementStore()
    harness = AgentHarness(store, model, **(agent_limits or {}))
    policy_harness = PolicyRetrievalHarness(
        PolicyIndex(Path(policy_index_path)) if policy_index_path else PolicyIndex(),
        policy_embedder,
    )
    application = FastAPI(title="API trợ lý mua sắm doanh nghiệp")
    application.state.store = store
    application.state.harness = harness
    application.state.policy_harness = policy_harness

    @application.exception_handler(BusinessError)
    async def business_error_handler(_request: Request, error: BusinessError) -> JSONResponse:
        return JSONResponse(status_code=error.status_code, content={"detail": {"code": error.code, "message": error.message}})

    @application.exception_handler(RetrievalError)
    async def retrieval_error_handler(_request: Request, error: RetrievalError) -> JSONResponse:
        return JSONResponse(status_code=503 if error.code in {"INDEX_EMPTY", "INDEX_STALE", "RETRIEVAL_UNAVAILABLE", "SOURCE_UNAVAILABLE"} else 422,
                            content={"detail": {"code": error.code, "message": str(error)}})

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(_request: Request, _error: RequestValidationError) -> JSONResponse:
        return JSONResponse(status_code=422, content={"detail": {"code": "INVALID_INPUT", "message": "Dữ liệu gửi lên không hợp lệ."}})

    def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        return store.authenticate(authorization)

    def require_confirmation(confirmed: bool) -> None:
        if confirmed is not True:
            raise BusinessError("CONFIRMATION_REQUIRED", "Vui lòng xác nhận trước khi thực hiện thao tác.")

    def require_idempotency_key(key: str | None) -> str:
        if key is None:
            raise BusinessError("IDEMPOTENCY_KEY_REQUIRED", "Cần mã chống gửi lặp để tạo yêu cầu.")
        return key

    def sensitive(user: dict[str, Any], action: str, target_id: str | None, operation: Any) -> dict[str, Any]:
        try:
            return operation()
        except BusinessError as error:
            store.audit(user["user_id"], action, target_id, "DENIED", error.code)
            raise

    @application.post("/api/auth/login")
    def login(body: LoginInput) -> dict[str, Any]:
        return store.login(body.username, body.password)

    @application.get("/api/auth/me")
    def me(user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return {"user": user}

    @application.post("/api/auth/logout")
    def logout(authorization: str | None = Header(default=None), user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        store.logout(authorization or "")
        store.audit(user["user_id"], "LOGOUT", None, "SUCCESS")
        return {"message": "Đã đăng xuất."}

    @application.get("/api/products")
    def products(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
        store.require_procurement(user)
        return store.products()

    @application.get("/api/procurement")
    def list_procurement(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
        return store.list_requests(user)

    @application.get("/api/procurement/{request_id}")
    def get_procurement(request_id: str, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return store.get_request(user, request_id)

    @application.post("/api/procurement")
    def create_procurement(
        body: CreateInput,
        user: dict[str, Any] = Depends(current_user),
        idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    ) -> dict[str, Any]:
        return {"request": sensitive(user, "CREATE_REQUEST", None, lambda: (
            require_confirmation(body.confirmed) or store.create_request(
                user, body.product_id, body.quantity, body.reason,
                require_idempotency_key(idempotency_key),
            )
        ))}

    @application.post("/api/procurement/{request_id}/submit")
    def submit_procurement(request_id: str, body: ConfirmInput, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return {"request": sensitive(user, "SUBMIT_REQUEST", request_id, lambda: (
            require_confirmation(body.confirmed) or store.submit_request(user, request_id)
        ))}

    @application.get("/api/approvals")
    def approvals(user: dict[str, Any] = Depends(current_user)) -> list[dict[str, Any]]:
        return store.list_approvals(user)

    @application.post("/api/procurement/{request_id}/decision")
    def decision(request_id: str, body: DecisionInput, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return {"request": sensitive(user, body.decision.upper() + "_REQUEST", request_id, lambda: (
            require_confirmation(body.confirmed) or store.decide(user, request_id, body.decision, body.reason)
        ))}

    @application.post("/api/agent/procurement")
    def agent_procurement(body: AgentInput, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return harness.run(user, body.message, body.session_id)

    @application.post("/api/agent/policy")
    def agent_policy(body: AgentInput, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        store.require_procurement(user)
        return policy_harness.answer(body.message)

    @application.post("/api/agent/procurement/{session_id}/confirm")
    def confirm_agent_procurement(session_id: str, body: AgentConfirmInput, user: dict[str, Any] = Depends(current_user)) -> dict[str, Any]:
        return {"request": sensitive(user, "CONFIRM_AGENT_PROPOSAL", session_id, lambda: (
            require_confirmation(body.confirmed) or store.confirm_agent_proposal(user, session_id, body.product_id)
        ))}

    return application


app = create_app()
