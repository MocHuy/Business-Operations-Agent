# Chi phí vận hành Procurement Agent

Ngày kiểm tra: 2026-09-28. [Bảng giá API chính thức của Upstage](https://www.upstage.ai/pricing/api) niêm yết giá thường (không tính khuyến mãi/cache): Solar Pro 4 **0,30 USD / 1 triệu input tokens** và **1,20 USD / 1 triệu output tokens**; Solar Mini 4 **0,10 USD / 1 triệu input tokens** và **0,40 USD / 1 triệu output tokens**. `upstage_client.py` chọn đúng cặp giá theo model đang chạy. Giá có thể thay đổi; cần kiểm lại trước khi dùng cho quyết định ngân sách thật.

## Cách tính và giả định

`chi phí model/phiên = input_tokens × giá_input / 1.000.000 + output_tokens × giá_output / 1.000.000`.

Để dự phóng trước khi có mẫu thống kê live đủ lớn, dùng **giả định** 3.000 input và 500 output tokens cho một yêu cầu Procurement hoàn chỉnh, không cache, không retry. Các số này là kịch bản tính toán, **không phải** trung bình đo được từ Upstage.

| Lượng yêu cầu | Pro4 theo kịch bản giả định | Mini4 theo kịch bản giả định |
| ---: | ---: | ---: |
| 1 | 0,0015 USD | 0,0005 USD |
| 1.000/tháng | 1,50 USD/tháng | 0,50 USD/tháng |
| 10.000/tháng | 15,00 USD/tháng | 5,00 USD/tháng |

Chưa tính retry thất bại, hạ tầng API/SQLite, nhân sự kiểm duyệt, lưu log, thuế, biến động giá và tải cao. Các lời gọi Upstage hết thời gian trước khi ghi usage có thể đã tiêu token nhưng không có trong báo cáo; chi phí đo được khi đó là **cận dưới**, không phải hóa đơn. Model tier thấp hơn rẻ hơn mỗi token nhưng cần xét tỷ lệ hoàn thành và độ trễ khi so sánh.

## Bằng chứng đo hiện có

- `.\.venv\Scripts\python.exe -m evals.run_mock_eval` xuất `reports/eval-mock.json`: 8/8 kết quả kỳ vọng, 16 model calls, 12 tool calls, 1.280 input và 320 output tokens, độ trễ trung bình 292,75 ms (p50 164 ms, p95 566,35 ms) trong lần chạy được lưu. `ScriptedModel` **gán token giả lập** (80 vào/20 ra mỗi lượt), nên không dùng các token hay độ trễ này để ước tính hóa đơn hoặc hiệu năng Upstage.
- Các mẫu Upstage cũ trong `reports/live-smoke.json` chứng minh API thật có thể hoàn tất luồng nhưng **không ghi model id**. Chi phí Pro4 từng nêu cho những mẫu đó chỉ là kịch bản theo giá Pro4, không thể xác nhận là chi phí đúng model đã chạy; không dùng làm cơ sở so sánh tier.
- `reports/eval-live-*-current.json` là benchmark mới theo từng model trên SQLite tạm. `reports/eval-live.md` tách tỷ lệ hoàn thành, an toàn và chi phí token có usage. Mẫu 3 lượt/ca vẫn quá nhỏ để ngoại suy ngân sách tháng tin cậy.

## Khuyến nghị dựa trên số liệu

Benchmark mock chuẩn có 4 model calls và 3 read tools trước đề xuất. Một trace live cũ gọi lặp `search_products`; Harness hiện buộc model trả kết quả có cấu trúc sau khi đã có profile, ngân sách và một lần search. Cần tiếp tục đo số lần hỏi lại, kết quả semantic và latency trước khi khẳng định mức tiết kiệm trung bình.
