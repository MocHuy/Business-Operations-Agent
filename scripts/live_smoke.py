"""Optional live Upstage + API smoke in a temporary SQLite database.

Run from repository root with the local virtual environment's Python.
The script reads the API key through the normal server configuration and never
prints tokens, credentials, model prose or raw user prompts.
"""

from __future__ import annotations

import json
import os
import sqlite3
import sys
from contextlib import closing
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from procurement_store import DEMO_PASSWORD  # noqa: E402


PROMPTS = [
    "Tôi cần mua 5 màn hình 27 inch cho nhóm phát triển.",
    "Mua 5 monitor 27 inch cho đội phát triển; chọn loại phù hợp ngân sách.",
    "Cần 5 cái OfficeView 27 Monitor, mã MON-27-002, cho nhóm phát triển.",
]


def main() -> int:
    report: dict = {"database": "temporary SQLite", "live_model": "Upstage", "attempt_kinds": []}
    with TemporaryDirectory() as directory:
        path = Path(directory) / "live_e2e.sqlite3"
        # backend_api exports an app at import time, so point even that app at this temp DB.
        os.environ["PROCUREMENT_DB_PATH"] = str(path)
        from backend_api import create_app

        app = create_app(path)
        with TestClient(app) as client:
            employee = client.post(
                "/api/auth/login", json={"username": "nhanvien2", "password": DEMO_PASSWORD}
            ).json()
            employee_headers = {"Authorization": "Bearer " + employee["token"]}
            initial_budget = app.state.store.budget("DEP001")["available_amount"]
            proposal = None
            for prompt in PROMPTS:
                result = client.post(
                    "/api/agent/procurement", json={"message": prompt}, headers=employee_headers
                )
                answer = result.json()
                report["attempt_kinds"].append(answer.get("kind"))
                if answer.get("kind") == "proposal":
                    proposal = answer
                    break
            report["attempts"] = len(report["attempt_kinds"])
            if proposal:
                product_id = proposal["proposal"]["products"][0]["product_id"]
                report["selected_product_id"] = product_id
                confirmation = client.post(
                    f"/api/agent/procurement/{proposal['session_id']}/confirm",
                    json={"product_id": product_id, "confirmed": True},
                    headers=employee_headers,
                )
                report["confirm_http"] = confirmation.status_code
                if confirmation.status_code == 200:
                    request = confirmation.json()["request"]
                    report["request_id"] = request["id"]
                    report["submitted_status"] = request["status"]
                    report["total_price_vnd"] = request["total_price"]
                    manager = client.post(
                        "/api/auth/login", json={"username": "quanly1", "password": DEMO_PASSWORD}
                    ).json()
                    manager_headers = {"Authorization": "Bearer " + manager["token"]}
                    pending = client.get("/api/approvals", headers=manager_headers).json()
                    report["manager_saw_pending"] = request["id"] in [item["id"] for item in pending]
                    decision = client.post(
                        f"/api/procurement/{request['id']}/decision",
                        json={"decision": "approve", "confirmed": True},
                        headers=manager_headers,
                    )
                    report["decision_http"] = decision.status_code
                    persisted = client.get(
                        f"/api/procurement/{request['id']}", headers=employee_headers
                    ).json()
                    report["final_status"] = persisted["status"]
                    report["budget_delta_vnd"] = initial_budget - app.state.store.budget("DEP001")["available_amount"]
                    report["budget_matches_price"] = report["budget_delta_vnd"] == request["total_price"]
        with closing(sqlite3.connect(path)) as db:
            model_events = [
                json.loads(row[0]) for row in db.execute(
                    "SELECT details_json FROM trace_events WHERE event = 'model' ORDER BY id"
                )
            ]
            report["model_calls"] = len(model_events)
            report["input_tokens"] = sum(event["prompt_tokens"] for event in model_events)
            report["output_tokens"] = sum(event["completion_tokens"] for event in model_events)
            report["audit_actions"] = [row[0] for row in db.execute("SELECT action FROM audit_events ORDER BY id")]
            report["request_rows"] = db.execute("SELECT count(*) FROM requests").fetchone()[0]
    output = Path(__file__).resolve().parents[1] / "reports" / "live-smoke.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=True))
    return 0 if report.get("final_status") == "APPROVED" and report.get("budget_matches_price") else 1


if __name__ == "__main__":
    raise SystemExit(main())
