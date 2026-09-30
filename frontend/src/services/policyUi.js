const translations = {
  'POL-01': {
    section: 'Mục 2.1',
    title: 'Thiết bị công nghệ thông tin được mua sắm',
    summary: 'Các thiết bị làm việc tiêu chuẩn được mua bằng ngân sách phòng ban.',
    excerpt: 'Thiết bị tiêu chuẩn gồm màn hình 24 hoặc 27 inch, máy tính xách tay 14 hoặc 15,6 inch, bàn phím USB hoặc không dây và chuột quang. Thiết bị ngoài danh mục tiêu chuẩn cần bộ phận hạ tầng công nghệ thông tin xem xét.'
  },
  'POL-02': {
    section: 'Mục 3.2',
    title: 'Ngân sách phòng ban và phê duyệt của quản lý',
    summary: 'Giới hạn ngân sách và yêu cầu phê duyệt cho mọi giao dịch mua sắm.',
    excerpt: 'Mỗi phòng ban có ngân sách thiết bị công nghệ thông tin riêng. Tổng giá trị yêu cầu mua sắm không được vượt số dư ngân sách khả dụng của phòng ban. Quản lý phòng ban được chỉ định phải phê duyệt mọi yêu cầu trước khi thực hiện mua sắm.'
  },
  'POL-03': {
    section: 'Mục 4.5',
    title: 'Quyền hạn trong quy trình mua sắm',
    summary: 'Phân chia trách nhiệm giữa nhân viên và quản lý.',
    excerpt: 'Nhân viên có thể tìm sản phẩm trong danh mục được duyệt, tạo yêu cầu mua sắm ở trạng thái bản nháp và gửi yêu cầu để xem xét. Nhân viên không được phê duyệt yêu cầu mua sắm, kể cả yêu cầu của chính mình. Chỉ quản lý được chỉ định mới có quyền phê duyệt trong phạm vi phòng ban phụ trách.'
  },
  'POL-04': {
    section: 'Mục 5.1',
    title: 'Hoàn trả chi phí và ngưỡng chứng từ',
    summary: 'Chứng từ bắt buộc và các khoản chi công việc được hoàn trả.',
    excerpt: 'Chi phí đi lại tại địa phương, bữa ăn với khách hàng và chi phí vận hành phát sinh có thể được hoàn trả. Khoản đi lại hoặc ăn uống trên 500.000 đồng phải có hóa đơn giá trị gia tăng chính thức hoặc chứng từ điện tử hợp lệ. Quản lý không được phê duyệt hồ sơ thiếu chứng từ bắt buộc.'
  },
  'POL-05': {
    section: 'Mục 6.2',
    title: 'Cấp phát và điều chuyển tài sản công ty',
    summary: 'Ưu tiên tài sản có sẵn trước khi đề nghị mua thiết bị mới.',
    excerpt: 'Trước khi tạo yêu cầu mua sắm mới, nhân viên và quản lý phải kiểm tra tài sản hiện có của phòng ban. Thiết bị sẵn có và hoạt động tốt cần được điều chuyển, cấp phát cho nhân viên mới trước khi cho phép yêu cầu mua mới.'
  },
  'POL-06': {
    section: 'Mục 7.3',
    title: 'Quy định về cuộc họp liên phòng ban',
    summary: 'Yêu cầu đối với cuộc họp rà soát hệ thống và phối hợp liên phòng ban.',
    excerpt: 'Cuộc họp về thay đổi hệ thống kinh doanh, nâng cấp kiến trúc hoặc điều tra biến động doanh thu phải có chủ sở hữu nghiệp vụ và kỹ thuật đã được xác minh. Cần gửi chương trình họp và nhận xác nhận tham dự trước khi lên lịch.'
  }
};

export const localizePolicy = policy => ({ ...policy, ...(translations[policy.id] || {}) });
