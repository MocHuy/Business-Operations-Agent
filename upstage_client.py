"""Direct OpenAI-compatible client for Upstage Solar Pro."""

import os

from dotenv import load_dotenv
from openai import APIConnectionError, APIStatusError, AuthenticationError, OpenAI


def _config() -> tuple[str, str, str]:
    load_dotenv()
    api_key = os.getenv("UPSTAGE_API_KEY")
    if not api_key:
        raise ValueError("Chưa tìm thấy UPSTAGE_API_KEY trong .env")
    return (
        os.getenv("UPSTAGE_BASE_URL", "https://api.upstage.ai/v1"),
        api_key,
        os.getenv("UPSTAGE_MODEL", "solar-pro4"),
    )


def get_upstage_client() -> OpenAI:
    base_url, api_key, _ = _config()
    return OpenAI(base_url=base_url, api_key=api_key)


def get_upstage_model() -> str:
    return _config()[2]


def format_upstage_error(error: Exception) -> str:
    if isinstance(error, AuthenticationError):
        return "Upstage xác thực thất bại (HTTP 401); hãy kiểm tra UPSTAGE_API_KEY."
    if isinstance(error, APIConnectionError):
        return "Không thể kết nối tới Upstage API."
    if isinstance(error, APIStatusError):
        return f"Upstage trả về lỗi HTTP {error.status_code}: {error.message}"
    return str(error)
