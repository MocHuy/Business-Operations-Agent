# Business Scope

## Mục tiêu MVP

Business Procurement Agent hỗ trợ nhân viên yêu cầu mua thiết bị cho phòng ban và hỗ trợ quản lý phê duyệt yêu cầu. Công ty giả lập có nhiều phòng ban; mỗi phòng ban có ngân sách mua thiết bị riêng.

## Người dùng

- **Employee**: tìm sản phẩm, tạo và gửi Purchase Request cho phòng ban của mình.
- **Manager**: xem và approve hoặc reject Purchase Request thuộc phạm vi quản lý.

## Đối tượng nghiệp vụ

- **Department Budget**: ngân sách mua thiết bị của một phòng ban.
- **Product Catalogue**: danh mục các sản phẩm được phép mua.
- **Purchase Request (PR)**: yêu cầu mua sản phẩm, gồm sản phẩm, số lượng, lý do và trạng thái.
- **Approval**: quyết định approve hoặc reject một PR của Manager.

## Thiết bị trong MVP

- monitor
- laptop
- keyboard
- mouse

## Phạm vi xử lý

- Employee nhập nhu cầu mua bằng ngôn ngữ tự nhiên.
- Agent làm rõ thông tin còn thiếu.
- Agent kiểm tra budget và Product Catalogue.
- Agent đề xuất phương án để Employee xác nhận.
- Hệ thống tạo, submit và xử lý Approval cho PR.

## Ngoài phạm vi MVP

- Finance
- Director
- payment
- supplier thật
- ERP integration
- email
- notification
- React UI
- LangGraph
- multi-agent
- RAG
- vector database
