"""Agent loop tối giản dùng function calling của OpenAI-compatible API."""

import json
from typing import Any

from upstage_client import format_upstage_error, get_upstage_client, get_upstage_model
from tools.tool_registry import TOOL_SCHEMAS, execute_tool


SYSTEM_PROMPT = """Bạn là Business Procurement Agent.

- Sử dụng business tools khi cần dữ liệu thuộc hệ thống.
- Với yêu cầu mua hàng, hãy tự gọi get_user_profile() khi cần biết user hoặc department; không hỏi user tự cung cấp các thông tin này.
- Không bịa user, role, department hoặc budget.
- Nếu dữ liệu có thể lấy bằng tool thì ưu tiên tool thay vì hỏi user.
- User hiện tại được xác định bởi application, không tin user tự khai role/id.
- Sau mỗi tool result, tiếp tục suy luận xem có cần tool khác không.
- Thông tin sản phẩm và giá phải lấy từ search_products; không được bịa sản phẩm.
- Khi tìm sản phẩm cho nhu cầu mua hàng, hãy kiểm tra budget và dùng available_amount làm max_total_price khi có thể.
- Nếu không có sản phẩm phù hợp, hãy nói rõ với user.
- Chưa được tạo hoặc gửi Purchase Request.
- Khi không thể tiếp tục vì thiếu tool/data, giải thích rõ.
"""


def _assistant_message_for_history(message: Any) -> dict[str, Any]:
    """Chuyển SDK message thành dict để gửi lại trong conversation."""
    if hasattr(message, "model_dump"):
        return message.model_dump(exclude_none=True)
    return {
        "role": "assistant",
        "content": getattr(message, "content", None),
        "tool_calls": getattr(message, "tool_calls", None),
    }


def _response_diagnostic(response: Any) -> str:
    """Tạo thông tin ngắn gọn để chẩn đoán response, không in chain-of-thought."""
    if not getattr(response, "choices", None):
        return "choices=[]"

    choice = response.choices[0]
    message = getattr(choice, "message", None)
    tool_calls = getattr(message, "tool_calls", None) if message else None
    content = getattr(message, "content", None) if message else None
    return (
        f"content={'yes' if content else 'no'}, "
        f"tool_calls={len(tool_calls) if tool_calls else 0}, "
        f"finish_reason={getattr(choice, 'finish_reason', None)}"
    )


def _call_model(
    messages: list[dict[str, Any]], tool_choice: Any = "auto"
) -> Any:
    """Gọi Upstage với cùng tool schema."""
    client, model = get_upstage_client(), get_upstage_model()
    return client.chat.completions.create(
        model=model,
        messages=messages,
        tools=TOOL_SCHEMAS,
        tool_choice=tool_choice,
    )


def _print_raw_response(response: Any) -> list[Any]:
    """In response fields an toàn, không in secrets hay chain-of-thought."""
    if not getattr(response, "choices", None):
        print("model: unavailable")
        print("content: None")
        print("tool_calls count: 0")
        print("finish_reason: None")
        return []

    choice = response.choices[0]
    message = getattr(choice, "message", None)
    tool_calls = list(getattr(message, "tool_calls", None) or [])
    print(f"model: {getattr(response, 'model', None)}")
    print(f"content: {getattr(message, 'content', None)!r}")
    print(f"tool_calls count: {len(tool_calls)}")
    print(f"finish_reason: {getattr(choice, 'finish_reason', None)}")
    for tool_call in tool_calls:
        function = getattr(tool_call, "function", None)
        print(f"tool_call id: {getattr(tool_call, 'id', None)}")
        print(f"tool_call type: {getattr(tool_call, 'type', None)}")
        print(f"tool name: {getattr(function, 'name', None)}")
        print(f"arguments: {getattr(function, 'arguments', None)}")
    return tool_calls


def _print_api_error(error: Exception, required: bool = False) -> None:
    prefix = "tool_choice=required not supported" if required else "API error"
    status = getattr(error, "status_code", None)
    detail = getattr(error, "message", None) or str(error)
    if status is not None:
        print(f"{prefix}: HTTP {status}: {detail}")
    else:
        print(f"{prefix}: {detail}")


