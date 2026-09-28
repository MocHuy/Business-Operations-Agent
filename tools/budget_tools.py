"""Business tool đọc department và budget từ dữ liệu local."""

import json
from pathlib import Path


DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DEPARTMENTS_FILE = DATA_DIR / "departments.json"
BUDGETS_FILE = DATA_DIR / "budgets.json"


def get_department_budget(department_id: str) -> dict:
    """Trả về budget của department hoặc báo lỗi nếu dữ liệu không tồn tại."""
    with DEPARTMENTS_FILE.open(encoding="utf-8") as file:
        departments = json.load(file)

    department = departments.get(department_id)
    if department is None:
        raise ValueError(f"Department không tồn tại: {department_id}")

    with BUDGETS_FILE.open(encoding="utf-8") as file:
        budgets = json.load(file)

    budget = budgets.get(department_id)
    if budget is None:
        raise ValueError(f"Department chưa có budget: {department_id}")

    return {
        "department_id": department_id,
        "department_name": department["name"],
        "total_budget": budget["total_budget"],
        "spent_amount": budget["spent_amount"],
        "available_amount": budget["available_amount"],
    }
