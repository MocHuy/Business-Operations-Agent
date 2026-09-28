"""Business tool for searching the local Product Catalogue."""

import json
from pathlib import Path
from typing import Any


PRODUCTS_FILE = Path(__file__).resolve().parent.parent / "data" / "products.json"


def search_products(
    category: str,
    quantity: int,
    specifications: str | None = None,
    max_total_price: float | None = None,
) -> list[dict[str, Any]]:
    """Return approved catalogue products matching the requested criteria."""
    if quantity <= 0:
        raise ValueError("quantity phải lớn hơn 0")

    with PRODUCTS_FILE.open(encoding="utf-8") as file:
        products = json.load(file)

    category_text = category.casefold()
    specification_text = specifications.casefold() if specifications else None
    matches = []

    for product in products:
        if product["category"].casefold() != category_text:
            continue
        if specification_text and specification_text not in product["specifications"].casefold():
            continue

        total_price = product["unit_price"] * quantity
        if max_total_price is not None and total_price > max_total_price:
            continue

        matches.append({**product, "quantity": quantity, "total_price": total_price})

    return matches
