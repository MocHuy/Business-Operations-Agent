"""SQLite authority for demo Procurement data, sessions, checkpoints and audit.

The JSON catalogue and users remain the project seed data. All mutable business
state lives in SQLite, and every sensitive transition is checked in a transaction.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator


DATA_DIR = Path(__file__).resolve().parent / "data"
DEFAULT_DB = DATA_DIR / "procurement.sqlite3"
SESSION_SECONDS = 8 * 60 * 60
# Demo credentials mirror the React prototype. Replace this fixture for deployment.
DEMO_ACCOUNTS = {
    "nhanvien1": "EMP002",
    "nhanvien2": "EMP001",
    "quanly1": "MGR001",
    "thaomkt": "MGR_MKT_001",
    "hr1": "HR001",
    "admin1": "ADM001",
    "sysadmin1": "SYSADM001",
}
DEMO_PASSWORD = "123"
PROCUREMENT_ROLES = {"EMPLOYEE", "MANAGER"}


class BusinessError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load_json(filename: str) -> Any:
    with (DATA_DIR / filename).open(encoding="utf-8") as stream:
        return json.load(stream)


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class ProcurementStore:
    def __init__(self, db_path: str | Path = DEFAULT_DB):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @contextmanager
    def connection(self, write: bool = False) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.db_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            if write:
                connection.execute("BEGIN IMMEDIATE")
            yield connection
            if write:
                connection.commit()
        except Exception:
            if write:
                connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self.connection(write=True) as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
                    expires_at REAL NOT NULL
                );
                CREATE TABLE IF NOT EXISTS budgets (
                    department_id TEXT PRIMARY KEY,
                    total_budget INTEGER NOT NULL CHECK (total_budget >= 0),
                    spent_amount INTEGER NOT NULL CHECK (spent_amount >= 0 AND spent_amount <= total_budget)
                );
                CREATE TABLE IF NOT EXISTS requests (
                    sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                    id TEXT UNIQUE, product_id TEXT NOT NULL,
                    product_name TEXT NOT NULL, specifications TEXT NOT NULL,
                    category TEXT NOT NULL, quantity INTEGER NOT NULL CHECK (quantity > 0),
                    unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
                    total_price INTEGER NOT NULL CHECK (total_price >= 0),
                    requester_id TEXT NOT NULL, requester_name TEXT NOT NULL,
                    department_id TEXT NOT NULL, department_name TEXT NOT NULL,
                    reason TEXT NOT NULL,
                    status TEXT NOT NULL CHECK (status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
                    created_at TEXT NOT NULL, submitted_at TEXT,
                    approved_at TEXT, approved_by TEXT, rejected_at TEXT,
                    rejected_by TEXT, rejection_reason TEXT
                );
                CREATE TABLE IF NOT EXISTS request_idempotency (
                    actor_id TEXT NOT NULL,
                    idempotency_key TEXT NOT NULL,
                    payload_hash TEXT NOT NULL,
                    response_json TEXT NOT NULL,
                    request_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY (actor_id, idempotency_key),
                    UNIQUE (request_id)
                );
                CREATE TABLE IF NOT EXISTS agent_sessions (
                    id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
                    state_json TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS trace_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, trace_id TEXT NOT NULL,
                    session_id TEXT NOT NULL, event TEXT NOT NULL,
                    details_json TEXT NOT NULL, created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS audit_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT NOT NULL,
                    action TEXT NOT NULL, target_id TEXT, outcome TEXT NOT NULL,
                    reason TEXT, created_at TEXT NOT NULL
                );
                CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_events
                BEGIN SELECT RAISE(ABORT, 'audit_events cannot be changed'); END;
                CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_events
                BEGIN SELECT RAISE(ABORT, 'audit_events cannot be deleted'); END;
            """)
            for department_id, budget in _load_json("budgets.json").items():
                db.execute(
                    "INSERT OR IGNORE INTO budgets VALUES (?, ?, ?)",
                    (department_id, budget["total_budget"], budget["spent_amount"]),
                )

    def user(self, user_id: str) -> dict[str, Any]:
        users = _load_json("users.json")
        source = users.get(user_id)
        if source is None:
            raise BusinessError("USER_NOT_FOUND", "Không tìm thấy người dùng.", 401)
        departments = _load_json("departments.json")
        department_id = source["department_id"]
        username = next((name for name, uid in DEMO_ACCOUNTS.items() if uid == user_id), None)
        return {
            "user_id": user_id,
            "id": user_id,
            "name": source["name"],
            "role": source["role"],
            "system_role": source["role"],
            "department_id": department_id,
            "department_name": departments.get(department_id, {}).get("name", department_id),
            "username": username,
            "account_status": source["account_status"],
            "permissions": source["permissions"],
            "scope": {
                "department_ids": source["scope_department_ids"],
                "approval_limit": source["approval_limit"],
            },
        }

    def login(self, username: str, password: str) -> dict[str, Any]:
        user_id = DEMO_ACCOUNTS.get(username)
        if not user_id or not hmac.compare_digest(password, DEMO_PASSWORD):
            raise BusinessError("AUTH_FAILED", "Tên đăng nhập hoặc mật khẩu không đúng.", 401)
        user = self.user(user_id)
        self.require_active(user)
        token = secrets.token_urlsafe(32)
        with self.connection(write=True) as db:
            db.execute(
                "INSERT INTO sessions VALUES (?, ?, ?)",
                (_token_hash(token), user_id, time.time() + SESSION_SECONDS),
            )
        return {"token": token, "user": user}

    def authenticate(self, authorization: str | None) -> dict[str, Any]:
        if not authorization or not authorization.startswith("Bearer "):
            raise BusinessError("UNAUTHENTICATED", "Vui lòng đăng nhập.", 401)
        token = authorization[7:].strip()
        if not token:
            raise BusinessError("UNAUTHENTICATED", "Phiên đăng nhập không hợp lệ.", 401)
        with self.connection() as db:
            row = db.execute(
                "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?",
                (_token_hash(token),),
            ).fetchone()
        if row is None or row["expires_at"] <= time.time():
            raise BusinessError("UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn.", 401)
        user = self.user(row["user_id"])
        self.require_active(user)
        return user

    def logout(self, authorization: str) -> None:
        with self.connection(write=True) as db:
            db.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(authorization[7:].strip()),))

    def prune_operational_data(self, *, execute: bool = False, now: datetime | None = None) -> dict[str, int]:
        """Expire demo sessions and 30-day agent checkpoints/traces; retain audit and PRs."""
        instant = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
        cutoff = (instant - timedelta(days=30)).isoformat(timespec="seconds")
        with self.connection(write=execute) as db:
            filters = {
                "sessions": ("expires_at <= ?", instant.timestamp()),
                "agent_sessions": ("updated_at < ?", cutoff),
                "trace_events": ("created_at < ?", cutoff),
            }
            counts = {
                table: db.execute(f"SELECT count(*) FROM {table} WHERE {where}", (value,)).fetchone()[0]
                for table, (where, value) in filters.items()
            }
            if execute:
                for table, (where, value) in filters.items():
                    db.execute(f"DELETE FROM {table} WHERE {where}", (value,))
            return counts

    @staticmethod
    def require_active(user: dict[str, Any]) -> None:
        if user.get("account_status") != "ACTIVE":
            raise BusinessError("ACCOUNT_INACTIVE", "Tài khoản đã bị vô hiệu hóa.", 403)

    def require_permission(self, user: dict[str, Any], permission: str) -> None:
        self.require_active(user)
        if user["role"] not in PROCUREMENT_ROLES or permission not in user.get("permissions", []):
            raise BusinessError("FORBIDDEN", "Bạn không có quyền mua sắm.", 403)

    def require_procurement(self, user: dict[str, Any]) -> None:
        self.require_active(user)
        if user["role"] not in PROCUREMENT_ROLES or not any(
            permission in user.get("permissions", [])
            for permission in ("CREATE_PROCUREMENT", "SUBMIT_PROCUREMENT", "APPROVE_PROCUREMENT")
        ):
            raise BusinessError("FORBIDDEN", "Bạn không có quyền mua sắm.", 403)

    @staticmethod
    def _in_scope(user: dict[str, Any], department_id: str) -> bool:
        return department_id in user.get("scope", {}).get("department_ids", [])

    def products(self) -> list[dict[str, Any]]:
        return _load_json("products.json")

    def product(self, product_id: str) -> dict[str, Any]:
        product = next((item for item in self.products() if item["product_id"] == product_id), None)
        if product is None:
            raise BusinessError("PRODUCT_NOT_FOUND", "Sản phẩm không có trong danh mục đã duyệt.", 404)
        return product

    def budget(self, department_id: str) -> dict[str, Any]:
        with self.connection() as db:
            row = db.execute("SELECT * FROM budgets WHERE department_id = ?", (department_id,)).fetchone()
        if row is None:
            raise BusinessError("BUDGET_NOT_FOUND", "Phòng ban chưa có ngân sách mua sắm.", 400)
        return {
            "department_id": department_id,
            "total_budget": row["total_budget"],
            "spent_amount": row["spent_amount"],
            "available_amount": row["total_budget"] - row["spent_amount"],
        }

    @staticmethod
    def _quantity(value: Any) -> int:
        if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
            raise BusinessError("INVALID_QUANTITY", "Số lượng phải là số nguyên dương.")
        return value

    @staticmethod
    def _request(row: sqlite3.Row) -> dict[str, Any]:
        return {key: row[key] for key in row.keys() if key != "sequence"}

    def _insert_request(
        self, db: sqlite3.Connection, user: dict[str, Any], product_id: str,
        quantity: int, reason: str, status: str,
    ) -> dict[str, Any]:
        self.require_permission(user, "CREATE_PROCUREMENT")
        if not self._in_scope(user, user["department_id"]):
            raise BusinessError("FORBIDDEN", "Phòng ban nằm ngoài phạm vi quyền của bạn.", 403)
        quantity = self._quantity(quantity)
        product = self.product(product_id)
        budget = db.execute(
            "SELECT total_budget, spent_amount FROM budgets WHERE department_id = ?",
            (user["department_id"],),
        ).fetchone()
        if budget is None:
            raise BusinessError("BUDGET_NOT_FOUND", "Phòng ban chưa có ngân sách mua sắm.")
        total = product["unit_price"] * quantity
        if total > budget["total_budget"] - budget["spent_amount"]:
            raise BusinessError("BUDGET_EXCEEDED", "Giá trị mua sắm vượt ngân sách khả dụng.")
        timestamp = _now()
        submitted_at = timestamp if status == "PENDING_APPROVAL" else None
        cursor = db.execute("""
            INSERT INTO requests (
                product_id, product_name, specifications, category, quantity,
                unit_price, total_price, requester_id, requester_name,
                department_id, department_name, reason, status, created_at, submitted_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            product_id, product["name"], product["specifications"], product["category"],
            quantity, product["unit_price"], total, user["user_id"], user["name"],
            user["department_id"], user["department_name"],
            reason.strip() or "Yêu cầu trang thiết bị phục vụ công việc", status,
            timestamp, submitted_at,
        ))
        request_id = f"PR-{cursor.lastrowid:06d}"
        db.execute("UPDATE requests SET id = ? WHERE sequence = ?", (request_id, cursor.lastrowid))
        row = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        return self._request(row)

    @staticmethod
    def _audit_in_transaction(
        db: sqlite3.Connection, actor_id: str, action: str,
        target_id: str | None, outcome: str, reason: str | None = None,
    ) -> None:
        db.execute(
            "INSERT INTO audit_events (actor_id, action, target_id, outcome, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (actor_id, action, target_id, outcome, reason, _now()),
        )

    def create_request(
        self, user: dict[str, Any], product_id: str, quantity: int,
        reason: str, idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        self.require_permission(user, "CREATE_PROCUREMENT")
        payload_hash = None
        if idempotency_key is not None:
            if not isinstance(idempotency_key, str) or not re.fullmatch(r"[A-Za-z0-9._~-]{16,128}", idempotency_key):
                raise BusinessError("INVALID_IDEMPOTENCY_KEY", "Mã chống gửi lặp không hợp lệ.")
            payload_hash = hashlib.sha256(json.dumps({
                "product_id": product_id, "quantity": quantity, "reason": reason.strip(),
            }, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
        with self.connection(write=True) as db:
            if idempotency_key is not None:
                previous = db.execute(
                    "SELECT payload_hash, response_json FROM request_idempotency WHERE actor_id = ? AND idempotency_key = ?",
                    (user["user_id"], idempotency_key),
                ).fetchone()
                if previous is not None:
                    if previous["payload_hash"] != payload_hash:
                        raise BusinessError("IDEMPOTENCY_CONFLICT", "Mã gửi lại đã được dùng cho nội dung khác.", 409)
                    return json.loads(previous["response_json"])
            request = self._insert_request(db, user, product_id, quantity, reason, "DRAFT")
            if idempotency_key is not None:
                db.execute(
                    "INSERT INTO request_idempotency VALUES (?, ?, ?, ?, ?, ?)",
                    (user["user_id"], idempotency_key, payload_hash,
                     json.dumps(request, ensure_ascii=False), request["id"], _now()),
                )
            self._audit_in_transaction(db, user["user_id"], "CREATE_REQUEST", request["id"], "SUCCESS")
            return request

    def _visible(self, user: dict[str, Any], row: sqlite3.Row) -> bool:
        return row["requester_id"] == user["user_id"] or (
            user["role"] == "MANAGER"
            and "VIEW_DEPARTMENT_WORK" in user.get("permissions", [])
            and self._in_scope(user, row["department_id"])
        )

    def list_requests(self, user: dict[str, Any]) -> list[dict[str, Any]]:
        self.require_procurement(user)
        with self.connection() as db:
            rows = db.execute("SELECT * FROM requests ORDER BY sequence DESC").fetchall()
        return [self._request(row) for row in rows if self._visible(user, row)]

    def get_request(self, user: dict[str, Any], request_id: str) -> dict[str, Any]:
        self.require_procurement(user)
        with self.connection() as db:
            row = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
        if row is None or not self._visible(user, row):
            raise BusinessError("REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu mua sắm trong phạm vi quyền của bạn.", 404)
        return self._request(row)

    def submit_request(self, user: dict[str, Any], request_id: str) -> dict[str, Any]:
        self.require_permission(user, "SUBMIT_PROCUREMENT")
        with self.connection(write=True) as db:
            row = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
            if row is None:
                raise BusinessError("REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu mua sắm.", 404)
            if row["requester_id"] != user["user_id"]:
                raise BusinessError("FORBIDDEN", "Bạn chỉ được gửi yêu cầu do mình tạo.", 403)
            if not self._in_scope(user, row["department_id"]):
                raise BusinessError("FORBIDDEN", "Phòng ban nằm ngoài phạm vi quyền của bạn.", 403)
            if row["status"] != "DRAFT":
                raise BusinessError("INVALID_STATUS", "Chỉ có thể gửi yêu cầu ở trạng thái nháp.")
            budget = db.execute("SELECT total_budget - spent_amount AS available FROM budgets WHERE department_id = ?", (row["department_id"],)).fetchone()
            if budget is None or row["total_price"] > budget["available"]:
                raise BusinessError("BUDGET_EXCEEDED", "Ngân sách hiện tại không đủ để gửi yêu cầu.")
            db.execute("UPDATE requests SET status = 'PENDING_APPROVAL', submitted_at = ? WHERE id = ?", (_now(), request_id))
            self._audit_in_transaction(db, user["user_id"], "SUBMIT_REQUEST", request_id, "SUCCESS")
            return self._request(db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone())

    def list_approvals(self, user: dict[str, Any]) -> list[dict[str, Any]]:
        self.require_permission(user, "APPROVE_PROCUREMENT")
        if user["role"] != "MANAGER":
            raise BusinessError("FORBIDDEN", "Chỉ quản lý mới được xem hộp thư phê duyệt.", 403)
        with self.connection() as db:
            rows = db.execute(
                "SELECT * FROM requests WHERE status = 'PENDING_APPROVAL' AND requester_id != ? ORDER BY sequence DESC",
                (user["user_id"],),
            ).fetchall()
        return [self._request(row) for row in rows if self._in_scope(user, row["department_id"]) and row["total_price"] <= user["scope"]["approval_limit"]]

    def decide(self, user: dict[str, Any], request_id: str, decision: str, reason: str | None) -> dict[str, Any]:
        self.require_permission(user, "APPROVE_PROCUREMENT")
        if user["role"] != "MANAGER":
            raise BusinessError("FORBIDDEN", "Chỉ quản lý mới được phê duyệt hoặc từ chối.", 403)
        if decision not in {"approve", "reject"}:
            raise BusinessError("INVALID_DECISION", "Quyết định không hợp lệ.")
        with self.connection(write=True) as db:
            row = db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone()
            if row is None:
                raise BusinessError("REQUEST_NOT_FOUND", "Không tìm thấy yêu cầu mua sắm.", 404)
            if not self._in_scope(user, row["department_id"]) or row["requester_id"] == user["user_id"]:
                raise BusinessError("FORBIDDEN", "Yêu cầu nằm ngoài quyền phê duyệt của bạn.", 403)
            if row["total_price"] > user["scope"]["approval_limit"]:
                raise BusinessError("APPROVAL_LIMIT_EXCEEDED", "Giá trị yêu cầu vượt hạn mức phê duyệt của bạn.", 403)
            if row["status"] != "PENDING_APPROVAL":
                raise BusinessError("INVALID_STATUS", "Chỉ yêu cầu đang chờ duyệt mới được xử lý.")
            timestamp = _now()
            if decision == "approve":
                budget = db.execute("SELECT total_budget - spent_amount AS available FROM budgets WHERE department_id = ?", (row["department_id"],)).fetchone()
                if budget is None or row["total_price"] > budget["available"]:
                    raise BusinessError("BUDGET_EXCEEDED", "Ngân sách hiện tại không đủ để phê duyệt.")
                db.execute("UPDATE budgets SET spent_amount = spent_amount + ? WHERE department_id = ?", (row["total_price"], row["department_id"]))
                db.execute("UPDATE requests SET status = 'APPROVED', approved_at = ?, approved_by = ? WHERE id = ?", (timestamp, user["name"], request_id))
            else:
                db.execute("UPDATE requests SET status = 'REJECTED', rejected_at = ?, rejected_by = ?, rejection_reason = ? WHERE id = ?", (timestamp, user["name"], (reason or "Quản lý từ chối yêu cầu.").strip(), request_id))
            self._audit_in_transaction(db, user["user_id"], decision.upper() + "_REQUEST", request_id, "SUCCESS")
            return self._request(db.execute("SELECT * FROM requests WHERE id = ?", (request_id,)).fetchone())

    def create_agent_session(self, user_id: str, state: dict[str, Any]) -> str:
        session_id = secrets.token_urlsafe(18)
        with self.connection(write=True) as db:
            db.execute("INSERT INTO agent_sessions VALUES (?, ?, ?, ?)", (session_id, user_id, json.dumps(state, ensure_ascii=False), _now()))
        return session_id

    def agent_state(self, user_id: str, session_id: str) -> dict[str, Any]:
        with self.connection() as db:
            row = db.execute("SELECT * FROM agent_sessions WHERE id = ? AND user_id = ?", (session_id, user_id)).fetchone()
        if row is None:
            raise BusinessError("SESSION_NOT_FOUND", "Không tìm thấy phiên trợ lý.", 404)
        return json.loads(row["state_json"])

    def save_agent_state(self, user_id: str, session_id: str, state: dict[str, Any]) -> None:
        with self.connection(write=True) as db:
            cursor = db.execute("UPDATE agent_sessions SET state_json = ?, updated_at = ? WHERE id = ? AND user_id = ?", (json.dumps(state, ensure_ascii=False), _now(), session_id, user_id))
            if cursor.rowcount != 1:
                raise BusinessError("SESSION_NOT_FOUND", "Không tìm thấy phiên trợ lý.", 404)

    def checkpoint_model_result(
        self, user_id: str, session_id: str, state: dict[str, Any],
        trace_id: str, details: dict[str, Any],
    ) -> None:
        """Commit paid usage and its trace together before processing model actions."""
        with self.connection(write=True) as db:
            cursor = db.execute(
                "UPDATE agent_sessions SET state_json = ?, updated_at = ? WHERE id = ? AND user_id = ?",
                (json.dumps(state, ensure_ascii=False), _now(), session_id, user_id),
            )
            if cursor.rowcount != 1:
                raise BusinessError("SESSION_NOT_FOUND", "Không tìm thấy phiên trợ lý.", 404)
            db.execute(
                "INSERT INTO trace_events (trace_id, session_id, event, details_json, created_at) VALUES (?, ?, 'model', ?, ?)",
                (trace_id, session_id, json.dumps(details, ensure_ascii=False, default=str), _now()),
            )

    def trace(self, trace_id: str, session_id: str, event: str, details: dict[str, Any]) -> None:
        with self.connection(write=True) as db:
            db.execute("INSERT INTO trace_events (trace_id, session_id, event, details_json, created_at) VALUES (?, ?, ?, ?, ?)", (trace_id, session_id, event, json.dumps(details, ensure_ascii=False, default=str), _now()))

    def audit(self, actor_id: str, action: str, target_id: str | None, outcome: str, reason: str | None = None) -> None:
        with self.connection(write=True) as db:
            db.execute("INSERT INTO audit_events (actor_id, action, target_id, outcome, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)", (actor_id, action, target_id, outcome, reason, _now()))

    def confirm_agent_proposal(self, user: dict[str, Any], session_id: str, product_id: str) -> dict[str, Any]:
        """Re-derive every business value and finish create+submit in one transaction."""
        self.require_permission(user, "CREATE_PROCUREMENT")
        self.require_permission(user, "SUBMIT_PROCUREMENT")
        with self.connection(write=True) as db:
            row = db.execute("SELECT state_json FROM agent_sessions WHERE id = ? AND user_id = ?", (session_id, user["user_id"])).fetchone()
            if row is None:
                raise BusinessError("SESSION_NOT_FOUND", "Không tìm thấy phiên trợ lý.", 404)
            state = json.loads(row["state_json"])
            proposal = state.get("proposal") or {}
            if state.get("phase") != "AWAITING_CONFIRMATION" or product_id not in proposal.get("product_ids", []):
                raise BusinessError("INVALID_CONFIRMATION", "Đề xuất không còn hiệu lực hoặc sản phẩm chưa được đề xuất.")
            product = self.product(product_id)
            quoted = (proposal.get("offers") or {}).get(product_id)
            current_total = product["unit_price"] * proposal["quantity"]
            if quoted is None or quoted.get("unit_price") != product["unit_price"] or quoted.get("total_price") != current_total:
                raise BusinessError("STALE_PROPOSAL", "Giá sản phẩm đã thay đổi. Vui lòng tạo đề xuất mới.")
            request = self._insert_request(db, user, product_id, proposal["quantity"], proposal["reason"], "PENDING_APPROVAL")
            # Independent verification: success is based on the stored row, never model text.
            persisted = db.execute("SELECT * FROM requests WHERE id = ?", (request["id"],)).fetchone()
            expected = {
                "requester_id": user["user_id"],
                "department_id": user["department_id"],
                "product_id": product_id,
                "quantity": proposal["quantity"],
                "unit_price": product["unit_price"],
                "total_price": product["unit_price"] * proposal["quantity"],
                "status": "PENDING_APPROVAL",
            }
            if persisted is None or any(persisted[key] != value for key, value in expected.items()):
                raise BusinessError("VERIFICATION_FAILED", "Không xác minh được yêu cầu sau khi gửi.", 500)
            state["phase"] = "SUCCESS"
            state["request_id"] = request["id"]
            state["proposal"] = None
            db.execute("UPDATE agent_sessions SET state_json = ?, updated_at = ? WHERE id = ?", (json.dumps(state, ensure_ascii=False), _now(), session_id))
            self._audit_in_transaction(db, user["user_id"], "CONFIRM_AGENT_PROPOSAL", request["id"], "SUCCESS")
            return request
