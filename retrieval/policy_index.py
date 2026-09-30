"""Small, auditable RAG index for the course-demo Procurement policy corpus."""

from __future__ import annotations

import hashlib
import json
import math
import re
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from upstage_client import get_upstage_client


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INDEX = ROOT / "data" / "policy_index.sqlite3"
SOURCES = ("docs/business_rules.md", "docs/demo_policy.md")
PASSAGE_MODEL = "solar-embedding-2-passage"
QUERY_MODEL = "solar-embedding-2-query"
STOP_WORDS = {"và", "hoặc", "của", "cho", "được", "không", "trong", "có", "là", "với", "một", "các", "nếu", "tôi", "muốn", "hỏi", "quy", "định"}


class RetrievalError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class PolicyChunk:
    citation_id: str
    text: str
    source_path: str
    line_start: int
    line_end: int
    section: str

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.text.encode("utf-8")).hexdigest()


class Embedder(Protocol):
    passage_model: str
    query_model: str

    def embed_passages(self, texts: list[str]) -> list[list[float]]: ...
    def embed_query(self, text: str) -> list[float]: ...


class UpstageEmbedder:
    passage_model = PASSAGE_MODEL
    query_model = QUERY_MODEL

    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        response = get_upstage_client().embeddings.create(model=self.passage_model, input=texts, timeout=15)
        return [list(item.embedding) for item in sorted(response.data, key=lambda item: item.index)]

    def embed_query(self, text: str) -> list[float]:
        response = get_upstage_client().embeddings.create(model=self.query_model, input=text, timeout=10)
        return list(response.data[0].embedding)


def load_policy_chunks(root: Path = ROOT) -> list[PolicyChunk]:
    chunks: list[PolicyChunk] = []
    rules = (root / SOURCES[0]).read_text(encoding="utf-8").splitlines()
    for line_number, line in enumerate(rules, 1):
        match = re.match(r"^\|\s*(BR\d{2})\s*\|\s*(.*?)\s*\|\s*$", line)
        if match:
            chunks.append(PolicyChunk(match.group(1), match.group(2), SOURCES[0], line_number, line_number, "Quy tắc mua sắm"))
    demo = (root / SOURCES[1]).read_text(encoding="utf-8").splitlines()
    demo_index = 0
    for line_number, line in enumerate(demo, 1):
        if not line.startswith("|") or line.startswith("| ---") or line.startswith("| Quy tắc"):
            continue
        cells = [cell.strip() for cell in line.strip("|").split("|")]
        if len(cells) != 2 or not all(cells):
            continue
        demo_index += 1
        chunks.append(PolicyChunk(f"DP{demo_index:02d}", f"{cells[0]}: {cells[1]}", SOURCES[1], line_number, line_number, "Chính sách demo"))
    if not chunks:
        raise RetrievalError("EMPTY_CORPUS", "Không có quy tắc mua sắm để lập chỉ mục.")
    return chunks


def _unit_vector(values: list[float]) -> list[float]:
    if not values or any(not isinstance(value, (int, float)) or not math.isfinite(value) for value in values):
        raise RetrievalError("INVALID_EMBEDDING", "Vector truy xuất không hợp lệ.")
    norm = math.sqrt(sum(value * value for value in values))
    if norm <= 0:
        raise RetrievalError("INVALID_EMBEDDING", "Vector truy xuất không hợp lệ.")
    return [float(value) / norm for value in values]


def _keywords(text: str) -> set[str]:
    return {token for token in re.findall(r"[\w]+", text.casefold()) if len(token) >= 2 and token not in STOP_WORDS}


