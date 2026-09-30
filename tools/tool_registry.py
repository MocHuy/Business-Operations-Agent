"""Schema và dispatcher cho các business tool của agent."""

from typing import Any

from tools.budget_tools import get_department_budget
from tools.product_tools import search_products
from tools.user_tools import get_user_profile


TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "get_user_profile",
            "description": (
                "Đọc profile của user hiện tại từ business data. "
                "Application tự cung cấp user hiện tại; không truyền user_id."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_department_budget",
            "description": (
                "Đọc ngân sách thật của department từ business data. "
                "Không tự bịa hoặc tự tạo budget nếu không có dữ liệu."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "department_id": {
                        "type": "string",
                        "description": "Mã department cần xem ngân sách.",
                    }
                },
                "required": ["department_id"],
                "additionalProperties": False,
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_products",
            "description": (
                "Tìm sản phẩm trong Product Catalogue đã được công ty phê duyệt. "
                "Không tự bịa sản phẩm hoặc giá; có thể lọc theo ngân sách tổng."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "category": {"type": "string", "enum": ["monitor", "laptop", "keyboard", "mouse"],
                                 "description": "Mã loại trong catalogue: monitor=màn hình, laptop=máy tính xách tay, keyboard=bàn phím, mouse=chuột."},
                    "quantity": {"type": "integer", "description": "Số lượng cần mua."},
                    "specifications": {
                        "type": "string",
                        "description": "Yêu cầu kỹ thuật cần tìm, nếu có.",
                    },
                    "max_total_price": {
                        "type": "number",
                        "description": "Ngân sách tối đa cho toàn bộ số lượng, nếu biết.",
                    },
                },
                "required": ["category", "quantity"],
                "additionalProperties": False,
            },
        },
    },
]


def execute_tool(
    tool_name: str, arguments: dict[str, Any], current_user_id: str
) -> dict[str, Any]:
    """Thực thi đúng business function tương ứng với tên tool đã đăng ký."""
    if tool_name == "get_user_profile":
        return get_user_profile(current_user_id)

    if tool_name == "get_department_budget":
        department_id = arguments.get("department_id")
        if not isinstance(department_id, str) or not department_id:
            raise ValueError("get_department_budget cần department_id dạng string")
        return get_department_budget(department_id)

    if tool_name == "search_products":
        category = arguments.get("category")
        quantity = arguments.get("quantity")
        if not isinstance(category, str) or not category:
            raise ValueError("search_products cần category dạng string")
        if not isinstance(quantity, int) or isinstance(quantity, bool):
            raise ValueError("search_products cần quantity dạng integer")
        return search_products(
            category,
            quantity,
            arguments.get("specifications"),
            arguments.get("max_total_price"),
        )

    raise ValueError(f"Tool không được đăng ký: {tool_name}")
