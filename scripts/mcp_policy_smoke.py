"""Exercise the real MCP client/server protocol with live policy embeddings."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from mcp import Client

from mcp_policy import build_server
from retrieval.policy_index import ROOT


async def run(report_path: Path = ROOT / "reports" / "mcp-policy-trace.json") -> dict:
    async with Client(build_server()) as client:
        tools = await client.list_tools()
        advertised = [tool.name for tool in tools.tools]
        result = await client.call_tool(
            "search_procurement_policy",
            {"query": "Quy định mua sắm vượt ngân sách phòng ban thế nào?"},
        )
        structured = result.structured_content or {}
        if "result" in structured:
            structured = structured["result"]
        trace = {
            "protocol_version": client.protocol_version,
            "server_name": client.server_info.name if client.server_info else None,
            "advertised_tools": advertised,
            "call": "search_procurement_policy",
            "is_error": bool(result.is_error),
            "result_kind": structured.get("kind"),
            "citation_ids": [item["citation_id"] for item in structured.get("citations", [])],
            "harness_steps": structured.get("trace", []),
        }
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(trace, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if result.is_error or "BR05" not in trace["citation_ids"]:
            raise RuntimeError("Tra cứu qua MCP không xác minh được quy tắc ngân sách.")
        return trace


if __name__ == "__main__":
    trace = asyncio.run(run())
    print(json.dumps({"protocol_version": trace["protocol_version"], "citation_ids": trace["citation_ids"]}, ensure_ascii=True))
