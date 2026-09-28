"""Điểm bắt đầu của prototype Business Procurement Agent."""

import sys

from agent import diagnose_tool_calling


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def main() -> None:
    current_user_id = "EMP002"
    prompt = "Tôi cần mua 5 màn hình 27 inch cho team."

    print("=== DIRECT UPSTAGE TOOL CALLING TEST ===")

    try:
        diagnose_tool_calling(prompt, current_user_id)
    except Exception as error:
        print(f"\n[AGENT ERROR] {error}")


if __name__ == "__main__":
    main()
