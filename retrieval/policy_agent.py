"""Read-only policy retrieval harness with source-backed citations."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from retrieval.policy_index import (
    ROOT, Embedder, PolicyIndex, RetrievalError, UpstageEmbedder,
    grounded_policy_answer, load_policy_chunks,
)


class PolicyRetrievalHarness:
    def __init__(self, index: PolicyIndex | None = None, embedder: Embedder | None = None, root: Path = ROOT):
        self.index = index or PolicyIndex()
        self.embedder = embedder or UpstageEmbedder()
        self.root = root

    def answer(self, query: str) -> dict[str, Any]:
        try:
            hits = self.index.search(query, self.embedder, top_k=3)
        except RetrievalError:
            raise
        except Exception as error:
            raise RetrievalError("RETRIEVAL_UNAVAILABLE", "Chưa thể tra cứu quy định. Vui lòng thử lại.") from error

        try:
            current = {chunk.citation_id: chunk for chunk in load_policy_chunks(self.root)}
        except (OSError, UnicodeError) as error:
            raise RetrievalError("SOURCE_UNAVAILABLE", "Chưa thể kiểm chứng tài liệu quy định gốc.") from error
        for hit in hits:
            chunk = current.get(hit["citation_id"])
            if chunk is None or any((
                hit["text"] != chunk.text,
                hit["source_path"] != chunk.source_path,
                hit["line_start"] != chunk.line_start,
                hit["line_end"] != chunk.line_end,
            )):
                raise RetrievalError("INDEX_STALE", "Kho quy định đã thay đổi. Vui lòng lập chỉ mục lại.")
        answer = grounded_policy_answer(hits)
        return {"skill": "Policy Knowledge", **answer, "trace": [
            {"step": "retrieve", "result_ids": [hit["citation_id"] for hit in hits]},
            {"step": "verify_citations", "result": "PASS"},
            {"step": "ground", "result": answer["kind"]},
        ]}
