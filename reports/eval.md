# Đánh giá luồng Procurement

Ngày chạy: 2026-09-28. Bộ dữ liệu ba tầng nằm ở `evals/procurement_cases.json`; `evals/run_mock_eval.py` đọc prompt từ file này và kiểm tập ID khớp với các hàm oracle. Kết quả máy đọc được là `reports/eval-mock.json`. Model trong benchmark là **ScriptedModel**, nên các tỷ lệ dưới đây đo Harness và quy tắc nghiệp vụ, không đo chất lượng Upstage thật.

| Chỉ số | Kết quả lần chạy lưu | Giới hạn diễn giải |
| --- | ---: | --- |
| Kịch bản ra đúng kết quả kỳ vọng | 8/8 (100%) | Bao gồm 1 luồng thành công, các ca thiếu dữ liệu, vượt ngân sách, lỗi tool, vòng lặp, model tự nhận sai, sai argument và prompt giả mạo quyền. |
| Hoàn thành luồng mua chuẩn | 1/1 | Mock chọn đúng read tools; xác nhận tạo/gửi và Manager duyệt trong SQLite tạm. |
| Độ đúng quy tắc theo oracle của kịch bản | 8/8 | Oracle kiểm status, quyền, ngân sách và không phát sinh PR khi thất bại; không phải đánh giá độ chính xác ngôn ngữ tự nhiên của LLM. |
| Model calls / tool calls | 16 / 12 | 10 tool calls qua validation; 2 bị chặn đúng vì sai argument/không được phép; 1 call hợp lệ gặp lỗi runtime; 9 có kết quả. |
| Input / output tokens | 1.280 / 320 | Token do mock gán 80/20 mỗi model call; không phải usage thật. |
| Độ trễ trung bình | 292,75 ms/ca | Kết quả lần chạy đang lưu; chỉ gồm local mock, SQLite và Python, không đại diện latency API Upstage. |
| Phân phối độ trễ | p50 164 ms; p95 566,35 ms; min/max 140/594 ms | Nội suy trên 8 kịch bản mock; tập nhỏ nên chưa đủ cho ước lượng vận hành. |

Các ca có giới hạn bước, thời gian, token/cost, retry I/O, checkpoint resume, thay đổi ngân sách sau đề xuất, đổi giá catalogue sau đề xuất và API confirmation được kiểm thử riêng trong `tests/`. Lần chạy `.\.venv\Scripts\python.exe -m unittest discover -s tests -q` gần nhất đạt **45/45**, bao gồm RAG và giao tiếp MCP giả lập. Frontend chạy Vitest/Happy DOM và Vite build riêng; xem `docs/implementation_status.md` cho lệnh và kết quả cuối.

## Ví dụ truy nguyên lỗi

`logs/sample-traces/false-model-success.json` ghi `input → state(step 1) → model(final) → verification(passed=false) → failure(VERIFICATION_FAILED)`. Nguyên nhân: model đề xuất sản phẩm và tự nói xong khi chưa đọc profile/budget/catalogue. Verifier từ chối trước khi tạo PR. Mã lỗi và bước thất bại có thể xác định từ trace mà không tin nội dung model.

## Mẫu Upstage thật

Mẫu smoke ban đầu trong `reports/live-smoke.md` chứng minh đường API/tool calling/structured proposal và mutation có thể chạy, nhưng chưa ghi model id nên các phép tính giá theo Pro4 chỉ là giả định. Benchmark mới `reports/eval-live.md` chạy 12 lượt cho mỗi model ở ba tầng trên SQLite tạm: Pro4 và Mini4 đều đúng oracle 11/12, an toàn 12/12, luồng chuẩn hoàn tất 3/3. Báo cáo riêng nêu p50/p95, token/cost theo model và hai lỗi còn lại. Cỡ mẫu vẫn nhỏ, không dùng kết quả mock để suy ra chất lượng model thật.
