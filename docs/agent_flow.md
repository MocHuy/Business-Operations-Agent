# Agent Flow

## Flow điển hình

User nhập:

> Tôi cần mua 5 màn hình 27 inch, khoảng 20 triệu cho team lập trình.

Agent xử lý theo ngữ cảnh:

1. Gọi `get_user_profile` để biết user và department.
2. Gọi `get_department_budget` để kiểm tra budget khả dụng.
3. Gọi `search_products` với category `monitor`, quantity `5`, specification `27 inch` và giới hạn giá phù hợp.
4. Đề xuất một hoặc các sản phẩm phù hợp, kèm tổng giá trị.
5. Hỏi Employee xác nhận phương án.
6. Sau khi xác nhận, backend kiểm lại giá, ngân sách, quyền và trạng thái đề xuất; tạo và gửi PR trong một transaction.
7. Verifier đọc lại PR đã lưu: requester, department, product, quantity, giá và `PENDING_APPROVAL` phải khớp.
8. Manager trong phạm vi phòng ban xác nhận phê duyệt hoặc từ chối; backend kiểm lại ngân sách khi phê duyệt và ghi audit.

## Nguyên tắc điều phối

Các bước đọc trên mô tả flow điển hình, không phải thứ tự hard-code. Model chọn các read tools trong allowlist và quyết định hỏi thêm hay đề xuất. Harness giữ checkpoint, giới hạn bước/thời gian/token, xác thực tool, kiểm quyền và verification. Model không được gọi mutation tools. Hai màn hình tạo thủ công của React có hai lần xác nhận riêng cho DRAFT và submit; nhánh Agent có một lần xác nhận trước create+submit nguyên tử.

Prompt yêu cầu model hỏi bổ sung khi thiếu dữ liệu. Harness chỉ chấp nhận đề xuất khi quantity là số nguyên dương, sản phẩm đã xuất hiện trong kết quả tìm kiếm và giá/ngân sách/quyền được kiểm lại; Harness chưa có bộ phân tích độc lập để chứng minh prompt đã mô tả đầy đủ thông số. Các hành động nhạy cảm phải qua backend và phải có xác nhận/quyền phù hợp.

## Nhánh lỗi tối thiểu

- Thiếu thông tin: hỏi lại Employee trước khi tìm hoặc tạo PR.
- Không có product phù hợp: verifier không chấp nhận đề xuất; model có thể hỏi thêm hoặc trả lỗi. Chưa có bộ gợi ý phương án thay thế bảo đảm bằng luật.
- Không đủ budget: không tạo/submit PR vượt budget.
- User không có quyền: từ chối thao tác và giải thích ngắn gọn.
- PR không tồn tại hoặc đã kết thúc: không thực hiện thao tác tiếp theo.
