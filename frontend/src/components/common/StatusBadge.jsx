const labels = {
  DRAFT: 'Bản nháp',
  PENDING_APPROVAL: 'Chờ phê duyệt',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Đã từ chối',
  ACTIVE: 'Đang hoạt động',
  DISABLED: 'Đã vô hiệu hóa',
  PENDING: 'Đang chờ',
  AVAILABLE: 'Có sẵn',
  ASSIGNED: 'Đã cấp phát',
  SENT: 'Đã gửi',
  SCHEDULED: 'Đã lên lịch',
  REVOKED: 'Đã thu hồi',
  ATTACHED: 'Đã đính kèm',
  MISSING: 'Thiếu chứng từ',
  COMPLETED: 'Hoàn tất',
  FAILED: 'Thất bại',
  SUCCESS: 'Thành công',
  READY: 'Sẵn sàng',
  PASS: 'Đạt'
};
export const statusLabel = status => labels[String(status || '').toUpperCase()] || status || '—';
export default function StatusBadge({ status }) {
  const token = String(status || 'unknown').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return <span className={`status-badge status-${token}`}>{statusLabel(status)}</span>;
}
