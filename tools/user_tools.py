"""Business tool đọc thông tin user từ dữ liệu local."""

import json
from pathlib import Path


DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "users.json"


def get_user_profile(user_id: str) -> dict:
    """Trả về profile của user hoặc báo lỗi nếu user không tồn tại."""
    with DATA_FILE.open(encoding="utf-8") as file:
        users = json.load(file)

    user = users.get(user_id)
    if user is None:
        raise ValueError(f"User không tồn tại: {user_id}")

    return {
        "user_id": user_id,
        "name": user["name"],
        "role": user["role"],
        "department_id": user["department_id"],
    }
