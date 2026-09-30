"""Index allowlisted Procurement policy documents with Upstage Embed 2."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from dotenv import load_dotenv

from retrieval.policy_index import DEFAULT_INDEX, PolicyIndex, UpstageEmbedder


def main() -> None:
    parser = argparse.ArgumentParser(description="Lập chỉ mục vector quy định mua sắm.")
    parser.add_argument("--db", type=Path, default=DEFAULT_INDEX)
    args = parser.parse_args()
    load_dotenv()
    result = PolicyIndex(args.db).index(UpstageEmbedder())
    print(json.dumps(result, ensure_ascii=True))


if __name__ == "__main__":
    main()
