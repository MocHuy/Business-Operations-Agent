# Tool Catalogue

Ba công cụ **đọc** bên dưới được khai báo ở `tools/tool_registry.py` và thực thi dưới quyền backend trong `procurement_agent.py`. Model chọn công cụ ở runtime; Harness xác thực tên, tham số, phòng ban, timeout và kết quả. Các thao tác ghi ở phần sau là hợp đồng nghiệp vụ/API, không phải công cụ được cấp trực tiếp cho LLM. Phần mô tả cũ của catalogue là thiết kế tham khảo; trạng thái thực thi hiện tại được xác định bằng mã và tests.

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

## API đọc: `GET /api/procurement/{request_id}`

- **Purpose**: Xem chi tiết và trạng thái một PR.
- **Input**: `request_id`.
- **Output**: Chi tiết PR, người tạo, department, sản phẩm, quantity, reason và status.
- **Permission**: Employee xem PR của mình; Manager xem PR thuộc phạm vi quản lý.

## API ghi: `POST /api/procurement`

- **Purpose**: Tạo PR mới ở trạng thái `DRAFT`.
- **Input**: `product_id`, `quantity`, `reason`; user và department lấy từ context.
- **Output**: `request_id`, nội dung PR và status `DRAFT`.
- **Permission**: Employee hoặc Manager đã đăng nhập; backend yêu cầu `confirmed: true`, kiểm sản phẩm và ngân sách. Model không được gọi API này. Lựa chọn cho phép Manager tạo PR là chính sách demo được ghi ở cuối tài liệu.

## API ghi: `POST /api/procurement/{request_id}/submit`

- **Purpose**: Gửi PR để chờ Manager phê duyệt.
- **Input**: `request_id`.
- **Output**: PR đã cập nhật với status `PENDING_APPROVAL`.
- **Permission**: Chính người tạo PR (Employee hoặc Manager), với `confirmed: true`; backend kiểm trạng thái và ngân sách.

## API ghi: `POST /api/procurement/{request_id}/decision`

- **Purpose**: Duyệt hoặc từ chối một PR đang chờ.
- **Input**: `request_id`.
- **Output**: PR đã cập nhật với status `APPROVED` hoặc `REJECTED`.
- **Permission**: Chỉ Manager cùng phòng ban, không tự duyệt, với `confirmed: true`; backend kiểm trạng thái và ngân sách. `decision` nhận `approve` hoặc `reject`.

Trong triển khai hiện tại, giao diện quyết định của quản lý là `POST /api/procurement/{request_id}/decision` với `decision` bằng `approve` hoặc `reject` và `confirmed: true`; không có mutation tool cho model. Agent proposal được xác nhận qua `POST /api/agent/procurement/{session_id}/confirm`, sau đó backend tạo và gửi PR trong một transaction. Các màn hình tạo thủ công dùng hai API create DRAFT và submit riêng, mỗi bước có xác nhận.

Backend lấy actor từ Bearer session; `user_id`, role, department, giá và status trong prompt/body không được dùng làm nguồn quyền. `procurement_store.py` kiểm lại quyền, giá, ngân sách và trạng thái ở transaction mutation, rồi ghi audit. Lựa chọn Manager có thể tạo PR nhưng không tự duyệt được áp dụng cho demo để phù hợp giao diện cũ; đây là chính sách implementation vì các tài liệu nghiệp vụ trước đó chưa thống nhất quyền tạo PR của Manager.
