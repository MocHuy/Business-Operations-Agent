"""Preview or execute retention cleanup for the course-demo Procurement database."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from procurement_store import DEFAULT_DB, ProcurementStore


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Dọn phiên hết hạn và checkpoint/trace quá 30 ngày.")
    parser.add_argument("--db", type=Path, default=DEFAULT_DB)
    parser.add_argument("--execute", action="store_true", help="Thực sự xóa các bản ghi hết hạn.")
    args = parser.parse_args()
    result = ProcurementStore(args.db).prune_operational_data(execute=args.execute)
    print(json.dumps({"mode": "execute" if args.execute else "preview", "deleted_or_eligible": result}, ensure_ascii=False))


if __name__ == "__main__":
    main()
