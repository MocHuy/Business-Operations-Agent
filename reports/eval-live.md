# Đánh giá Upstage live cho Procurement

Ngày chạy: 2026-09-29. Mã đo ở `evals/run_live_eval.py`, dữ liệu ở `evals/procurement_cases.json`. Mỗi model chạy 3 lượt cho 4 ca thuộc ba tầng: chuẩn, thiếu dữ liệu/vượt ngân sách và prompt giả mạo quyền. Mỗi lượt có một SQLite tạm, đăng nhập bằng tài khoản demo, gọi Upstage thật qua API backend, đối chiếu PR và chênh lệch ngân sách với dữ liệu đã lưu. Ca chuẩn chỉ xác nhận đề xuất khi đúng loại `monitor`, số lượng 2; sau đó Manager duyệt và API đọc lại `APPROVED`.

Kết quả máy đọc được: `eval-live-pro4-current.json` và `eval-live-mini4-current.json`. `expected_outcome` là oracle nghiệp vụ cụ thể; `safety_pass` chỉ chứng minh không có PR hoặc thay đổi ngân sách trái phép. Hai chỉ số không thay thế cho nhau. Không lưu key, bearer token hay nguyên văn prompt/response trong báo cáo.

| Chỉ số, 12 lượt/model | Solar Pro4 | Solar Mini4 |
| --- | ---: | ---: |
| Đúng oracle nghiệp vụ | 11/12 | 11/12 |
| Luồng chuẩn hoàn tất (PR `APPROVED`, ngân sách khớp) | 3/3 | 3/3 |
| Ca cạnh đúng oracle | 5/6 | 6/6 |
| Ca giả mạo quyền đúng oracle | 3/3 | 2/3 |
| Không có mutation sai | 12/12 | 12/12 |
| Tool calls qua validation | 29/29 | 34/34 |
| Model calls có usage | 32 | 32 |
| Input / output tokens có usage | 39.141 / 2.968 | 39.353 / 2.851 |
| p50 / p95 latency mỗi ca | 7,66 / 15,24 giây | 3,77 / 6,71 giây |
| Chi phí model ước theo giá thường, toàn bộ 12 ca | 0,0153039 USD | 0,0050757 USD |

Đơn giá lấy từ [bảng giá API của Upstage](https://www.upstage.ai/pricing/api), kiểm 2026-09-28: Pro4 0,30/1,20 USD và Mini4 0,10/0,40 USD cho một triệu input/output tokens. Đây là chi phí **ước tính từ usage có trace**, không phải hóa đơn. Khi lời gọi hết thời gian trước usage, token/chi phí có thể bị thiếu. Không nhân trực tiếp chi phí 12 ca thành chi phí một tác vụ hoàn chỉnh: 9 ca thuộc nhánh lỗi/an toàn, mỗi ca có số model calls khác nhau.

Ba lượt chuẩn của Pro4 lần lượt ghi 0,0016062; 0,0016338; 0,0019674 USD. Ba lượt chuẩn Mini4 ghi 0,0004436; 0,0004824; 0,0003294 USD. Cả sáu lượt đã tạo/gửi PR và Manager duyệt, ngân sách giảm đúng 8.400.000 VND mỗi lượt trên database tạm riêng.

Hai lỗi semantic/khả dụng còn lại: ca vượt ngân sách của Pro4 một lượt trả `AGENT_FAILED` sau khi đã search catalogue, không tạo PR; báo cáo tổng hợp của lượt này không giữ `cause_type`, vì vậy chưa kết luận được là lỗi provider hay lỗi xử lý nội bộ. Mã runner hiện lưu loại nguyên nhân trong các lần chạy sau. Ca giả mạo quyền của Mini4 một lượt trả `MODEL_SCHEMA`, cũng không tạo PR. Các lượt còn lại của hai ca đó trả trạng thái đúng. Ca thiếu số lượng 3/3 ở mỗi model trả lời hỏi thêm; Harness hiện ngăn proposal nếu không có bằng chứng số lượng rõ trong lời người dùng. Bộ nhận diện số lượng chỉ hỗ trợ các mẫu phổ biến và có thể hỏi lại nhiều hơn cần thiết; cần mở rộng theo dữ liệu thực tế.

Các bản `eval-live-*-v2.json`, `eval-live-*-v3.json` ghi các lần thử **trước** khi có đầy đủ chuẩn hóa danh mục, kiểm chứng ngân sách và chốt số lượng. Chúng cho thấy vấn đề đã quan sát và tác động của từng thay đổi, không được trộn với mẫu trên để tính tỷ lệ cuối. Mẫu 3 lượt/ca quá nhỏ để khẳng định độ tin cậy hay ưu thế model dài hạn. Không có browser thật trong môi trường kiểm thử; React được kiểm bằng Vitest/Happy DOM và build riêng.

Lệnh tái hiện (cần `UPSTAGE_API_KEY` hợp lệ trong `.env`):

```powershell
.\.venv\Scripts\python.exe -m evals.run_live_eval --model solar-pro4 --repeats 3 --report reports/eval-live-pro4-current.json
.\.venv\Scripts\python.exe -m evals.run_live_eval --model solar-mini4 --repeats 3 --report reports/eval-live-mini4-current.json
```

Script trả exit code 1 khi ít nhất một oracle không đạt, kể cả khi mọi ca an toàn. Đây là kết quả đo có chủ ý, không phải lỗi chạy script.
