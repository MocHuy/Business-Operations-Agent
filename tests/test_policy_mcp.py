"""Protocol-level checks using the official in-process MCP client."""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from mcp import Client

from mcp_policy import build_server
from retrieval.policy_agent import PolicyRetrievalHarness
from retrieval.policy_index import ROOT, PolicyIndex
from tests.test_policy_index import FakeEmbedder


class PolicyMcpTests(unittest.IsolatedAsyncioTestCase):
    async def test_tool_discovery_call_citation_and_error(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "docs").mkdir()
            for name in ("business_rules.md", "demo_policy.md"):
                shutil.copy2(ROOT / "docs" / name, root / "docs" / name)
            index = PolicyIndex(root / "index.sqlite3")
            embedder = FakeEmbedder()
            index.index(embedder, root)
            server = build_server(PolicyRetrievalHarness(index, embedder, root))

            async with Client(server, raise_exceptions=True) as client:
                tools = await client.list_tools()
                self.assertEqual([tool.name for tool in tools.tools], ["search_procurement_policy"])
                schema = tools.tools[0].input_schema
                self.assertIn("query", schema["properties"])
                self.assertIn("query", schema["required"])

                result = await client.call_tool("search_procurement_policy", {"query": "Ngân sách mua sắm vượt hạn mức?"})
                self.assertFalse(result.is_error)
                answer = result.structured_content
                self.assertEqual(answer["kind"], "answer")
                self.assertIn("BR05", {citation["citation_id"] for citation in answer["citations"]})
                self.assertEqual(answer["trace"][1]["result"], "PASS")

                bad = await client.call_tool("search_procurement_policy", {"query": ""})
                self.assertTrue(bad.is_error)
                unknown = await client.call_tool("create_procurement", {})
                self.assertTrue(unknown.is_error)
