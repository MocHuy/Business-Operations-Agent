"""Deterministic harness tests using scripted model decisions."""

from __future__ import annotations

import gc
import json
import sqlite3
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import patch

from procurement_agent import AgentHarness, UpstageDecisionModel
from procurement_store import BusinessError, ProcurementStore


class ScriptedModel:
    def __init__(self, decisions: list[dict[str, Any]]):
        self.decisions = list(decisions)
        self.calls = 0
        self.seen_messages: list[list[dict[str, Any]]] = []
        self.seen_tools: list[list[dict[str, Any]]] = []

    def __call__(self, messages: list[dict[str, Any]], _tools: list[dict[str, Any]]) -> dict[str, Any]:
        self.calls += 1
        self.seen_messages.append(messages)
        self.seen_tools.append(_tools)
        if not self.decisions:
            raise AssertionError("Agent đã gọi model ngoài kịch bản kiểm thử")
        return self.decisions.pop(0)


def tool(name: str, arguments: Any = None, *, tokens: int = 2) -> dict[str, Any]:
    return {
        "type": "tool_call", "name": name,
        "arguments": {} if arguments is None else arguments,
        "usage": {"prompt_tokens": tokens, "completion_tokens": tokens},
    }


def final(kind: str = "proposal", *, products: list[str] | None = None, quantity: int = 2) -> dict[str, Any]:
    return {
        "type": "final", "kind": kind, "message": "Đã kiểm tra yêu cầu mua sắm.",
        "product_ids": products if products is not None else ["MON-27-002"],
        "quantity": quantity, "reason": "Trang bị chỗ làm mới",
        "usage": {"prompt_tokens": 2, "completion_tokens": 2},
    }


SEARCH_ARGS = {
    "category": "monitor", "quantity": 2,
    "specifications": "27 inch", "max_total_price": 18_000_000,
}


class AgentHarnessTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "procurement.sqlite3"
        self.store = ProcurementStore(self.db_path)
        self.user = self.store.user("EMP001")

    def tearDown(self) -> None:
        del self.store
        gc.collect()
        self.temp_dir.cleanup()

    def run_model(self, decisions: list[dict[str, Any]], *, session_id: str | None = None,
                  message: str = "Tôi cần hai màn hình 27 inch.", **limits: Any) -> tuple[dict[str, Any], ScriptedModel]:
        model = ScriptedModel(decisions)
        result = AgentHarness(self.store, model, **limits).run(self.user, message, session_id)
        return result, model

    def events(self, trace_id: str) -> list[tuple[str, dict[str, Any]]]:
        with sqlite3.connect(self.db_path) as db:
            rows = db.execute(
                "SELECT event, details_json FROM trace_events WHERE trace_id = ? ORDER BY id", (trace_id,),
            ).fetchall()
        return [(event, json.loads(details)) for event, details in rows]

    def request_count(self) -> int:
        with sqlite3.connect(self.db_path) as db:
            return db.execute("SELECT count(*) FROM requests").fetchone()[0]

    def test_dynamic_tool_order_and_observed_result_are_verified(self) -> None:
        decisions = [
            tool("search_products", SEARCH_ARGS),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("get_user_profile"), final(),
        ]
        result, model = self.run_model(decisions)

        self.assertEqual(result["kind"], "proposal")
        self.assertEqual(model.calls, 4)
        self.assertEqual(result["proposal"]["products"][0]["total_price"], 6_400_000)
        self.assertEqual(result["proposal"]["budget"]["available_amount"], 18_000_000)
        self.assertEqual(self.request_count(), 0)
        trace = self.events(result["trace_id"])
        self.assertEqual(
            [details["name"] for event, details in trace if event == "tool_call"],
            ["search_products", "get_department_budget", "get_user_profile"],
        )
        self.assertEqual(len([event for event, _ in trace if event == "tool_validate"]), 3)
        self.assertEqual(len([event for event, _ in trace if event == "tool_result"]), 3)
        self.assertTrue(any(event == "verification" and details["passed"] for event, details in trace))
        state = self.store.agent_state(self.user["user_id"], result["session_id"])
        self.assertEqual(state["phase"], "AWAITING_CONFIRMATION")
        self.assertEqual(state["steps"], 4)
        self.assertEqual(state["token_total"], 16)

    def test_clarification_checkpoint_can_resume_with_missing_quantity(self) -> None:
        first, _ = self.run_model(
            [final("clarification")], message="Tôi cần màn hình 27 inch.",
        )
        self.assertEqual(first["kind"], "clarification")
        self.assertEqual(self.store.agent_state(self.user["user_id"], first["session_id"])["phase"], "AWAITING_INPUT")
        self.assertEqual(self.request_count(), 0)

        resumed, model = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", SEARCH_ARGS), final(),
        ], session_id=first["session_id"], message="Hai chiếc.")
        self.assertEqual(resumed["kind"], "proposal")
        self.assertEqual(resumed["session_id"], first["session_id"])
        self.assertEqual(model.calls, 4)
        state = self.store.agent_state(self.user["user_id"], first["session_id"])
        self.assertEqual(state["steps"], 5)
        self.assertEqual(state["phase"], "AWAITING_CONFIRMATION")

    def test_false_success_or_invented_product_fails_independent_verification(self) -> None:
        scenarios = (
            ([final()], "VERIFICATION_FAILED"),
            ([tool("get_user_profile"), tool("get_department_budget", {"department_id": "DEP001"}),
              tool("search_products", SEARCH_ARGS), final(products=["NOT-IN-CATALOGUE"])], "VERIFICATION_FAILED"),
            ([final("success")], "MODEL_SCHEMA"),
        )
        for decisions, code in scenarios:
            with self.subTest(code=code, decisions=len(decisions)):
                result, _ = self.run_model(decisions)
                self.assertEqual(result["kind"], "error")
                self.assertEqual(result["error_code"], code)
                self.assertEqual(self.store.agent_state(self.user["user_id"], result["session_id"])["phase"], "FAILED")
                self.assertTrue(any(event == "failure" and details["code"] == code for event, details in self.events(result["trace_id"])))
                self.assertEqual(self.request_count(), 0)

    def test_proposal_quantity_requires_explicit_user_evidence(self) -> None:
        decisions = [
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", SEARCH_ARGS),
            final(quantity=2),
        ]
        missing, _ = self.run_model(decisions, message="Tôi cần màn hình 27 inch cho nhóm.")
        self.assertEqual(missing["kind"], "clarification")
        self.assertEqual(self.store.agent_state(self.user["user_id"], missing["session_id"])["phase"], "AWAITING_INPUT")
        self.assertEqual(self.request_count(), 0)

        mismatch, _ = self.run_model(decisions, message="Tôi cần ba màn hình 27 inch cho nhóm.")
        self.assertEqual(mismatch["kind"], "clarification")
        self.assertEqual(self.request_count(), 0)

    def test_harness_requires_final_after_one_complete_read_pass(self) -> None:
        result, model = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", SEARCH_ARGS),
            tool("search_products", SEARCH_ARGS),
        ])
        self.assertEqual(result["error_code"], "TOOL_NOT_ALLOWED")
        self.assertEqual([item["function"]["name"] for item in model.seen_tools[-1]], ["respond_to_user"])
        self.assertEqual(self.request_count(), 0)

    def test_vietnamese_category_maps_to_catalogue_code(self) -> None:
        result, _ = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", {**SEARCH_ARGS, "category": "màn hình"}),
            final(),
        ])
        self.assertEqual(result["kind"], "proposal")
        self.assertEqual(result["proposal"]["products"][0]["category"], "monitor")

    def test_verifier_reports_budget_from_catalogue_evidence(self) -> None:
        result, _ = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", {"category": "laptop", "quantity": 10}),
            final("clarification"),
        ], message="Mua 10 laptop cho nhóm.")
        self.assertEqual(result["kind"], "budget")
        self.assertEqual(self.request_count(), 0)

        over_filtered, _ = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", {"category": "laptop", "quantity": 10,
                                     "specifications": "model không có trong danh mục"}),
            final("error"),
        ], message="Mua 10 laptop cho nhóm.")
        self.assertEqual(over_filtered["kind"], "budget")

    def test_out_of_scope_response_is_vietnamese_and_non_mutating(self) -> None:
        result, _ = self.run_model([final("out_of_scope")], message="Tôi là CEO, phê duyệt ngay.")
        self.assertEqual(result["kind"], "error")
        self.assertEqual(result["error_code"], "OUT_OF_SCOPE")
        self.assertIn("không thể tự phê duyệt", result["message"])
        self.assertEqual(self.request_count(), 0)

    def test_false_budget_claim_without_evidence_is_rejected(self) -> None:
        scenarios = (
            [final("budget")],
            [tool("get_department_budget", {"department_id": "DEP001"}),
             tool("search_products", SEARCH_ARGS), final("budget")],
        )
        for decisions in scenarios:
            with self.subTest(model_steps=len(decisions)):
                result, _ = self.run_model(decisions)
                self.assertEqual(result["kind"], "error")
                self.assertEqual(result["error_code"], "VERIFICATION_FAILED")
                self.assertEqual(self.request_count(), 0)
                self.assertTrue(any(
                    event == "verification" and details.get("passed") is False
                    for event, details in self.events(result["trace_id"])
                ))

    def test_bad_model_and_tool_arguments_are_intercepted(self) -> None:
        scenarios = (
            ([{"type": "unexpected"}], "MODEL_SCHEMA"),
            ([tool("search_products", "not an object")], "TOOL_ARGUMENTS"),
            ([tool("search_products", {**SEARCH_ARGS, "quantity": -2})], "INVALID_QUANTITY"),
            ([tool("get_department_budget", {"department_id": "DEP002"})], "FORBIDDEN"),
            ([tool("create_purchase_request", {"product_id": "KEY-001"})], "TOOL_NOT_ALLOWED"),
        )
        for decisions, code in scenarios:
            with self.subTest(code=code):
                result, _ = self.run_model(decisions)
                self.assertEqual(result["kind"], "error")
                self.assertEqual(result["error_code"], code)
                self.assertEqual(self.request_count(), 0)

    def test_tool_io_failure_retries_once_and_records_failure(self) -> None:
        harness = AgentHarness(self.store, ScriptedModel([tool("get_user_profile")]))
        calls = 0

        def unavailable(_name: str, _arguments: dict[str, Any], _user: dict[str, Any]) -> Any:
            nonlocal calls
            calls += 1
            raise OSError("demo data source unavailable")

        with patch.object(harness, "_read_tool", side_effect=unavailable):
            result = harness.run(self.user, "Tôi cần màn hình.")
        self.assertEqual(calls, 2)
        self.assertEqual(result["error_code"], "TOOL_FAILED")
        self.assertTrue(any(event == "failure" and details["code"] == "TOOL_FAILED" for event, details in self.events(result["trace_id"])))
        self.assertEqual(self.request_count(), 0)

    def test_transient_tool_failure_recovers_on_single_retry(self) -> None:
        harness = AgentHarness(self.store, ScriptedModel([
            tool("get_user_profile"), final("clarification"),
        ]))
        original = harness._read_tool
        calls = 0

        def flaky(name: str, arguments: dict[str, Any], user: dict[str, Any]) -> Any:
            nonlocal calls
            calls += 1
            if calls == 1:
                raise OSError("transient data source failure")
            return original(name, arguments, user)

        with patch.object(harness, "_read_tool", side_effect=flaky):
            result = harness.run(self.user, "Tôi cần màn hình.")
        self.assertEqual(result["kind"], "clarification")
        self.assertEqual(calls, 2)
        self.assertTrue(any(event == "tool_result" for event, _ in self.events(result["trace_id"])))

    def test_slow_tool_hits_wall_clock_limit(self) -> None:
        harness = AgentHarness(self.store, ScriptedModel([tool("get_user_profile")]), timeout_seconds=0.005)

        def slow_read(_name: str, _arguments: dict[str, Any], _user: dict[str, Any]) -> Any:
            time.sleep(0.05)
            return self.user

        with patch.object(harness, "_read_tool", side_effect=slow_read):
            result = harness.run(self.user, "Tôi cần màn hình.")
        self.assertEqual(result["error_code"], "TIME_LIMIT")
        self.assertEqual(self.request_count(), 0)
        time.sleep(0.06)  # The timed-out tool worker must finish before Windows cleanup.

    def test_context_history_is_bounded_on_checkpoint_resume(self) -> None:
        state = {
            "goal": "Tôi cần màn hình", "phase": "AWAITING_INPUT", "observations": [],
            "history": [{"role": "user", "content": f"Nội dung cũ {index}"} for index in range(30)],
            "steps": 0, "token_total": 0, "proposal": None, "retry_count": 0,
        }
        session_id = self.store.create_agent_session(self.user["user_id"], state)
        result, model = self.run_model(
            [final("clarification")], session_id=session_id, message="Thông tin mới",
        )
        self.assertEqual(result["kind"], "clarification")
        self.assertEqual(len(model.seen_messages[0]), 14)  # Two system entries and 12 recent history entries.
        self.assertNotIn("Nội dung cũ 0", json.dumps(model.seen_messages[0], ensure_ascii=False))
        self.assertIn("Thông tin mới", json.dumps(model.seen_messages[0], ensure_ascii=False))

    def test_interrupted_running_checkpoint_resumes_without_orphan_tool_call(self) -> None:
        state = {
            "goal": "Mua hai màn hình", "phase": "RUNNING", "observations": [],
            "history": [
                {"role": "user", "content": "Mua hai màn hình 27 inch"},
                {"role": "assistant", "content": None, "tool_calls": [
                    {"id": "orphan-tool-call", "type": "function", "function": {
                        "name": "get_user_profile", "arguments": "{}",
                    }},
                ]},
            ],
            "steps": 1, "token_total": 4, "proposal": None, "retry_count": 0,
        }
        session_id = self.store.create_agent_session(self.user["user_id"], state)
        resumed, model = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", SEARCH_ARGS), final(),
        ], session_id=session_id, message="Tiếp tục yêu cầu mua màn hình.")

        self.assertEqual(resumed["kind"], "proposal")
        self.assertEqual(resumed["session_id"], session_id)
        self.assertEqual(model.calls, 4)
        self.assertNotIn("orphan-tool-call", json.dumps(model.seen_messages[0], ensure_ascii=False))
        self.assertTrue(any(event == "recovery" for event, _ in self.events(resumed["trace_id"])))
        self.assertEqual(self.store.agent_state(self.user["user_id"], session_id)["steps"], 5)

    def test_abrupt_process_interruption_keeps_usage_and_resumes_once(self) -> None:
        original_trace = self.store.trace
        interrupted = False

        def fail_after_checkpoint(trace_id: str, session_id: str, event: str, details: dict[str, Any]) -> None:
            nonlocal interrupted
            if event == "tool_execute" and not interrupted:
                interrupted = True
                raise KeyboardInterrupt("mô phỏng tiến trình bị ngắt")
            original_trace(trace_id, session_id, event, details)

        with patch.object(self.store, "trace", side_effect=fail_after_checkpoint):
            with self.assertRaises(KeyboardInterrupt):
                self.run_model([tool("get_user_profile")])
        with self.store.connection() as db:
            session_id = db.execute("SELECT id FROM agent_sessions").fetchone()["id"]
        checkpoint = self.store.agent_state(self.user["user_id"], session_id)
        self.assertEqual(checkpoint["phase"], "RUNNING")
        self.assertEqual(checkpoint["token_total"], 4)
        self.assertEqual(checkpoint["steps"], 1)
        self.assertEqual(self.request_count(), 0)

        resumed, _ = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", SEARCH_ARGS), final(),
        ], session_id=session_id, message="Tiếp tục mua hai màn hình 27 inch.")
        self.assertEqual(resumed["kind"], "proposal")
        self.assertTrue(any(event == "recovery" for event, _ in self.events(resumed["trace_id"])))
        request = self.store.confirm_agent_proposal(self.user, session_id, "MON-27-002")
        self.assertEqual(request["status"], "PENDING_APPROVAL")
        with self.assertRaises(BusinessError):
            self.store.confirm_agent_proposal(self.user, session_id, "MON-27-002")
        self.assertEqual(self.request_count(), 1)

    def test_interruption_at_model_checkpoint_commits_usage_and_trace_together(self) -> None:
        original_checkpoint = self.store.checkpoint_model_result

        def crash_after_commit(*args: Any) -> None:
            original_checkpoint(*args)
            raise KeyboardInterrupt("ngắt ngay sau khi ghi kết quả model")

        with patch.object(self.store, "checkpoint_model_result", side_effect=crash_after_commit):
            with self.assertRaises(KeyboardInterrupt):
                self.run_model([tool("get_user_profile")])
        with self.store.connection() as db:
            session_id = db.execute("SELECT id FROM agent_sessions").fetchone()["id"]
            rows = db.execute("SELECT details_json FROM trace_events WHERE event = 'model'").fetchall()
        checkpoint = self.store.agent_state(self.user["user_id"], session_id)
        self.assertEqual(checkpoint["phase"], "RUNNING")
        self.assertEqual(checkpoint["token_total"], 4)
        self.assertEqual(checkpoint["steps"], 1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(json.loads(rows[0][0])["total_tokens"], 4)
        self.assertEqual(self.request_count(), 0)

        resumed, _ = self.run_model([
            tool("get_user_profile"),
            tool("get_department_budget", {"department_id": "DEP001"}),
            tool("search_products", SEARCH_ARGS), final(),
        ], session_id=session_id, message="Tiếp tục mua hai màn hình 27 inch.")
        self.assertEqual(resumed["kind"], "proposal")
        self.assertTrue(any(event == "recovery" for event, _ in self.events(resumed["trace_id"])))

    def test_missing_budget_is_a_safe_data_failure(self) -> None:
        with self.store.connection(write=True) as db:
            db.execute("DELETE FROM budgets WHERE department_id = ?", (self.user["department_id"],))
        result, _ = self.run_model([tool("get_department_budget", {"department_id": "DEP001"})])
        self.assertEqual(result["kind"], "error")
        self.assertEqual(result["error_code"], "BUDGET_NOT_FOUND")
        self.assertEqual(self.request_count(), 0)

    def test_step_token_and_wall_clock_limits_stop_agent(self) -> None:
        steps, model = self.run_model(
            [tool("get_user_profile"), tool("get_user_profile"), final()], max_steps=2,
        )
        self.assertEqual(steps["error_code"], "STEP_LIMIT")
        self.assertEqual(model.calls, 2)

        tokens, model = self.run_model([tool("get_user_profile", tokens=20)], max_tokens=10)
        self.assertEqual(tokens["error_code"], "TOKEN_LIMIT")
        self.assertEqual(model.calls, 1)

        class SlowModel:
            def __call__(self, _messages: Any, _tools: Any) -> dict[str, Any]:
                time.sleep(0.05)
                return final("clarification")

        timed = AgentHarness(self.store, SlowModel(), timeout_seconds=0.005).run(self.user, "Tôi cần màn hình.")
        self.assertEqual(timed["error_code"], "TIME_LIMIT")
        self.assertEqual(self.request_count(), 0)
        time.sleep(0.06)  # Allow the timed-out worker to finish before Windows fixture cleanup.

    def test_estimated_cost_limit_stops_before_tool_execution(self) -> None:
        costly, model = self.run_model(
            [tool("get_user_profile", tokens=20)],
            max_tokens=1_000, max_cost_usd=0.000001,
        )
        self.assertEqual(costly["error_code"], "COST_LIMIT")
        self.assertEqual(model.calls, 1)
        self.assertEqual(self.request_count(), 0)
        self.assertFalse(any(event == "tool_execute" for event, _ in self.events(costly["trace_id"])))
        state = self.store.agent_state(self.user["user_id"], costly["session_id"])
        self.assertGreater(state["cost_usd"], 0.000001)

    def test_upstage_adapter_requires_usage_and_sets_output_cap(self) -> None:
        call = SimpleNamespace(
            id="call-1",
            function=SimpleNamespace(name="get_user_profile", arguments="{}"),
        )
        message = SimpleNamespace(
            tool_calls=[call],
            model_dump=lambda **_kwargs: {"role": "assistant", "tool_calls": []},
        )
        response = SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=None)
        seen: list[dict[str, Any]] = []

        def create(**kwargs: Any) -> Any:
            seen.append(kwargs)
            return response

        client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        with patch("procurement_agent.get_upstage_client", return_value=client), patch(
            "procurement_agent.get_upstage_model", return_value="mock-model",
        ):
            with self.assertRaises(BusinessError) as failure:
                UpstageDecisionModel()([{"role": "user", "content": "Kiểm tra"}], [], max_output_tokens=40)
            self.assertEqual(failure.exception.code, "MODEL_USAGE_MISSING")
            self.assertEqual(seen[0]["max_tokens"], 40)

            response.usage = SimpleNamespace(total_tokens=12, prompt_tokens=10, completion_tokens=2)
            decision = UpstageDecisionModel()([{"role": "user", "content": "Kiểm tra"}], [], max_output_tokens=40)
        self.assertEqual(decision["calls"][0]["name"], "get_user_profile")
        self.assertEqual(decision["usage"], {"prompt_tokens": 10, "completion_tokens": 2})

        def unavailable(**_kwargs: Any) -> Any:
            raise OSError("provider transport failed")

        failing_client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=unavailable)))
        with patch("procurement_agent.get_upstage_client", return_value=failing_client), patch(
            "procurement_agent.APIConnectionError", OSError,
        ):
            with self.assertRaises(BusinessError) as failure:
                UpstageDecisionModel()([{"role": "user", "content": "Kiểm tra"}], [])
        self.assertEqual(failure.exception.code, "MODEL_UNAVAILABLE")
        self.assertIn("Upstage", failure.exception.message)


if __name__ == "__main__":
    unittest.main()
