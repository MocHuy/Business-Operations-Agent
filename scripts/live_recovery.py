"""Exercise a real Upstage interruption and checkpoint recovery on disposable SQLite.

The injected KeyboardInterrupt occurs immediately after the first paid model
result and its trace have committed. No credentials or model prose are reported.
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

from dotenv import load_dotenv

from procurement_agent import AgentHarness
from procurement_store import ProcurementStore


ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "reports" / "live-recovery.json"
INITIAL_NEED = "Mua 2 màn hình 27 inch cho nhóm phát triển; chọn sản phẩm trong ngân sách."
FOLLOWUP = "Tôi cần đúng 2 màn hình 27 inch cho nhóm phát triển."


def one_trial(iteration: int) -> dict:
    with TemporaryDirectory() as directory:
        store = ProcurementStore(Path(directory) / "recovery.sqlite3")
        employee = store.user("EMP001")
        manager = store.user("MGR001")
        harness = AgentHarness(store)
        before = store.budget("DEP001")["available_amount"]
        original_checkpoint = store.checkpoint_model_result
        interrupted = False

        def interrupt_after_commit(*args):
            nonlocal interrupted
            original_checkpoint(*args)
            interrupted = True
            raise KeyboardInterrupt("mô phỏng tiến trình ngắt sau checkpoint")

        store.checkpoint_model_result = interrupt_after_commit
        try:
            harness.run(employee, INITIAL_NEED)
        except KeyboardInterrupt:
            pass
        finally:
            store.checkpoint_model_result = original_checkpoint

        with closing(sqlite3.connect(store.db_path)) as db:
            db.row_factory = sqlite3.Row
            session = db.execute("SELECT id FROM agent_sessions ORDER BY updated_at DESC LIMIT 1").fetchone()
            session_id = session["id"] if session else None
            model_rows_before = db.execute("SELECT count(*) FROM trace_events WHERE event = 'model'").fetchone()[0]
            requests_before = db.execute("SELECT count(*) FROM requests").fetchone()[0]
        checkpoint = store.agent_state(employee["user_id"], session_id) if session_id else {}
        checkpoint_valid = (
            interrupted and checkpoint.get("phase") == "RUNNING"
            and checkpoint.get("token_total", 0) > 0 and model_rows_before == 1
            and requests_before == 0
        )
        kinds = []
        result = {}
        if checkpoint_valid:
            result = harness.run(employee, INITIAL_NEED, session_id)
            kinds.append(result.get("kind"))
            for _ in range(2):
                if result.get("kind") != "clarification":
                    break
                result = harness.run(employee, FOLLOWUP, session_id)
                kinds.append(result.get("kind"))

        approved = False
        budget_matches = False
        request_rows = 0
        if result.get("kind") == "proposal" and result.get("proposal", {}).get("quantity") == 2:
            product = next((item for item in result["proposal"]["products"] if item["category"] == "monitor"), None)
            if product:
                request = store.confirm_agent_proposal(employee, session_id, product["product_id"])
                pending = store.list_approvals(manager)
                if request["id"] in {item["id"] for item in pending}:
                    store.decide(manager, request["id"], "approve", None)
                    persisted = store.get_request(employee, request["id"])
                    budget_matches = before - store.budget("DEP001")["available_amount"] == request["total_price"]
                    approved = persisted["status"] == "APPROVED" and budget_matches

        with closing(sqlite3.connect(store.db_path)) as db:
            recovery_events = db.execute("SELECT count(*) FROM trace_events WHERE event = 'recovery'").fetchone()[0]
            model_calls = db.execute("SELECT count(*) FROM trace_events WHERE event = 'model'").fetchone()[0]
            request_rows = db.execute("SELECT count(*) FROM requests").fetchone()[0]
            audit_actions = [row[0] for row in db.execute("SELECT action FROM audit_events ORDER BY id")]
        success = checkpoint_valid and recovery_events >= 1 and approved and request_rows == 1
        return {
            "iteration": iteration, "checkpoint_valid": checkpoint_valid,
            "checkpoint_tokens": checkpoint.get("token_total", 0),
            "checkpoint_steps": checkpoint.get("steps", 0),
            "model_calls": model_calls, "recovery_events": recovery_events,
            "attempt_kinds": kinds, "final_error_code": result.get("error_code"),
            "request_rows": request_rows, "approved": approved,
            "budget_matches_request": budget_matches,
            "audit_actions": audit_actions, "success": success,
        }


def main() -> int:
    parser = argparse.ArgumentParser(description="Kiểm thử phục hồi Upstage live sau ngắt tiến trình.")
    parser.add_argument("--model", choices=["solar-mini4", "solar-pro4"])
    parser.add_argument("--attempts", type=int, default=3)
    parser.add_argument("--report", type=Path, default=REPORT)
    args = parser.parse_args()
    if not 1 <= args.attempts <= 5:
        parser.error("--attempts phải trong khoảng 1–5")
    load_dotenv()
    if args.model:
        os.environ["UPSTAGE_MODEL"] = args.model
    if not os.getenv("UPSTAGE_API_KEY"):
        parser.error("Thiếu UPSTAGE_API_KEY để chạy Upstage thật.")
    trials = []
    for iteration in range(1, args.attempts + 1):
        trial = one_trial(iteration)
        trials.append(trial)
        print(f"Trial {iteration}: {'PASS' if trial['success'] else 'FAIL'} {trial['attempt_kinds']}")
        if trial["success"]:
            break
    report = {"model": os.getenv("UPSTAGE_MODEL", "solar-pro4"),
              "database": "temporary SQLite per trial", "trials": trials,
              "verified_recovery": any(item["success"] for item in trials)}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Report: {args.report}")
    return 0 if report["verified_recovery"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
