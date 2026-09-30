# Kiểm chứng phục hồi khi Upstage đang chạy

Ngày chạy: 2026-09-29. `scripts/live_recovery.py` dùng Upstage thật và một SQLite tạm. Script chủ động ném `KeyboardInterrupt` **ngay sau khi** kết quả model đầu tiên, usage và trace đã được ghi nguyên tử. Chưa có tool ghi hoặc PR nào được tạo tại điểm ngắt. Sau đó một Harness mới tiếp tục cùng `session_id` từ checkpoint, lấy đề xuất, xác nhận tạo/gửi PR, rồi Manager duyệt. Mọi trạng thái cuối được đọc lại từ SQLite, không lấy lời model làm bằng chứng.

Lệnh đã chạy:

```powershell
.\.venv\Scripts\python.exe -m scripts.live_recovery --model solar-mini4 --attempts 3 --report reports/live-recovery-mini4.json
```

Kết quả thực tế: **PASS ngay lượt 1**. Checkpoint `RUNNING` lưu 1.201 token và bước 1; trace có 3 model calls và 1 sự kiện `recovery`. Trước khi tiếp tục có 0 PR; sau xác nhận có đúng 1 PR, trạng thái cuối `APPROVED`, ngân sách giảm đúng tổng giá PR. Audit có `CONFIRM_AGENT_PROPOSAL` và `APPROVE_REQUEST`. Báo cáo máy đọc được ở `reports/live-recovery-mini4.json`; không lưu API key, token xác thực hay nguyên văn model.

Kết quả này chứng minh một vị trí ngắt sau model được phục hồi an toàn. Model call có thể được gọi lại sau ngắt, nên usage/chi phí có thể tăng; mutation tạo PR vẫn đi qua cổng xác nhận và không bị phát lại. Chưa kiểm mọi vị trí ngắt hoặc độ tin cậy thống kê khi API Upstage lỗi.
