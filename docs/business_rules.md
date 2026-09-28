# Business Rules

| ID | Quy tắc |
|---|---|
| BR01 | Employee được tìm sản phẩm trong Product Catalogue. |
| BR02 | Employee được tạo Purchase Request. |
| BR03 | Employee không được approve Purchase Request. |
| BR04 | Manager được approve hoặc reject Purchase Request. |
| BR05 | Tổng giá trị Purchase Request không được vượt Department Budget khả dụng. |
| BR06 | Product trong Purchase Request phải tồn tại trong Product Catalogue. |
| BR07 | Quantity phải lớn hơn 0. |
| BR08 | Không được submit PR đã ở trạng thái `APPROVED` hoặc `REJECTED`. |
| BR09 | Agent không được tự tạo Product hoặc Budget khi các đối tượng này không tồn tại. |
| BR10 | Hành động nhạy cảm phải đi qua Harness. Trong MVP, việc tạo, submit và approve/reject PR được xem là hành động nhạy cảm. |

## Trạng thái tối thiểu của Purchase Request

`DRAFT` → `PENDING_APPROVAL` → `APPROVED` hoặc `REJECTED`

PR chỉ được chuyển sang `PENDING_APPROVAL` sau khi Employee xác nhận và submit thành công.
