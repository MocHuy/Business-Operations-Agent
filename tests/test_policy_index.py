"""Retrieval checks independent of an Upstage key or external network."""

from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend_api import create_app
from retrieval.policy_agent import PolicyRetrievalHarness
from retrieval.policy_index import ROOT, PolicyIndex, RetrievalError, grounded_policy_answer, load_policy_chunks


class FakeEmbedder:
    passage_model = "mock-passage"
    query_model = "mock-query"

    def __init__(self) -> None:
        self.embedded = 0

    @staticmethod
    def vector(text: str) -> list[float]:
        lower = text.casefold()
        words = (
            ("ngân sách", "budget"),
            ("duyệt", "approve", "phê duyệt"),
            ("số lượng", "quantity"),
            ("sản phẩm", "product", "catalogue"),
            ("tài khoản", "quyền", "permission"),
        )
        values = [0.1] + [float(any(word in lower for word in aliases)) for aliases in words] + [0.0]
        if all(value == 0 for value in values[1:-1]):
            values[-1] = 1.0 if "bảo hiểm" in lower else 0.0
        return values

    def embed_passages(self, texts: list[str]) -> list[list[float]]:
        self.embedded += len(texts)
        return [self.vector(text) for text in texts]

    def embed_query(self, text: str) -> list[float]:
        return self.vector(text)


class PolicyIndexTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "docs").mkdir()
        for name in ("business_rules.md", "demo_policy.md"):
            shutil.copy2(ROOT / "docs" / name, self.root / "docs" / name)
        self.index = PolicyIndex(self.root / "policy.sqlite3")
        self.embedder = FakeEmbedder()

    def test_ingest_chunk_index_retrieve_cite_and_not_found(self) -> None:
        chunks = load_policy_chunks(self.root)
        self.assertGreaterEqual(len(chunks), 15)
        self.assertEqual([item.citation_id for item in chunks[:2]], ["BR01", "BR02"])
        report = self.index.index(self.embedder, self.root)
        self.assertEqual(report, {"chunks": len(chunks), "embedded": len(chunks), "removed": 0})
        self.assertEqual(self.index.index(self.embedder, self.root)["embedded"], 0)

        hits = self.index.search("Ngân sách mua sắm vượt hạn mức?", self.embedder, top_k=5)
        self.assertIn("BR05", {item["citation_id"] for item in hits})
        br05 = next(item for item in hits if item["citation_id"] == "BR05")
        self.assertEqual(br05["source_path"], "docs/business_rules.md")
        self.assertEqual(br05["line_start"], br05["line_end"])
        self.assertIn("BR05", (self.root / br05["source_path"]).read_text(encoding="utf-8").splitlines()[br05["line_start"] - 1])
        answer = grounded_policy_answer([br05])
        self.assertEqual(answer["kind"], "answer")
        self.assertIn("[BR05]", answer["message"])
        self.assertEqual(answer["citations"][0]["citation_id"], "BR05")
        self.assertNotIn("Department Budget", answer["message"])

        absent = self.index.search("Bảo hiểm nha khoa gia đình", self.embedder)
        self.assertEqual(absent, [])
        self.assertEqual(grounded_policy_answer(absent)["kind"], "not_found")

    def test_changed_source_reembeds_and_removed_chunk_is_deleted(self) -> None:
        self.index.index(self.embedder, self.root)
        source = self.root / "docs" / "business_rules.md"
        content = source.read_text(encoding="utf-8")
        source.write_text(content.replace("không được vượt Department Budget", "không được vượt ngân sách phòng ban"), encoding="utf-8")
        self.assertEqual(self.index.index(self.embedder, self.root)["embedded"], 1)
        source.write_text(source.read_text(encoding="utf-8").replace(
            "| BR10 | Hành động nhạy cảm phải đi qua Harness. Trong MVP, việc tạo, submit và approve/reject PR được xem là hành động nhạy cảm. |\n", ""
        ), encoding="utf-8")
        report = self.index.index(self.embedder, self.root)
        self.assertEqual(report["removed"], 1)

    def test_invalid_input_and_embedding_are_rejected(self) -> None:
        self.index.index(self.embedder, self.root)
        with self.assertRaises(RetrievalError) as invalid:
            self.index.search("", self.embedder)
        self.assertEqual(invalid.exception.code, "INVALID_QUERY")

        class BadEmbedder(FakeEmbedder):
            passage_model = "bad-passage"

            def embed_passages(self, texts: list[str]) -> list[list[float]]:
                return [[float("nan")] for _ in texts]

        with self.assertRaises(RetrievalError) as bad:
            self.index.index(BadEmbedder(), self.root)
        self.assertEqual(bad.exception.code, "INVALID_EMBEDDING")

    def test_harness_checks_current_source_and_api_requires_login(self) -> None:
        self.index.index(self.embedder, self.root)
        harness = PolicyRetrievalHarness(self.index, self.embedder, self.root)
        answer = harness.answer("Ngân sách mua sắm vượt hạn mức?")
        self.assertEqual(answer["trace"][1], {"step": "verify_citations", "result": "PASS"})
        self.assertTrue(answer["citations"])

        app = create_app(db_path=self.root / "procurement.sqlite3",
                         policy_index_path=self.index.path, policy_embedder=self.embedder)
        app.state.policy_harness.root = self.root
        with TestClient(app) as client:
            self.assertEqual(client.post("/api/agent/policy", json={"message": "Ngân sách mua sắm?"}).status_code, 401)
            login = client.post("/api/auth/login", json={"username": "nhanvien2", "password": "123"})
            self.assertEqual(login.status_code, 200)
            headers = {"Authorization": f"Bearer {login.json()['token']}"}
            response = client.post("/api/agent/policy", headers=headers, json={"message": "Ngân sách mua sắm vượt hạn mức?"})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertEqual(response.json()["kind"], "answer")
            self.assertIn("BR05", {item["citation_id"] for item in response.json()["citations"]})

            source = self.root / "docs" / "business_rules.md"
            source.write_text(source.read_text(encoding="utf-8").replace(
                "không được vượt Department Budget", "không được vượt ngân sách phòng ban"
            ), encoding="utf-8")
            stale = client.post("/api/agent/policy", headers=headers, json={"message": "Ngân sách mua sắm vượt hạn mức?"})
            self.assertEqual(stale.status_code, 503)
            self.assertEqual(stale.json()["detail"]["code"], "INDEX_STALE")

            source.unlink()
            unavailable = client.post("/api/agent/policy", headers=headers, json={"message": "Ngân sách mua sắm vượt hạn mức?"})
            self.assertEqual(unavailable.status_code, 503)
            self.assertEqual(unavailable.json()["detail"]["code"], "SOURCE_UNAVAILABLE")
