"""Read-only MCP prototype exposing the Procurement policy retrieval harness.

Run as a stdio MCP server with ``python -m mcp_policy``. The web application
continues to call the same harness directly; this adapter demonstrates a
standard external tool boundary without exposing mutation or credentials.
"""

from __future__ import annotations

from mcp.server import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from pydantic import BaseModel

from retrieval.policy_agent import PolicyRetrievalHarness
from retrieval.policy_index import RetrievalError


class PolicyAnswer(BaseModel):
    skill: str
    kind: str
    message: str
    citations: list[dict]
    trace: list[dict]


def build_server(harness: PolicyRetrievalHarness | None = None) -> MCPServer:
    policy = harness or PolicyRetrievalHarness()
    server = MCPServer(
        name="Business Operations Policy",
        description="Tra cứu quy định mua sắm nội bộ có nguồn kiểm chứng.",
    )

    @server.tool(name="search_procurement_policy", description="Tra cứu quy định mua sắm; chỉ đọc, trả lời có tệp và dòng nguồn.")
    def search_procurement_policy(query: str) -> PolicyAnswer:
        try:
            return PolicyAnswer(**policy.answer(query))
        except RetrievalError as error:
            raise ToolError(str(error)) from error

    return server


if __name__ == "__main__":
    build_server().run(transport="stdio")
