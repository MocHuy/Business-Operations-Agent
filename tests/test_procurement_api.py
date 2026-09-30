"""End-to-end HTTP tests for the Procurement API and its confirmation gate."""

from __future__ import annotations

import gc
import copy
import sqlite3
import tempfile
import unittest
import uuid
from pathlib import Path
from typing import Any
from unittest.mock import patch

from fastapi.testclient import TestClient

from backend_api import create_app
from procurement_store import _load_json


class ScriptedModel:
    """A deterministic LLM substitute; no Upstage key or network call is needed."""

    def __init__(self, decisions: list[dict[str, Any]]):
        self.decisions = list(decisions)
        self.calls: list[tuple[list[dict[str, Any]], list[dict[str, Any]]]] = []

    def __call__(self, messages: list[dict[str, Any]], tool_schemas: list[dict[str, Any]]) -> dict[str, Any]:
        self.calls.append((messages, tool_schemas))
        if not self.decisions:
            raise AssertionError("Agent đã gọi model nhiều lần hơn kịch bản cho phép")
        return self.decisions.pop(0)


def tool(name: str, arguments: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": "tool_call", "name": name, "arguments": arguments,
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    }


def proposal(product_ids: list[str] | None = None) -> dict[str, Any]:
    return {
        "type": "final", "kind": "proposal", "message": "Đề xuất mua màn hình 27 inch.",
        "product_ids": product_ids or ["MON-27-002"], "quantity": 2,
        "reason": "Trang bị cho nhân viên mới",
        "usage": {"prompt_tokens": 10, "completion_tokens": 5},
    }


def valid_procurement_model() -> ScriptedModel:
    return ScriptedModel([
        tool("get_user_profile", {}),
        tool("get_department_budget", {"department_id": "DEP001"}),
        tool("search_products", {
            "category": "monitor", "quantity": 2,
            "specifications": "27 inch", "max_total_price": 18_000_000,
        }),
        proposal(),
    ])


class ProcurementApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "procurement.sqlite3"
        self.model = valid_procurement_model()
        self.client = TestClient(create_app(db_path=self.db_path, model=self.model))

    def tearDown(self) -> None:
        self.client.close()
        del self.client
        gc.collect()
        self.temp_dir.cleanup()

    def auth(self, username: str) -> dict[str, str]:
        response = self.client.post("/api/auth/login", json={"username": username, "password": "123"})
        self.assertEqual(response.status_code, 200, response.text)
        return {"Authorization": f"Bearer {response.json()['token']}"}

    def create_draft(self, headers: dict[str, str], *, product_id: str = "MON-27-002", quantity: int = 2) -> dict[str, Any]:
        response = self.client.post("/api/procurement", headers={**headers, "Idempotency-Key": uuid.uuid4().hex}, json={
            "product_id": product_id, "quantity": quantity,
            "reason": "Trang bị cho nhân viên mới", "confirmed": True,
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["request"]

    def request_count(self) -> int:
        with sqlite3.connect(self.db_path) as db:
            return db.execute("SELECT count(*) FROM requests").fetchone()[0]

    def audit_rows(self) -> list[tuple[str, str, str | None]]:
        with sqlite3.connect(self.db_path) as db:
            return db.execute(
                "SELECT action, outcome, reason FROM audit_events ORDER BY id",
            ).fetchall()

    def test_manual_request_submit_approve_and_reject(self) -> None:
        employee = self.auth("nhanvien2")  # DEP001
        manager = self.auth("quanly1")  # DEP001
        first = self.create_draft(employee)
        self.assertEqual(first["status"], "DRAFT")
        self.assertEqual(first["requester_id"], "EMP001")
        self.assertEqual(first["total_price"], 6_400_000)

        submitted = self.client.post(
            f"/api/procurement/{first['id']}/submit", headers=employee, json={"confirmed": True},
        )
        self.assertEqual(submitted.status_code, 200, submitted.text)
        self.assertEqual(submitted.json()["request"]["status"], "PENDING_APPROVAL")
        inbox = self.client.get("/api/approvals", headers=manager)
        self.assertEqual(inbox.status_code, 200, inbox.text)
        self.assertIn(first["id"], {item["id"] for item in inbox.json()})

        approved = self.client.post(
            f"/api/procurement/{first['id']}/decision", headers=manager,
            json={"decision": "approve", "confirmed": True},
        )
        self.assertEqual(approved.status_code, 200, approved.text)
        self.assertEqual(approved.json()["request"]["status"], "APPROVED")

        second = self.create_draft(employee, product_id="KEY-001")
        self.client.post(f"/api/procurement/{second['id']}/submit", headers=employee, json={"confirmed": True})
        rejected = self.client.post(
            f"/api/procurement/{second['id']}/decision", headers=manager,
            json={"decision": "reject", "reason": "Thiết bị còn trong kho", "confirmed": True},
        )
        self.assertEqual(rejected.status_code, 200, rejected.text)
        self.assertEqual(rejected.json()["request"]["status"], "REJECTED")
        self.assertEqual(rejected.json()["request"]["rejection_reason"], "Thiết bị còn trong kho")
        self.assertEqual(
            [row[:2] for row in self.audit_rows()],
            [
                ("CREATE_REQUEST", "SUCCESS"), ("SUBMIT_REQUEST", "SUCCESS"),
                ("APPROVE_REQUEST", "SUCCESS"), ("CREATE_REQUEST", "SUCCESS"),
                ("SUBMIT_REQUEST", "SUCCESS"), ("REJECT_REQUEST", "SUCCESS"),
            ],
        )

    def test_auth_confirmation_budget_and_permissions_are_enforced_at_api(self) -> None:
        employee = self.auth("nhanvien2")
        manager = self.auth("quanly1")
        other_manager = self.auth("thaomkt")
        self.assertEqual(self.client.post("/api/procurement", json={
            "product_id": "KEY-001", "quantity": 1, "reason": "Thử", "confirmed": True,
        }).status_code, 401)
        self.assertEqual(self.client.post("/api/auth/login", json={
            "username": "nhanvien2", "password": "wrong",
        }).status_code, 401)

        unconfirmed = self.client.post("/api/procurement", headers=employee, json={
            "product_id": "KEY-001", "quantity": 1, "reason": "Thử", "confirmed": False,
        })
        self.assertGreaterEqual(unconfirmed.status_code, 400)
        self.assertEqual(self.request_count(), 0)

        over_budget = self.client.post("/api/procurement", headers={**employee, "Idempotency-Key": uuid.uuid4().hex}, json={
            "product_id": "LAP-15-001", "quantity": 1, "reason": "Thử", "confirmed": True,
        })
        self.assertEqual(over_budget.status_code, 400, over_budget.text)
        self.assertEqual(over_budget.json()["detail"]["code"], "BUDGET_EXCEEDED")

        request = self.create_draft(employee)
        missing_confirmation = self.client.post(
            f"/api/procurement/{request['id']}/submit", headers=employee,
            json={"confirmed": False},
        )
        self.assertGreaterEqual(missing_confirmation.status_code, 400)
        self.assertEqual(self.client.get(f"/api/procurement/{request['id']}", headers=employee).json()["status"], "DRAFT")
        self.client.post(f"/api/procurement/{request['id']}/submit", headers=employee, json={"confirmed": True})

        for headers in (employee, other_manager):
            with self.subTest(headers=headers):
                denied = self.client.post(
                    f"/api/procurement/{request['id']}/decision", headers=headers,
                    json={"decision": "approve", "confirmed": True},
                )
                self.assertEqual(denied.status_code, 403, denied.text)
                self.assertEqual(denied.json()["detail"]["code"], "FORBIDDEN")
        self.assertEqual(self.client.get(f"/api/procurement/{request['id']}", headers=employee).json()["status"], "PENDING_APPROVAL")
        self.assertEqual(self.client.get(f"/api/procurement/{request['id']}", headers=other_manager).status_code, 404)
        self.assertEqual(self.client.get("/api/approvals", headers=manager).status_code, 200)
        self.assertIn(("CREATE_REQUEST", "DENIED", "CONFIRMATION_REQUIRED"), self.audit_rows())
        self.assertIn(("CREATE_REQUEST", "DENIED", "BUDGET_EXCEEDED"), self.audit_rows())
        self.assertIn(("SUBMIT_REQUEST", "DENIED", "CONFIRMATION_REQUIRED"), self.audit_rows())
        self.assertIn(("APPROVE_REQUEST", "DENIED", "FORBIDDEN"), self.audit_rows())

    def test_agent_proposes_then_requires_explicit_confirmation(self) -> None:
        employee = self.auth("nhanvien2")
        response = self.client.post(
            "/api/agent/procurement", headers=employee,
            json={"message": "Tôi cần hai màn hình 27 inch cho nhân viên mới."},
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(body["kind"], "proposal")
        self.assertEqual(body["proposal"]["quantity"], 2)
        self.assertIn("MON-27-002", {item["product_id"] for item in body["proposal"]["products"]})
        self.assertEqual(self.request_count(), 0)
        self.assertEqual(len(self.model.calls), 4)

        session_id = body["session_id"]
        unconfirmed = self.client.post(
            f"/api/agent/procurement/{session_id}/confirm", headers=employee,
            json={"product_id": "MON-27-002", "confirmed": False},
        )
        self.assertGreaterEqual(unconfirmed.status_code, 400)
        self.assertEqual(self.request_count(), 0)
        invented = self.client.post(
            f"/api/agent/procurement/{session_id}/confirm", headers=employee,
            json={"product_id": "MON-27-001", "confirmed": True},
        )
        self.assertEqual(invented.status_code, 400, invented.text)
        self.assertEqual(self.request_count(), 0)

        confirmed = self.client.post(
            f"/api/agent/procurement/{session_id}/confirm", headers=employee,
            json={"product_id": "MON-27-002", "confirmed": True},
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        request = confirmed.json()["request"]
        self.assertEqual(request["status"], "PENDING_APPROVAL")
        self.assertEqual(request["total_price"], 6_400_000)
        self.assertEqual(self.request_count(), 1)
        replay = self.client.post(
            f"/api/agent/procurement/{session_id}/confirm", headers=employee,
            json={"product_id": "MON-27-002", "confirmed": True},
        )
        self.assertEqual(replay.status_code, 400, replay.text)
        self.assertEqual(self.request_count(), 1)
        self.assertIn(("CONFIRM_AGENT_PROPOSAL", "SUCCESS", None), self.audit_rows())
        self.assertIn(("CONFIRM_AGENT_PROPOSAL", "DENIED", "INVALID_CONFIRMATION"), self.audit_rows())

    def test_authenticated_identity_overrides_body_claims_and_blocks_self_approval(self) -> None:
        employee = self.auth("nhanvien2")
        forged = self.client.post("/api/procurement", headers={**employee, "Idempotency-Key": uuid.uuid4().hex}, json={
            "product_id": "KEY-001", "quantity": 1, "reason": "Bàn làm việc mới",
            "confirmed": True, "requester_id": "MGR001", "department_id": "DEP002", "status": "APPROVED",
        })
        self.assertEqual(forged.status_code, 200, forged.text)
        request = forged.json()["request"]
        self.assertEqual(request["requester_id"], "EMP001")
        self.assertEqual(request["department_id"], "DEP001")
        self.assertEqual(request["status"], "DRAFT")

        manager = self.auth("quanly1")
        own = self.create_draft(manager, product_id="KEY-001", quantity=1)
        self.client.post(f"/api/procurement/{own['id']}/submit", headers=manager, json={"confirmed": True})
        denied = self.client.post(
            f"/api/procurement/{own['id']}/decision", headers=manager,
            json={"decision": "approve", "confirmed": True},
        )
        self.assertEqual(denied.status_code, 403, denied.text)
        self.assertEqual(self.client.get(f"/api/procurement/{own['id']}", headers=manager).json()["status"], "PENDING_APPROVAL")

    def test_manual_create_retry_uses_one_request_and_conflicting_payload_is_rejected(self) -> None:
        employee = self.auth("nhanvien2")
        key = uuid.uuid4().hex
        headers = {**employee, "Idempotency-Key": key}
        body = {"product_id": "KEY-001", "quantity": 1, "reason": "Bàn làm việc mới", "confirmed": True}
        missing = self.client.post("/api/procurement", headers=employee, json=body)
        self.assertEqual(missing.status_code, 400)
        self.assertEqual(missing.json()["detail"]["code"], "IDEMPOTENCY_KEY_REQUIRED")

        first = self.client.post("/api/procurement", headers=headers, json=body)
        repeated = self.client.post("/api/procurement", headers=headers, json=body)
        self.assertEqual(first.status_code, 200, first.text)
        self.assertEqual(repeated.status_code, 200, repeated.text)
        self.assertEqual(repeated.json(), first.json())
        self.assertEqual(self.request_count(), 1)
        self.assertEqual(sum(row[:2] == ("CREATE_REQUEST", "SUCCESS") for row in self.audit_rows()), 1)

        conflict = self.client.post("/api/procurement", headers=headers, json={**body, "quantity": 2})
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["detail"]["code"], "IDEMPOTENCY_CONFLICT")
        self.assertEqual(self.request_count(), 1)

        self.client.post(f"/api/procurement/{first.json()['request']['id']}/submit", headers=employee, json={"confirmed": True})
        late_retry = self.client.post("/api/procurement", headers=headers, json=body)
        self.assertEqual(late_retry.json(), first.json())
        self.assertEqual(self.request_count(), 1)

    def test_agent_session_is_private_to_its_authenticated_employee(self) -> None:
        employee = self.auth("nhanvien2")
        other_employee = self.auth("nhanvien1")
        proposed = self.client.post(
            "/api/agent/procurement", headers=employee,
            json={"message": "Tôi cần hai màn hình 27 inch."},
        )
        self.assertEqual(proposed.status_code, 200, proposed.text)
        session_id = proposed.json()["session_id"]
        stolen = self.client.post(
            f"/api/agent/procurement/{session_id}/confirm", headers=other_employee,
            json={"product_id": "MON-27-002", "confirmed": True},
        )
        self.assertEqual(stolen.status_code, 404, stolen.text)
        self.assertEqual(stolen.json()["detail"]["code"], "SESSION_NOT_FOUND")
        self.assertEqual(self.request_count(), 0)

        confirmed = self.client.post(
            f"/api/agent/procurement/{session_id}/confirm", headers=employee,
            json={"product_id": "MON-27-002", "confirmed": True},
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        self.assertEqual(confirmed.json()["request"]["requester_id"], "EMP001")

    def test_server_policy_revokes_active_session_and_permissions(self) -> None:
        employee = self.auth("nhanvien2")
        users = copy.deepcopy(_load_json("users.json"))
        original_load = _load_json

        def changed_users(filename: str):
            return users if filename == "users.json" else original_load(filename)

        with patch("procurement_store._load_json", side_effect=changed_users):
            users["EMP001"]["account_status"] = "DISABLED"
            disabled = self.client.get("/api/procurement", headers=employee)
            self.assertEqual(disabled.status_code, 403)
            self.assertEqual(disabled.json()["detail"]["code"], "ACCOUNT_INACTIVE")
            self.assertEqual(self.client.post("/api/auth/login", json={
                "username": "nhanvien2", "password": "123",
            }).status_code, 403)

            users["EMP001"]["account_status"] = "ACTIVE"
            users["EMP001"]["permissions"] = ["SUBMIT_PROCUREMENT"]
            denied = self.client.post("/api/procurement", headers={**employee, "Idempotency-Key": uuid.uuid4().hex}, json={
                "product_id": "KEY-001", "quantity": 1, "reason": "Kiểm tra", "confirmed": True,
            })
            self.assertEqual(denied.status_code, 403)
            self.assertEqual(self.request_count(), 0)
            denied_agent = self.client.post("/api/agent/procurement", headers=employee, json={"message": "Mua bàn phím"})
            self.assertEqual(denied_agent.status_code, 403)

            users["EMP001"]["permissions"] = ["CREATE_PROCUREMENT", "SUBMIT_PROCUREMENT"]
            users["EMP001"]["scope_department_ids"] = ["DEP002"]
            scope_denied = self.client.post("/api/procurement", headers={**employee, "Idempotency-Key": uuid.uuid4().hex}, json={
                "product_id": "KEY-001", "quantity": 1, "reason": "Kiểm tra", "confirmed": True,
            })
            self.assertEqual(scope_denied.status_code, 403)
            self.assertEqual(self.request_count(), 0)
            self.assertEqual(self.client.post("/api/agent/procurement", headers=employee, json={
                "message": "Mua 2 màn hình cho nhóm",
            }).status_code, 403)

    def test_manager_approval_limit_and_permission_are_checked_on_server(self) -> None:
        employee = self.auth("nhanvien2")
        manager = self.auth("quanly1")
        request = self.create_draft(employee)
        self.client.post(f"/api/procurement/{request['id']}/submit", headers=employee, json={"confirmed": True})
        users = copy.deepcopy(_load_json("users.json"))
        original_load = _load_json

        def changed_users(filename: str):
            return users if filename == "users.json" else original_load(filename)

        with patch("procurement_store._load_json", side_effect=changed_users):
            users["MGR001"]["approval_limit"] = request["total_price"] - 1
            self.assertEqual(self.client.get("/api/approvals", headers=manager).json(), [])
            over_limit = self.client.post(f"/api/procurement/{request['id']}/decision", headers=manager, json={
                "decision": "approve", "confirmed": True,
            })
            self.assertEqual(over_limit.status_code, 403)
            self.assertEqual(over_limit.json()["detail"]["code"], "APPROVAL_LIMIT_EXCEEDED")
            users["MGR001"]["approval_limit"] = 50_000_000
            users["MGR001"]["permissions"].remove("APPROVE_PROCUREMENT")
            self.assertEqual(self.client.get("/api/approvals", headers=manager).status_code, 403)
            self.assertEqual(self.client.post(f"/api/procurement/{request['id']}/decision", headers=manager, json={
                "decision": "approve", "confirmed": True,
            }).status_code, 403)
            users["MGR001"]["permissions"].append("APPROVE_PROCUREMENT")
            users["MGR001"]["scope_department_ids"] = ["DEP002"]
            self.assertEqual(self.client.get("/api/approvals", headers=manager).json(), [])
            self.assertEqual(self.client.post(f"/api/procurement/{request['id']}/decision", headers=manager, json={
                "decision": "approve", "confirmed": True,
            }).status_code, 403)
            self.assertEqual(self.client.get(f"/api/procurement/{request['id']}", headers=employee).json()["status"], "PENDING_APPROVAL")

    def test_agent_confirmation_rejects_catalogue_price_changed_after_proposal(self) -> None:
        employee = self.auth("nhanvien2")
        proposed = self.client.post(
            "/api/agent/procurement", headers=employee,
            json={"message": "Tôi cần hai màn hình 27 inch."},
        )
        self.assertEqual(proposed.status_code, 200, proposed.text)
        body = proposed.json()
        self.assertEqual(body["kind"], "proposal")
        session_id = body["session_id"]
        displayed_price = next(
            item["unit_price"] for item in body["proposal"]["products"]
            if item["product_id"] == "MON-27-002"
        )
        store = self.client.app.state.store
        changed_catalogue = [
            {**item, "unit_price": displayed_price + 100_000}
            if item["product_id"] == "MON-27-002" else item
            for item in store.products()
        ]

        with patch.object(store, "products", return_value=changed_catalogue):
            confirmed = self.client.post(
                f"/api/agent/procurement/{session_id}/confirm", headers=employee,
                json={"product_id": "MON-27-002", "confirmed": True},
            )
        self.assertEqual(confirmed.status_code, 400, confirmed.text)
        self.assertEqual(confirmed.json()["detail"]["code"], "STALE_PROPOSAL")
        self.assertEqual(self.request_count(), 0)
        self.assertNotIn(("CONFIRM_AGENT_PROPOSAL", "SUCCESS", None), self.audit_rows())

    def test_english_model_prose_never_reaches_user_response_or_request_reason(self) -> None:
        employee = self.auth("nhanvien2")
        user_need = "Tôi cần hai màn hình 27 inch cho nhân viên mới."
        self.client.app.state.harness.model = ScriptedModel([
            tool("get_user_profile", {}),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", {
                "category": "monitor", "quantity": 2,
                "specifications": "27 inch", "max_total_price": 18_000_000,
            }),
            {**proposal(), "message": "I recommend buying these monitors now.",
             "reason": "English reason invented by the model"},
        ])
        proposed = self.client.post(
            "/api/agent/procurement", headers=employee, json={"message": user_need},
        )
        self.assertEqual(proposed.status_code, 200, proposed.text)
        body = proposed.json()
        self.assertEqual(body["kind"], "proposal")
        self.assertIn("Vui lòng kiểm tra", body["message"])
        self.assertNotIn("I recommend", body["message"])
        self.assertEqual(body["proposal"]["reason"], user_need)
        confirmed = self.client.post(
            f"/api/agent/procurement/{body['session_id']}/confirm", headers=employee,
            json={"product_id": "MON-27-002", "confirmed": True},
        )
        self.assertEqual(confirmed.status_code, 200, confirmed.text)
        self.assertEqual(confirmed.json()["request"]["reason"], user_need)

        self.client.app.state.harness.model = ScriptedModel([{
            "type": "final", "kind": "clarification",
            "message": "Please specify the quantity.",
            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
        }])
        clarification = self.client.post(
            "/api/agent/procurement", headers=employee,
            json={"message": "Tôi cần thêm màn hình."},
        )
        self.assertEqual(clarification.status_code, 200, clarification.text)
        self.assertEqual(clarification.json()["kind"], "clarification")
        self.assertIn("Vui lòng bổ sung", clarification.json()["message"])
        self.assertNotIn("Please specify", clarification.json()["message"])


if __name__ == "__main__":
    unittest.main()
