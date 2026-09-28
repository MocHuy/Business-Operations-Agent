# Tool Catalogue

Catalogue này chỉ là specification. Chưa có implementation Python ở MVP hiện tại.

## `get_user_profile()`

- **Purpose**: Lấy thông tin user hiện tại để xác định employee/manager và department.
- **Input**: Không có input ngoài context/session hiện tại.
- **Output**: `user_id`, `name`, `role`, `department_id`.
- **Permission**: Employee, Manager; Agent được gọi thay mặt user.

## `get_department_budget(department_id)`

- **Purpose**: Kiểm tra ngân sách khả dụng của phòng ban.
- **Input**: `department_id`.
- **Output**: `department_id`, `total_budget`, `spent_amount`, `available_amount`.
- **Permission**: Employee được xem budget của department mình; Manager được xem budget thuộc phạm vi quản lý.

## `search_products(category, quantity, specifications, max_total_price)`

- **Purpose**: Tìm sản phẩm phù hợp trong Product Catalogue.
- **Input**: `category`, `quantity`, `specifications`, `max_total_price` (có thể để trống nếu user chưa nêu).
- **Output**: Danh sách product phù hợp, gồm tối thiểu `product_id`, `name`, `category`, `specifications`, `unit_price`, `total_price`.
- **Permission**: Employee, Manager; Agent được gọi thay mặt user.

## `get_purchase_request(request_id)`

- **Purpose**: Xem chi tiết và trạng thái một PR.
- **Input**: `request_id`.
- **Output**: Chi tiết PR, người tạo, department, sản phẩm, quantity, reason và status.
- **Permission**: Employee xem PR của mình; Manager xem PR thuộc phạm vi quản lý.

## `create_purchase_request(product_id, quantity, reason)`

- **Purpose**: Tạo PR mới ở trạng thái `DRAFT`.
- **Input**: `product_id`, `quantity`, `reason`; user và department lấy từ context.
- **Output**: `request_id`, nội dung PR và status `DRAFT`.
- **Permission**: Employee; Agent phải gọi qua Harness.

## `submit_purchase_request(request_id)`

- **Purpose**: Gửi PR để chờ Manager phê duyệt.
- **Input**: `request_id`.
- **Output**: PR đã cập nhật với status `PENDING_APPROVAL`.
- **Permission**: Employee là người tạo PR; Agent phải gọi qua Harness.

## `approve_purchase_request(request_id)`

- **Purpose**: Approve một PR hợp lệ.
- **Input**: `request_id`.
- **Output**: PR đã cập nhật với status `APPROVED`.
- **Permission**: Chỉ Manager; bắt buộc qua Harness.

> Reject cũng là một nghiệp vụ bắt buộc của MVP và phải được thực hiện qua Harness. Catalogue hiện chưa tách `reject_purchase_request()` thành tool riêng; interface approve/reject cần được chốt khi triển khai.
