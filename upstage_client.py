"""Direct OpenAI-compatible client and list-price rates for Upstage Solar."""

import os

from dotenv import load_dotenv
from openai import APIConnectionError, APIStatusError, AuthenticationError, OpenAI


# Undiscounted API list prices checked against https://www.upstage.ai/pricing/api
# on 2026-09-28. Billing promotions and cached-input discounts are excluded.
MODEL_LIST_PRICES_USD_PER_MILLION = {
    "solar-pro4": (0.30, 1.20),
    "solar-pro4-260806": (0.30, 1.20),
    "solar-mini4": (0.10, 0.40),
    "solar-mini4-260922": (0.10, 0.40),
}


def list_price_rates(model_name: str) -> tuple[float, float]:
    try:
        return MODEL_LIST_PRICES_USD_PER_MILLION[model_name]
    except KeyError as error:
        raise ValueError(f"Chưa cấu hình đơn giá cho model {model_name}.") from error


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
    # The harness owns the retry/time budget; SDK retries could outlive it.
    return OpenAI(base_url=base_url, api_key=api_key, max_retries=0)


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
