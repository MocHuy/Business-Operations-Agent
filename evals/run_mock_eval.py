"""Repeatable Procurement Harness benchmark with scripted model decisions.

Run from repository root: python -m evals.run_mock_eval
The resulting figures measure harness behavior, not live Upstage quality/latency.
"""

from __future__ import annotations

import json
import tempfile
import time
from pathlib import Path
from unittest.mock import patch

from procurement_agent import AgentHarness
from procurement_store import BusinessError, ProcurementStore


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "reports" / "eval-mock.json"
SAMPLE_TRACE = ROOT / "logs" / "sample-traces" / "false-model-success.json"
DATASET = ROOT / "evals" / "procurement_cases.json"


class ScriptedModel:
    def __init__(self, *decisions: dict):
        self.decisions = list(decisions)

    def __call__(self, _messages: list[dict], _tools: list[dict]) -> dict:
        decision = self.decisions.pop(0)
        return {**decision, "usage": {"prompt_tokens": 80, "completion_tokens": 20}}


def tool(name: str, **arguments: object) -> dict:
    return {"type": "tool_call", "name": name, "arguments": arguments}


def final(kind: str, message: str, **fields: object) -> dict:
    return {"type": "final", "kind": kind, "message": message, **fields}


def observations(store: ProcurementStore) -> dict:
    with store.connection() as db:
        rows = db.execute("SELECT event, details_json FROM trace_events ORDER BY id").fetchall()
    events = [(row["event"], json.loads(row["details_json"])) for row in rows]
    model = [detail for event, detail in events if event == "model"]
    return {
        "model_calls": len(model),
        "tool_calls": sum(event == "tool_call" for event, _ in events),
        "tool_validated_calls": sum(event == "tool_validate" and detail.get("passed") is True for event, detail in events),
        "tool_rejected_calls": sum(event == "tool_validate" and detail.get("passed") is False for event, detail in events),
        "tool_runtime_errors": sum(event == "tool_error" for event, _ in events),
        "tool_results": sum(event == "tool_result" for event, _ in events),
        "input_tokens": sum(step.get("prompt_tokens", 0) for step in model),
        "output_tokens": sum(step.get("completion_tokens", 0) for step in model),
        "model_latency_ms": sum(step.get("latency_ms", 0) for step in model),
        "estimated_model_cost_usd": round(sum(
            step.get("prompt_tokens", 0) * 0.30 / 1_000_000
            + step.get("completion_tokens", 0) * 1.20 / 1_000_000
            for step in model
        ), 8),
        "failure_codes": [detail.get("code") for event, detail in events if event == "failure"],
    }