class PolicyIndex:
    def __init__(self, path: Path = DEFAULT_INDEX):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("""
                CREATE TABLE IF NOT EXISTS policy_chunks (
                    citation_id TEXT PRIMARY KEY,
                    text TEXT NOT NULL,
                    source_path TEXT NOT NULL,
                    line_start INTEGER NOT NULL,
                    line_end INTEGER NOT NULL,
                    section TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    embedding_model TEXT NOT NULL,
                    vector_json TEXT NOT NULL,
                    indexed_at TEXT NOT NULL
                )
            """)

    def index(self, embedder: Embedder, root: Path = ROOT) -> dict[str, int]:
        chunks = load_policy_chunks(root)
        with closing(sqlite3.connect(self.path)) as db, db:
            existing = {row[0]: (row[1], row[2]) for row in db.execute(
                "SELECT citation_id, content_hash, embedding_model FROM policy_chunks"
            )}
            changed = [chunk for chunk in chunks if existing.get(chunk.citation_id) != (chunk.content_hash, embedder.passage_model)]
            vectors = embedder.embed_passages([chunk.text for chunk in changed])
            if len(vectors) != len(changed):
                raise RetrievalError("EMBEDDING_COUNT", "Số vector không khớp số đoạn văn bản.")
            dimensions = {len(vector) for vector in vectors}
            if len(dimensions) > 1:
                raise RetrievalError("EMBEDDING_DIMENSION", "Vector có số chiều không thống nhất.")
            for chunk, vector in zip(changed, vectors):
                normalized = _unit_vector(vector)
                db.execute("""
                    INSERT INTO policy_chunks VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(citation_id) DO UPDATE SET
                      text=excluded.text, source_path=excluded.source_path,
                      line_start=excluded.line_start, line_end=excluded.line_end,
                      section=excluded.section, content_hash=excluded.content_hash,
                      embedding_model=excluded.embedding_model, vector_json=excluded.vector_json,
                      indexed_at=excluded.indexed_at
                """, (chunk.citation_id, chunk.text, chunk.source_path, chunk.line_start,
                      chunk.line_end, chunk.section, chunk.content_hash, embedder.passage_model,
                      json.dumps(normalized), datetime.now(timezone.utc).isoformat(timespec="seconds")))
            ids = {chunk.citation_id for chunk in chunks}
            removed = [citation_id for citation_id in existing if citation_id not in ids]
            for citation_id in removed:
                db.execute("DELETE FROM policy_chunks WHERE citation_id = ?", (citation_id,))
        return {"chunks": len(chunks), "embedded": len(changed), "removed": len(removed)}

    def search(self, query: str, embedder: Embedder, *, top_k: int = 3, min_similarity: float = 0.45) -> list[dict]:
        if not isinstance(query, str) or not query.strip() or len(query) > 1000:
            raise RetrievalError("INVALID_QUERY", "Câu hỏi tra cứu không hợp lệ.")
        if not 1 <= top_k <= 10:
            raise RetrievalError("INVALID_LIMIT", "Số kết quả tra cứu không hợp lệ.")
        with closing(sqlite3.connect(self.path)) as db:
            db.row_factory = sqlite3.Row
            rows = db.execute("SELECT * FROM policy_chunks WHERE embedding_model = ?", (embedder.passage_model,)).fetchall()
        if not rows:
            raise RetrievalError("INDEX_EMPTY", "Kho quy định chưa được lập chỉ mục.")
        query_vector = _unit_vector(embedder.embed_query(query.strip()))
        query_terms = _keywords(query)
        scored = []
        for row in rows:
            vector = json.loads(row["vector_json"])
            if len(vector) != len(query_vector):
                raise RetrievalError("EMBEDDING_DIMENSION", "Vector truy xuất không cùng số chiều.")
            similarity = sum(a * b for a, b in zip(query_vector, vector))
            if similarity < min_similarity:
                continue
            overlap = len(query_terms & _keywords(row["text"])) / max(len(query_terms), 1)
            scored.append({
                "citation_id": row["citation_id"], "text": row["text"],
                "source_path": row["source_path"], "line_start": row["line_start"],
                "line_end": row["line_end"], "section": row["section"],
                "similarity": round(similarity, 4), "score": round(similarity + 0.02 * overlap, 4),
            })
        return sorted(scored, key=lambda item: (-item["score"], item["citation_id"]))[:top_k]


def grounded_policy_answer(hits: list[dict]) -> dict:
    """Extractive synthesis avoids adding facts the retrieved snippets cannot support."""
    if not hits:
        return {"kind": "not_found", "message": "Không tìm thấy quy định mua sắm phù hợp trong tài liệu đã lập chỉ mục.", "citations": []}
    citations = [{key: hit[key] for key in ("citation_id", "source_path", "line_start", "line_end")}
                 for hit in hits]
    translations = (
        ("Product Catalogue", "danh mục sản phẩm"),
        ("Purchase Request", "yêu cầu mua sắm"),
        ("Department Budget", "ngân sách phòng ban"),
        ("Employee", "Nhân viên"), ("Manager", "Quản lý"),
        ("Quantity", "Số lượng"), ("Product", "Sản phẩm"),
        ("Budget", "Ngân sách"), ("Agent", "Trợ lý"),
        ("approve", "phê duyệt"), ("reject", "từ chối"),
        ("submit", "gửi"),
    )
    def display_text(source_text: str) -> str:
        for original, vietnamese in translations:
            source_text = re.sub(rf"\b{re.escape(original)}\b", vietnamese, source_text, flags=re.IGNORECASE)
        return source_text

    message = "Quy định liên quan:\n" + "\n".join(
        f"- {display_text(hit['text'])} [{hit['citation_id']}]" for hit in hits
    )
    return {"kind": "answer", "message": message, "citations": citations}
