"""Business invariants enforced independently of the language model."""

from __future__ import annotations

import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from procurement_store import BusinessError, ProcurementStore


class ProcurementStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.store = ProcurementStore(Path(self.temp_dir.name) / "procurement.sqlite3")
        self.employee = self.store.user("EMP001")
        self.other_employee = self.store.user("EMP002")
        self.manager = self.store.user("MGR001")
        self.other_manager = self.store.user("MGR_MKT_001")

    def test_retention_preview_and_cleanup_keep_requests_and_audit(self) -> None:
        request = self.store.create_request(self.employee, "KEY-001", 1, "Thiết bị cho nhóm")
        self.store.login("nhanvien2", "123")
        session_id = self.store.create_agent_session(self.employee["user_id"], {"phase": "RUNNING"})
        self.store.trace("trace-old", session_id, "input", {"message": "cần bàn phím"})
        now = datetime.now(timezone.utc)
        old = (now - timedelta(days=31)).isoformat(timespec="seconds")
        with self.store.connection(write=True) as db:
            db.execute("UPDATE sessions SET expires_at = ?", ((now - timedelta(days=1)).timestamp(),))
            db.execute("UPDATE agent_sessions SET updated_at = ?", (old,))
            db.execute("UPDATE trace_events SET created_at = ?", (old,))

        expected = {"sessions": 1, "agent_sessions": 1, "trace_events": 1}
        self.assertEqual(self.store.prune_operational_data(now=now), expected)
        with self.store.connection() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM trace_events").fetchone()[0], 1)
        self.assertEqual(self.store.prune_operational_data(execute=True, now=now), expected)
        self.assertEqual(self.store.prune_operational_data(now=now), {key: 0 for key in expected})
        self.assertEqual(self.store.get_request(self.employee, request["id"])["id"], request["id"])
        with self.store.connection() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM audit_events").fetchone()[0], 1)

    def test_create_submit_and_manager_approve_rechecks_budget(self) -> None:
        before = self.store.budget(self.employee["department_id"])["available_amount"]
        request = self.store.create_request(self.employee, "MON-27-002", 2, "Mở rộng chỗ làm")
        self.assertEqual(request["status"], "DRAFT")
        self.assertEqual(request["total_price"], 6_400_000)
        self.assertEqual(self.store.budget(self.employee["department_id"])["available_amount"], before)

        submitted = self.store.submit_request(self.employee, request["id"])
        self.assertEqual(submitted["status"], "PENDING_APPROVAL")
        self.assertEqual(self.store.budget(self.employee["department_id"])["available_amount"], before)
        self.assertIn(request["id"], {item["id"] for item in self.store.list_approvals(self.manager)})

        approved = self.store.decide(self.manager, request["id"], "approve", None)
        self.assertEqual(approved["status"], "APPROVED")
        self.assertEqual(self.store.budget(self.employee["department_id"])["available_amount"], before - 6_400_000)
        with self.assertRaises(BusinessError) as repeated:
            self.store.decide(self.manager, request["id"], "approve", None)
        self.assertEqual(repeated.exception.code, "INVALID_STATUS")
        self.assertEqual(self.store.budget(self.employee["department_id"])["available_amount"], before - 6_400_000)

    def test_rejection_records_reason_without_spending_budget(self) -> None:
        before = self.store.budget(self.employee["department_id"])["available_amount"]
        request = self.store.create_request(self.employee, "KEY-001", 2, "Bàn làm việc mới")
        self.store.submit_request(self.employee, request["id"])

        rejected = self.store.decide(self.manager, request["id"], "reject", "Thiết bị còn trong kho")
        self.assertEqual(rejected["status"], "REJECTED")
        self.assertEqual(rejected["rejection_reason"], "Thiết bị còn trong kho")
        self.assertEqual(self.store.budget(self.employee["department_id"])["available_amount"], before)
        with self.assertRaises(BusinessError) as repeated:
            self.store.submit_request(self.employee, request["id"])
        self.assertEqual(repeated.exception.code, "INVALID_STATUS")

    def test_manager_cannot_approve_two_requests_that_exceed_remaining_budget(self) -> None:
        first = self.store.create_request(self.employee, "MON-27-002", 5, "Nhóm A")
        second = self.store.create_request(self.employee, "MON-27-002", 5, "Nhóm B")
        self.store.submit_request(self.employee, first["id"])
        self.store.submit_request(self.employee, second["id"])
        self.store.decide(self.manager, first["id"], "approve", None)

        with self.assertRaises(BusinessError) as failure:
            self.store.decide(self.manager, second["id"], "approve", None)
        self.assertEqual(failure.exception.code, "BUDGET_EXCEEDED")
        self.assertEqual(self.store.get_request(self.employee, second["id"])["status"], "PENDING_APPROVAL")
        self.assertEqual(self.store.budget(self.employee["department_id"])["available_amount"], 2_000_000)

    def test_budget_product_and_quantity_are_checked_by_store(self) -> None:
        scenarios = (
            ("LAP-15-001", 1, "BUDGET_EXCEEDED"),
            ("NOT-IN-CATALOGUE", 1, "PRODUCT_NOT_FOUND"),
            ("KEY-001", 0, "INVALID_QUANTITY"),
            ("KEY-001", -2, "INVALID_QUANTITY"),
        )
        for product_id, quantity, code in scenarios:
            with self.subTest(product_id=product_id, quantity=quantity):
                with self.assertRaises(BusinessError) as failure:
                    self.store.create_request(self.employee, product_id, quantity, "Nhu cầu công việc")
                self.assertEqual(failure.exception.code, code)
        self.assertEqual(self.store.list_requests(self.employee), [])

    def test_role_ownership_and_department_limit_approval_and_visibility(self) -> None:
        request = self.store.create_request(self.employee, "KEY-001", 1, "Bàn làm việc mới")
        with self.assertRaises(BusinessError) as nonowner:
            self.store.submit_request(self.other_employee, request["id"])
        self.assertEqual(nonowner.exception.code, "FORBIDDEN")
        self.store.submit_request(self.employee, request["id"])

        with self.assertRaises(BusinessError) as employee_approval:
            self.store.decide(self.employee, request["id"], "approve", None)
        self.assertEqual(employee_approval.exception.code, "FORBIDDEN")
        with self.assertRaises(BusinessError) as cross_department:
            self.store.decide(self.other_manager, request["id"], "approve", None)
        self.assertEqual(cross_department.exception.code, "FORBIDDEN")
        with self.assertRaises(BusinessError) as hidden:
            self.store.get_request(self.other_employee, request["id"])
        self.assertEqual(hidden.exception.code, "REQUEST_NOT_FOUND")
        self.assertEqual(self.store.get_request(self.employee, request["id"])["status"], "PENDING_APPROVAL")

    def test_confirmed_agent_proposal_is_verified_against_stored_data(self) -> None:
        session = self.store.create_agent_session(self.employee["user_id"], {
            "phase": "AWAITING_CONFIRMATION",
            "proposal": {
                "product_ids": ["MON-27-002"], "quantity": 2, "reason": "Mở rộng chỗ làm",
                "offers": {"MON-27-002": {"unit_price": 3_200_000, "total_price": 6_400_000}},
            },
        })
        with self.assertRaises(BusinessError) as invented_product:
            self.store.confirm_agent_proposal(self.employee, session, "MON-27-001")
        self.assertEqual(invented_product.exception.code, "INVALID_CONFIRMATION")
        with self.assertRaises(BusinessError) as stolen_session:
            self.store.confirm_agent_proposal(self.other_employee, session, "MON-27-002")
        self.assertEqual(stolen_session.exception.code, "SESSION_NOT_FOUND")

        result = self.store.confirm_agent_proposal(self.employee, session, "MON-27-002")
        self.assertEqual(result["status"], "PENDING_APPROVAL")
        self.assertEqual(result["total_price"], 6_400_000)
        state = self.store.agent_state(self.employee["user_id"], session)
        self.assertEqual(state["phase"], "SUCCESS")
        self.assertEqual(state["request_id"], result["id"])
        with self.assertRaises(BusinessError) as replay:
            self.store.confirm_agent_proposal(self.employee, session, "MON-27-002")
        self.assertEqual(replay.exception.code, "INVALID_CONFIRMATION")

    def test_agent_confirmation_rechecks_budget_after_proposal(self) -> None:
        session = self.store.create_agent_session(self.employee["user_id"], {
            "phase": "AWAITING_CONFIRMATION",
            "proposal": {
                "product_ids": ["MON-27-002"], "quantity": 5, "reason": "Nhóm B",
                "offers": {"MON-27-002": {"unit_price": 3_200_000, "total_price": 16_000_000}},
            },
        })
        competing = self.store.create_request(self.employee, "MON-27-002", 5, "Nhóm A")
        self.store.submit_request(self.employee, competing["id"])
        self.store.decide(self.manager, competing["id"], "approve", None)

        with self.assertRaises(BusinessError) as failure:
            self.store.confirm_agent_proposal(self.employee, session, "MON-27-002")
        self.assertEqual(failure.exception.code, "BUDGET_EXCEEDED")
        self.assertEqual(self.store.agent_state(self.employee["user_id"], session)["phase"], "AWAITING_CONFIRMATION")
        self.assertEqual(len(self.store.list_requests(self.employee)), 1)

    def test_audit_rows_cannot_be_changed_or_removed(self) -> None:
        self.store.audit(self.employee["user_id"], "CREATE_REQUEST", "PR-000001", "SUCCESS")
        with self.store.connection() as db:
            row_id = db.execute("SELECT id FROM audit_events").fetchone()["id"]
        for statement in (
            "UPDATE audit_events SET outcome = 'OTHER' WHERE id = ?",
            "DELETE FROM audit_events WHERE id = ?",
        ):
            with self.subTest(statement=statement):
                with self.assertRaises(sqlite3.IntegrityError):
                    with self.store.connection(write=True) as db:
                        db.execute(statement, (row_id,))


if __name__ == "__main__":
    unittest.main()