def scenario(definition: dict, run_case) -> dict:
    name = definition["id"]
    with tempfile.TemporaryDirectory() as directory:
        store = ProcurementStore(Path(directory) / "procurement.sqlite3")
        start = time.monotonic()
        passed = run_case(store, definition["input"])
        if name == "false_model_success":
            with store.connection() as db:
                rows = db.execute("SELECT event, details_json FROM trace_events ORDER BY id").fetchall()
            SAMPLE_TRACE.parent.mkdir(parents=True, exist_ok=True)
            SAMPLE_TRACE.write_text(json.dumps({
                "scenario": name,
                "root_cause": "Model đề xuất sản phẩm và tự nhận hoàn tất ở bước 1 khi chưa đọc profile, ngân sách hoặc catalogue; verifier từ chối.",
                "events": [{"event": row["event"], "details": json.loads(row["details_json"])} for row in rows],
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return {
            "id": name, "tier": definition["tier"], "passed": bool(passed),
            "latency_ms": round((time.monotonic() - start) * 1000, 2),
            **observations(store),
        }


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    low = int(index)
    high = min(low + 1, len(ordered) - 1)
    return round(ordered[low] + (ordered[high] - ordered[low]) * (index - low), 2)


def standard(store: ProcurementStore, prompt: str) -> bool:
    employee, manager = store.user("EMP001"), store.user("MGR001")
    model = ScriptedModel(
        tool("get_user_profile"),
        tool("get_department_budget", department_id="DEP001"),
        tool("search_products", category="monitor", quantity=2, specifications="27 inch"),
        final("proposal", "Có màn hình phù hợp ngân sách.", product_ids=["MON-27-002"], quantity=2, reason="Mở rộng nơi làm việc"),
    )
    response = AgentHarness(store, model).run(employee, prompt)
    if response["kind"] != "proposal":
        return False
    request = store.confirm_agent_proposal(employee, response["session_id"], "MON-27-002")
    approved = store.decide(manager, request["id"], "approve", None)
    return approved["status"] == "APPROVED" and store.budget("DEP001")["available_amount"] == 11_600_000


def missing_quantity(store: ProcurementStore, prompt: str) -> bool:
    response = AgentHarness(store, ScriptedModel(final("clarification", "Bạn cần mua bao nhiêu màn hình?"))).run(
        store.user("EMP001"), prompt
    )
    return response["kind"] == "clarification" and not store.list_requests(store.user("EMP001"))


def budget_overrun(store: ProcurementStore, prompt: str) -> bool:
    model = ScriptedModel(
        tool("get_user_profile"), tool("get_department_budget", department_id="DEP001"),
        tool("search_products", category="laptop", quantity=10),
        final("proposal", "Tôi đã mua xong.", product_ids=["LAP-14-001"], quantity=10, reason="Trang bị nhóm"),
    )
    response = AgentHarness(store, model).run(store.user("EMP001"), prompt)
    return (response["kind"] == "error" and response["error_code"] in {"BUDGET_EXCEEDED", "VERIFICATION_FAILED"}
            and not store.list_requests(store.user("EMP001")))


def false_model_success(store: ProcurementStore, prompt: str) -> bool:
    model = ScriptedModel(final("proposal", "Đã hoàn tất.", product_ids=["MON-27-002"], quantity=1, reason="Trang bị"))
    response = AgentHarness(store, model).run(store.user("EMP001"), prompt)
    return response["kind"] == "error" and response["error_code"] == "VERIFICATION_FAILED" and not store.list_requests(store.user("EMP001"))


def invalid_tool_argument(store: ProcurementStore, prompt: str) -> bool:
    response = AgentHarness(store, ScriptedModel(tool("search_products", category="monitor", quantity=-2))).run(
        store.user("EMP001"), prompt
    )
    return response["kind"] == "error" and response["error_code"] == "INVALID_QUANTITY"


def tool_failure(store: ProcurementStore, prompt: str) -> bool:
    with patch("procurement_agent.search_products", side_effect=OSError("unavailable")) as search:
        response = AgentHarness(store, ScriptedModel(tool("search_products", category="monitor", quantity=1))).run(
            store.user("EMP001"), prompt
        )
    return response["kind"] == "error" and response["error_code"] == "TOOL_FAILED" and search.call_count == 2


def loop_limit(store: ProcurementStore, prompt: str) -> bool:
    model = ScriptedModel(*(tool("get_user_profile") for _ in range(3)))
    response = AgentHarness(store, model, max_steps=3).run(store.user("EMP001"), prompt)
    return response["kind"] == "error" and response["error_code"] == "STEP_LIMIT"


def privilege_injection(store: ProcurementStore, prompt: str) -> bool:
    employee, manager = store.user("EMP001"), store.user("MGR_MKT_001")
    request = store.create_request(employee, "KEY-001", 1, "Phục vụ công việc")
    store.submit_request(employee, request["id"])
    agent = AgentHarness(store, ScriptedModel(tool("approve_purchase_request", request_id=request["id"])))
    prompt_result = agent.run(employee, f"{prompt} {request['id']}")
    blocked = 0
    for actor in (employee, manager):
        try:
            store.decide(actor, request["id"], "approve", None)
        except BusinessError as error:
            blocked += error.code == "FORBIDDEN"
    return (prompt_result["kind"] == "error" and prompt_result["error_code"] == "TOOL_NOT_ALLOWED"
            and blocked == 2 and store.get_request(employee, request["id"])["status"] == "PENDING_APPROVAL")


def main() -> None:
    checks = [
        ("standard", standard), ("missing_quantity", missing_quantity),
        ("budget_overrun", budget_overrun), ("false_model_success", false_model_success),
        ("invalid_tool_argument", invalid_tool_argument), ("tool_failure", tool_failure),
        ("loop_limit", loop_limit), ("privilege_injection", privilege_injection),
    ]
    definitions = json.loads(DATASET.read_text(encoding="utf-8"))
    definition_by_id = {item["id"]: item for item in definitions}
    if len(definition_by_id) != len(definitions) or set(definition_by_id) != {name for name, _ in checks}:
        raise ValueError("Dataset và runner phải có cùng kịch bản duy nhất.")
    if {item["tier"] for item in definitions} != {"standard", "edge_failure", "adversarial_security"}:
        raise ValueError("Dataset phải có đủ ba tầng đánh giá.")
    cases = [scenario(definition_by_id[name], run_case) for name, run_case in checks]
    metrics = {
        "scenario_count": len(cases),
        "expected_outcome_rate": sum(case["passed"] for case in cases) / len(cases),
        "successful_workflow_rate": 1.0 if cases[0]["passed"] else 0.0,
        "model_calls": sum(case["model_calls"] for case in cases),
        "tool_calls": sum(case["tool_calls"] for case in cases),
        "tool_validated_calls": sum(case["tool_validated_calls"] for case in cases),
        "tool_rejected_calls": sum(case["tool_rejected_calls"] for case in cases),
        "tool_runtime_errors": sum(case["tool_runtime_errors"] for case in cases),
        "tool_results": sum(case["tool_results"] for case in cases),
        "tool_result_rate": round(sum(case["tool_results"] for case in cases) / sum(case["tool_calls"] for case in cases), 4),
        "input_tokens": sum(case["input_tokens"] for case in cases),
        "output_tokens": sum(case["output_tokens"] for case in cases),
        "model_latency_ms": sum(case["model_latency_ms"] for case in cases),
        "estimated_model_cost_usd": round(sum(case["estimated_model_cost_usd"] for case in cases), 8),
        "mean_latency_ms": round(sum(case["latency_ms"] for case in cases) / len(cases), 2),
        "p50_latency_ms": percentile([case["latency_ms"] for case in cases], 0.5),
        "p95_latency_ms": percentile([case["latency_ms"] for case in cases], 0.95),
        "min_latency_ms": min(case["latency_ms"] for case in cases),
        "max_latency_ms": max(case["latency_ms"] for case in cases),
    }
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text(json.dumps({"model": "scripted-mock", "metrics": metrics, "cases": cases}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{sum(case['passed'] for case in cases)}/{len(cases)} expected outcomes; report: {REPORT}")
    if not all(case["passed"] for case in cases):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