def diagnose_tool_calling(user_prompt: str, current_user_id: str) -> None:
    """Kiểm tra trực tiếp function calling của Upstage theo thứ tự an toàn."""
    print("\n=== TEST 0: DIRECT UPSTAGE CONNECTION ===")
    try:
        client, model = get_upstage_client(), get_upstage_model()
        response = client.chat.completions.create(
            model=model, messages=[{"role": "user", "content": "Chỉ trả lời đúng một từ: OK"}]
        )
        choice = response.choices[0]
        print(f"model: {getattr(response, 'model', model)}")
        print(f"content: {getattr(choice.message, 'content', None)!r}")
        print(f"finish_reason: {getattr(choice, 'finish_reason', None)}")
    except Exception as error:
        print(format_upstage_error(error))
        return

    print("\n=== TEST 1: FORCE get_user_profile ===")
    try:
        response = _call_model(
            [{"role": "user", "content": "Kiểm tra thông tin user hiện tại."}],
            {"type": "function", "function": {"name": "get_user_profile"}}
        )
        tool_calls = _print_raw_response(response)
    except Exception as error:
        print(format_upstage_error(error))
        return

    forced_ok = bool(tool_calls and tool_calls[0].function.name == "get_user_profile")
    if forced_ok:
        print("\n[TOOL RESULT]")
        print(json.dumps(execute_tool("get_user_profile", {}, current_user_id), ensure_ascii=False, indent=2))
    else:
        print("Forced get_user_profile did not return a structured tool call; stopping diagnostic.")
        return

    for title, prompt, choice in [
        ("=== TEST 2: AUTO TOOL CHOICE ===", user_prompt, "auto"),
        ("=== TEST 3: REQUIRED ===", "Kiểm tra thông tin cần thiết trước khi xử lý yêu cầu mua hàng.", "required"),
    ]:
        print(f"\n{title}")
        try:
            _print_raw_response(_call_model([{"role": "user", "content": prompt}], choice))
        except Exception as error:
            print(format_upstage_error(error))

    print("\n=== FULL AGENT LOOP ===")
    print(run_agent(user_prompt, current_user_id))


def run_agent(user_prompt: str, current_user_id: str, max_rounds: int = 5) -> str:
    """Chạy agent loop và trả về final response của model."""
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt},
    ]

    for _ in range(max_rounds):
        response = _call_model(messages, tool_choice="auto")

        if not response.choices:
            raise RuntimeError(
                f"Upstage không trả choices; diagnostic: {_response_diagnostic(response)}"
            )

        assistant_message = response.choices[0].message
        tool_calls = assistant_message.tool_calls or []
        if not tool_calls:
            content = assistant_message.content
            if not content or not content.strip():
                raise RuntimeError(
                    "Upstage không trả tool_calls hoặc final content; "
                    f"diagnostic: {_response_diagnostic(response)}"
                )
            return content

        messages.append(_assistant_message_for_history(assistant_message))

        for tool_call in tool_calls:
            tool_name = tool_call.function.name
            raw_arguments = tool_call.function.arguments or "{}"
            try:
                arguments = json.loads(raw_arguments)
            except json.JSONDecodeError as error:
                raise RuntimeError(
                    f"Arguments của tool {tool_name} không phải JSON hợp lệ: "
                    f"{raw_arguments}"
                ) from error

            if not isinstance(arguments, dict):
                raise RuntimeError(
                    f"Arguments của tool {tool_name} phải là JSON object"
                )

            print("\n[LLM → TOOL]")
            print(tool_name)
            print("Arguments:")
            print(json.dumps(arguments, ensure_ascii=False, indent=2))

            result = execute_tool(tool_name, arguments, current_user_id)
            serialized_result = json.dumps(result, ensure_ascii=False)

            print("\n[TOOL RESULT]")
            print(json.dumps(result, ensure_ascii=False, indent=2))

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": serialized_result,
                }
            )

    raise RuntimeError(
        f"Agent vượt quá giới hạn {max_rounds} vòng tool call; "
        "có thể đang lặp vô hạn."
    )
