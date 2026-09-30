# Kiểm tra trực tiếp luồng mua sắm

Ngày chạy: 2026-09-28. Các lượt kiểm tra dùng `TemporaryDirectory` và SQLite tạm; không dùng cơ sở dữ liệu mặc định. API key chỉ được đọc phía Python từ `.env`; báo cáo không chứa key, bearer token, raw model prose hoặc dữ liệu cá nhân ngoài tài khoản demo.

## Lệnh tái hiện

Chạy từ thư mục gốc repository sau khi cài `requirements.txt` vào `.venv`:

```powershell
.\.venv\Scripts\python.exe scripts\live_smoke.py
```

Mã chạy nằm trong [scripts/live_smoke.py](../scripts/live_smoke.py). Kết quả JSON của lần chạy gần nhất ở [live-smoke.json](live-smoke.json). Script đăng nhập nhân viên demo, gọi Upstage đến khi có đề xuất (tối đa ba yêu cầu mẫu), xác nhận bằng API, đăng nhập quản lý demo, phê duyệt và đối chiếu request, budget, audit trong SQLite tạm. Không in credential hay token.

## Kết quả thực tế

| Lượt | Agent | Model calls | Input / output tokens | Kết quả nghiệp vụ |
|---|---|---:|---:|---|
| Inline TestClient ban đầu | `clarification` → `proposal` | 7 | 7.520 / 447 | MON-27-002 × 5 → PR-000001 `PENDING_APPROVAL` → `APPROVED` |
| `scripts/live_smoke.py`, lượt 1 | `clarification` → `proposal` | 6 | 6.328 / 415 | MON-27-002 × 5 → PR-000001 `PENDING_APPROVAL` → `APPROVED` |
| `scripts/live_smoke.py`, lượt 2 (JSON hiện tại) | `clarification` → `proposal` | 6 | 6.294 / 439 | MON-27-002 × 5 → PR-000001 `PENDING_APPROVAL` → `APPROVED` |

Ở cả ba lượt trong bảng, Manager nhìn thấy PR chờ duyệt; request sau duyệt đọc lại từ backend là `APPROVED`; budget DEP001 giảm đúng **16.000.000 VND**, bằng tổng giá PR. Audit có `CONFIRM_AGENT_PROPOSAL` và `APPROVE_REQUEST`. Mỗi cơ sở dữ liệu tạm chỉ có một request. Lượt inline ban đầu dùng PowerShell here-string đưa cùng logic `TestClient` trực tiếp vào `.venv\Scripts\python.exe -`; script lưu trong repository là bản tái hiện có output không nhạy cảm.

Lưu ý thực tế: Upstage đã trả `clarification` cho yêu cầu đầu tiên dù câu mẫu có số lượng và kích thước. Người dùng phải diễn đạt lại trong lượt thứ hai. Mock tests kiểm tra luật backend độc lập với biến động này; kết quả live chứng minh tích hợp thành công trong những lượt nêu trên, không bảo đảm mọi diễn đạt đều được đề xuất ngay.
