# Business Operations Agent

Repository có giao diện React cho các tác vụ vận hành và một backend Python cho **luồng mua sắm (Procurement)** cùng tra cứu quy định mua sắm có trích dẫn. Nguồn yêu cầu chính là `docs/YeuCauDoAn.md`; tình trạng đối chiếu PR nằm ở `docs/pr_gap_analysis.md` và `docs/implementation_status.md`. [Bản nháp các chương báo cáo và hướng dẫn tự chụp hình](docs/bao_cao_do_an_ban_nhap.md) nằm trong `docs/`.

## Chạy luồng mua sắm

Cần Python 3.10+ và Node.js. Mở hai cửa sổ PowerShell tại thư mục repository:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend_api:app --reload --host 127.0.0.1 --port 8001
```

```powershell
cd frontend
npm ci
npm run dev
```

Mở địa chỉ Vite in ra trong terminal. Vite chuyển `/api` đến backend cổng 8001. Nếu phục vụ React từ một origin khác, cấu hình `VITE_API_BASE_URL` hoặc reverse proxy `/api` phù hợp. **Không** đặt `UPSTAGE_API_KEY` trong biến môi trường `VITE_` hay mã frontend.

Nếu cổng 8001 đang được ứng dụng khác sử dụng, chọn cổng khác khi chạy Uvicorn, rồi đặt `$env:PROCUREMENT_API_TARGET = 'http://127.0.0.1:<port>'` trong cửa sổ PowerShell chạy Vite trước `npm run dev`. Với bản triển khai web, dùng reverse proxy cùng origin cho `/api`; nếu chọn API khác origin thì cần cấu hình CORS cho các origin được phép trên backend.

Để dùng quyết định LLM thật, tạo `.env` cục bộ từ `.env.example` và điền `UPSTAGE_API_KEY`; file `.env` được git bỏ qua. Nếu không có key, API mua sắm thủ công và bộ kiểm thử dùng model giả lập vẫn chạy; Agent tự chọn read tools và bước lập chỉ mục RAG thật cần key. Tích hợp Upstage đã được chạy live trong `reports/eval-live.md`; chất lượng vẫn cần đánh giá tiếp trên tập lớn hơn.

Trước khi hỏi quy định mua sắm tại Trợ lý vận hành, chạy `.\.venv\Scripts\python.exe -m scripts.index_policy` tại thư mục gốc để lập chỉ mục 18 đoạn từ `docs/business_rules.md` và `docs/demo_policy.md`. Nếu nguồn thay đổi, chạy lại lệnh này; API từ chối citation cũ. Có thể tái chạy bộ đo năm câu bằng `.\.venv\Scripts\python.exe -m evals.run_rag_eval`, kết quả ở `reports/eval-rag.json`. Corpus chỉ gồm quy định Procurement, chưa bao gồm chính sách chi phí/nhân sự.

Prototype MCP công bố cùng kho quy định qua một tool chỉ đọc: chạy `.\.venv\Scripts\python.exe -m scripts.mcp_policy_smoke` để kiểm giao tiếp client/server và xem `reports/mcp-policy-trace.json`. Tài liệu thiết kế ở `docs/mcp_design.md`; đường web vẫn gọi Retrieval Harness trực tiếp.

Tài khoản demo có mật khẩu `123`. Luồng dễ thử: nhân viên `nhanvien2` (DEP001) mô tả mua màn hình tại **Trợ lý vận hành**, xem đề xuất rồi xác nhận gửi; đăng xuất và vào `quanly1` để xử lý ở **Phê duyệt**. Cặp `nhanvien1`/`thaomkt` dùng DEP002. Mật khẩu công khai này chỉ phục vụ demo; cần thay cơ chế xác thực trước khi triển khai thật.

Backend giữ các PR, ngân sách đã chi, checkpoint Agent, trace, audit và phiên đăng nhập trong `data/procurement.sqlite3` (không commit). Product Catalogue, department và user demo được lấy từ `data/*.json`. `data/users.json` là nguồn quyền mua sắm phía server: trạng thái tài khoản, permission, phạm vi phòng ban và hạn mức phê duyệt được kiểm lại ở mỗi request. Thay đổi quyền trong màn hình quản trị React hiện chỉ tác động Store demo, **không** thay đổi quyền Procurement trên server. Quản lý được tạo PR nhưng không tự duyệt; ngân sách chỉ bị trừ khi duyệt. Giao diện React vẫn giữ các màn hình ngoài Procurement; các nghiệp vụ chi phí, tài sản, họp, biểu mẫu và quyền tổ chức hiện dùng Store/localStorage mô phỏng và **không có ranh giới bảo mật backend**.

## Kiểm thử và đánh giá

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m evals.run_mock_eval
cd frontend
npm test
npm run build
```

`evals/run_mock_eval.py` tạo `reports/eval-mock.json` và một failed trace mẫu trong `logs/sample-traces/`. Các số token của mock là giả lập, không phải số đo hóa đơn Upstage. Xem `reports/cost-analysis.md` để biết giả định dự phóng.

POST `/api/procurement` yêu cầu `Idempotency-Key` 16–128 ký tự và `confirmed:true`. Frontend tạo/lưu key cho lần gửi đang chờ và dùng lại khi mất phản hồi để không tạo PR trùng. Các endpoint gửi duyệt, xác nhận Agent và quyết định quản lý đều yêu cầu xác nhận; backend kiểm quyền, trạng thái và ngân sách ngay trong transaction.

Khi có API key hợp lệ, có thể chạy `scripts/live_smoke.py` để kiểm tra Upstage → đề xuất → xác nhận → quản lý duyệt trên SQLite tạm. Script ghi bản tổng hợp không chứa token vào `reports/live-smoke.json`; kết quả mẫu và giới hạn diễn giải ở `reports/live-smoke.md`.

Để kiểm chứng phục hồi sau ngắt tiến trình bằng Upstage thật: `.\.venv\Scripts\python.exe -m scripts.live_recovery --model solar-mini4 --attempts 3`. Script dùng SQLite tạm, chủ động ngắt sau checkpoint model đầu tiên, tiếp tục cùng phiên rồi xác minh PR, ngân sách và audit; kết quả mẫu ở `reports/live-recovery.md`.

Benchmark live ba tầng, mỗi ca một SQLite tạm, có thể chạy riêng từng model:

```powershell
.\.venv\Scripts\python.exe -m evals.run_live_eval --model solar-mini4 --repeats 3 --report reports/eval-live-mini4.json
.\.venv\Scripts\python.exe -m evals.run_live_eval --model solar-pro4 --repeats 3 --report reports/eval-live-pro4.json
```

Script trả exit code 1 nếu có ca chưa đúng oracle. Báo cáo ghi kết quả nghiệp vụ và an toàn riêng; giá model là ước tính theo bảng giá thường, chỉ tính token mà trace đã ghi được. Các lời gọi hết giờ trước khi ghi usage có thể phát sinh chi phí chưa đo được.
Kết quả đo 2026-09-29 và giới hạn diễn giải nằm ở `reports/eval-live.md`.

Xem trước bản ghi hết hạn bằng `.\.venv\Scripts\python.exe -m scripts.prune_data`. Thêm `--execute` để xóa phiên đăng nhập hết hạn và checkpoint/trace Agent quá 30 ngày. PR, idempotency key, ngân sách và audit không bị dọn; đây là chính sách demo, chưa phải chính sách lưu trữ production.

`main.py` và `agent.py` là bản chẩn đoán Upstage ban đầu; API đang dùng `backend_api.py`, `procurement_agent.py` và `procurement_store.py`. Cổng xác nhận, quyền, ngân sách, trạng thái và verifier nằm ở backend; model chỉ chọn các công cụ **đọc** và đề xuất.
