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
6. Sau khi xác nhận, gọi `create_purchase_request`.
7. Gọi `submit_purchase_request`.
8. Kết quả: PR ở trạng thái `PENDING_APPROVAL` để Manager xử lý.

## Nguyên tắc điều phối

Các bước trên mô tả một flow điển hình, không phải thứ tự hard-code. Agent được quyền quyết định cần gọi tool nào dựa trên thông tin đã có, thông tin còn thiếu, quyền của user và trạng thái PR.

Agent phải hỏi bổ sung khi thiếu dữ liệu cần thiết; không tự suy đoán product, budget, quantity hoặc quyền hạn. Các hành động nhạy cảm phải qua Harness và phải có xác nhận/quyền phù hợp.

## Nhánh lỗi tối thiểu

- Thiếu thông tin: hỏi lại Employee trước khi tìm hoặc tạo PR.
- Không có product phù hợp: thông báo rõ và đề nghị phương án khác nếu có.
- Không đủ budget: không tạo/submit PR vượt budget.
- User không có quyền: từ chối thao tác và giải thích ngắn gọn.
- PR không tồn tại hoặc đã kết thúc: không thực hiện thao tác tiếp theo.
