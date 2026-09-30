"""Evaluate live Upstage policy retrieval on a fixed, inspectable query set."""

from __future__ import annotations

import json
import statistics
from pathlib import Path

from retrieval.policy_agent import PolicyRetrievalHarness
from retrieval.policy_index import ROOT


def run(report_path: Path = ROOT / "reports" / "eval-rag.json") -> dict:
    cases = json.loads((ROOT / "evals" / "rag_cases.json").read_text(encoding="utf-8"))
    harness = PolicyRetrievalHarness()
    rows = []
    for case in cases:
        answer = harness.answer(case["query"])
        retrieved = [citation["citation_id"] for citation in answer["citations"]]
        relevant = set(case["relevant"])
        correct = len(set(retrieved) & relevant)
        expected_empty = not relevant
        precision = correct / len(retrieved) if retrieved else float(expected_empty)
        recall = correct / len(relevant) if relevant else float(not retrieved)
        citation_grounded = (
            all(f"[{citation_id}]" in answer["message"] for citation_id in retrieved)
            and any(step == {"step": "verify_citations", "result": "PASS"} for step in answer["trace"])
        ) if retrieved else None
        row = {
            "id": case["id"], "retrieved": retrieved,
            "precision_at_3": round(precision, 4), "recall_at_3": round(recall, 4),
            "top1_correct": (retrieved[0] if retrieved else None) == case["expected_top1"],
            "citation_grounded": citation_grounded,
            "not_found_correct": (answer["kind"] == "not_found") if expected_empty else None,
        }
        rows.append(row)
    summary = {
        "cases": len(rows),
        "mean_precision_at_3": round(statistics.mean(row["precision_at_3"] for row in rows), 4),
        "mean_recall_at_3": round(statistics.mean(row["recall_at_3"] for row in rows), 4),
        "top1_correct": sum(row["top1_correct"] for row in rows),
        "citation_grounded": sum(row["citation_grounded"] is True for row in rows),
        "answers_with_citations": sum(bool(row["retrieved"]) for row in rows),
        "not_found_correct": sum(row["not_found_correct"] is True for row in rows),
    }
    output = {"summary": summary, "cases": rows}
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return output


if __name__ == "__main__":
    print(json.dumps(run()["summary"], ensure_ascii=True))
