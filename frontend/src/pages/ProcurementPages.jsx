import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { approvalService, procurementService } from '../services/businessService';
import DataPage from '../components/common/DataPage';
import StatusBadge from '../components/common/StatusBadge';
import DelegationPanel from '../components/business/DelegationPanel';
import { departmentNameLabel, productNameLabel } from '../services/uiText';

const money = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0) + ' ₫';
const status = row => <StatusBadge status={row.status}/>;
const PENDING_CREATE_KEY = 'procurement-pending-create';

function createKeyFor(actorId, productId, quantity, reason) {
  const payload = JSON.stringify([actorId, productId, Number(quantity), reason.trim()]);
  try {
    const pending = JSON.parse(sessionStorage.getItem(PENDING_CREATE_KEY) || 'null');
    if (pending?.payload === payload && pending?.key) return pending.key;
  } catch { /* A damaged browser entry must not block a new request. */ }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const key = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  sessionStorage.setItem(PENDING_CREATE_KEY, JSON.stringify({ payload, key }));
  return key;
}

export function ProcurementPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [show, setShow] = useState(false);
  const [pending, setPending] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = async () => setRequests(await procurementService.all());
  useEffect(() => {
    let live = true;
    Promise.all([procurementService.all(), procurementService.products()])
      .then(([rows, catalogue]) => { if (live) { setRequests(rows); setProducts(catalogue); setProductId(catalogue[0]?.product_id || ''); } })
      .catch(error => { if (live) setMessage(error.message); });
    return () => { live = false; };
  }, []);

  const create = async () => {
    setBusy(true);
    setMessage('');
    try {
      const idempotencyKey = createKeyFor(user.user_id, productId, quantity, reason);
      const result = await procurementService.create({ productId, quantity, reason, idempotencyKey });
      if (!result?.id) throw new Error('Máy chủ chưa xác nhận việc tạo yêu cầu.');
      const verified = await procurementService.get(result.id);
      if (verified.status !== 'DRAFT') throw new Error('Trạng thái yêu cầu sau khi tạo chưa được xác minh.');
      sessionStorage.removeItem(PENDING_CREATE_KEY);
      setPending(verified);
      setShow(false);
      await reload();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      await procurementService.submit(pending.id);
      const verified = await procurementService.get(pending.id);
      if (verified.status !== 'PENDING_APPROVAL') throw new Error('Yêu cầu chưa được xác minh là đã gửi phê duyệt.');
      setMessage(`Đã gửi yêu cầu ${pending.id} để phê duyệt.`);
      setPending(null);
      await reload();
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };

  const stats = [
    { label: 'Tổng yêu cầu', value: requests.length, subtext: 'Hồ sơ mua sắm' },
    { label: 'Chờ phê duyệt', value: requests.filter(r => r.status === 'PENDING_APPROVAL').length, subtext: 'Cần quản lý duyệt' },
    { label: 'Đã phê duyệt', value: requests.filter(r => r.status === 'APPROVED').length, subtext: 'Sẵn sàng đặt mua' },
    { label: 'Tổng giá trị đề xuất', value: money(requests.reduce((s, r) => s + (Number(r.total_price) || 0), 0)), subtext: 'Toàn bộ hồ sơ' }
  ];

  return <>
    <DataPage
      title="Yêu cầu mua sắm"
      subtitle="Theo dõi tiến độ lập hồ sơ, kiểm duyệt ngân sách và đặt hàng thiết bị."
      stats={stats}
      rows={requests}
      columns={[
        { key: 'id', label: 'Mã yêu cầu' }, { key: 'requester_name', label: 'Người yêu cầu' },
        { key: 'product_name', label: 'Sản phẩm', render: row => productNameLabel(row.product_name) }, { key: 'quantity', label: 'Số lượng' },
        { key: 'total_price', label: 'Tổng tiền', render: row => money(row.total_price) },
        { key: 'status', label: 'Trạng thái', render: status },
        { key: 'details', label: '', render: row => <Link to={`/procurement/${row.id}`}>Chi tiết</Link> }
      ]}
      actions={<button className="btn btn-primary" onClick={() => setShow(true)}>Tạo yêu cầu</button>}
    />
    {message && <p role="status">{message}</p>}
    {show && <div className="modal-overlay"><div className="modal-content">
      <h3>Tạo yêu cầu mua sắm</h3>
      <label>Sản phẩm<select value={productId} onChange={event => setProductId(event.target.value)}>{products.map(product => <option key={product.product_id} value={product.product_id}>{productNameLabel(product.name)} · {money(product.unit_price)}</option>)}</select></label>
      <label>Số lượng<input type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.value)}/></label>
      <label>Nhu cầu<textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Mô tả lý do cần mua"/></label>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setShow(false)}>Hủy</button><button className="btn btn-primary" disabled={busy || !productId} onClick={() => window.confirm('Xác nhận tạo yêu cầu mua sắm?') && create()}>Tạo bản nháp</button></div>
    </div></div>}
    {pending && <div className="modal-overlay"><div className="modal-content">
      <h3>Yêu cầu {pending.id} đã tạo</h3><p>{productNameLabel(pending.product_name)} · {pending.quantity} · {money(pending.total_price)}</p>
      <p>Kiểm tra chi tiết trước khi gửi đến quản lý.</p>
      <div className="modal-actions"><button className="btn btn-secondary" onClick={() => setPending(null)}>Để bản nháp</button><button className="btn btn-primary" disabled={busy} onClick={() => window.confirm(`Xác nhận gửi yêu cầu ${pending.id}?`) && submit()}>Gửi phê duyệt</button></div>
    </div></div>}
  </>;
}

export function ProcurementDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [record, setRecord] = useState(null);
  const [canApprove, setCanApprove] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = async () => {
    const [request, approvals] = await Promise.all([procurementService.get(id), user?.system_role === 'MANAGER' ? approvalService.all() : Promise.resolve([])]);
    setRecord(request);
    setCanApprove(approvals.some(row => row.id === id));
  };
  useEffect(() => { reload().catch(error => setMessage(error.message)); }, [id]);
  const act = async (action, expectedStatus) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
      const verified = await procurementService.get(id);
      if (verified.status !== expectedStatus) throw new Error('Trạng thái yêu cầu sau thao tác chưa được xác minh.');
      await reload();
      setMessage('Đã cập nhật yêu cầu.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  if (!record) return <p role="status">{message || 'Đang tải…'}</p>;
  const owned = record.requester_id === user?.user_id;
  return <>
    <div className="page-heading"><div><h2>Yêu cầu mua sắm</h2><p>Thông tin và trạng thái xử lý của hồ sơ.</p></div><Link to="/procurement">Quay lại danh sách</Link></div>
    <section className="card detail-card"><header><h2>{record.id}</h2><p>{record.requester_name} · {departmentNameLabel(record.department_name)}</p></header>
      <dl className="detail-grid"><div><dt>Sản phẩm</dt><dd>{productNameLabel(record.product_name)}</dd></div><div><dt>Số lượng</dt><dd>{record.quantity}</dd></div><div><dt>Tổng tiền</dt><dd>{money(record.total_price)}</dd></div><div><dt>Trạng thái</dt><dd><StatusBadge status={record.status}/></dd></div><div><dt>Nhu cầu</dt><dd>{record.reason || '—'}</dd></div></dl>
      {(owned && record.status === 'DRAFT' || canApprove && record.status === 'PENDING_APPROVAL') && <div className="detail-actions">
        {owned && record.status === 'DRAFT' && <button className="btn btn-secondary" disabled={busy} onClick={() => window.confirm('Gửi yêu cầu này để phê duyệt?') && act(() => procurementService.submit(id), 'PENDING_APPROVAL')}>Gửi phê duyệt</button>}
        {canApprove && record.status === 'PENDING_APPROVAL' && <><button className="btn btn-secondary" disabled={busy} onClick={() => window.confirm('Xác nhận từ chối?') && act(() => procurementService.reject(id, 'Từ chối qua chi tiết'), 'REJECTED')}>Từ chối</button><button className="btn btn-primary" disabled={busy} onClick={() => window.confirm('Xác nhận phê duyệt?') && act(() => procurementService.approve(id), 'APPROVED')}>Phê duyệt</button></>}
      </div>}
      {message && <p role="status">{message}</p>}
    </section>
  </>;
}

export function ApprovalsPage() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const reload = async () => setRows(await approvalService.all());
  useEffect(() => { reload().catch(error => setMessage(error.message)); }, []);
  const decide = async (row, decision) => {
    setBusy(true);
    setMessage('');
    try {
      await approvalService.decide(row, decision);
      if (row.amount === undefined) {
        const verified = await procurementService.get(row.id);
        if (verified.status !== (decision === 'approve' ? 'APPROVED' : 'REJECTED')) throw new Error('Quyết định chưa được xác minh trên máy chủ.');
      }
      await reload();
      setMessage(`Đã ${decision === 'approve' ? 'phê duyệt' : 'từ chối'} ${row.id}.`);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const stats = [
    { label: 'Hồ sơ chờ duyệt', value: rows.length, subtext: 'Mua sắm & chi phí' },
    { label: 'Tổng giá trị thẩm định', value: money(rows.reduce((sum, r) => sum + (Number(r.amount ?? r.total_price) || 0), 0)), subtext: 'Đang trong hàng đợi' },
    { label: 'Thẩm quyền phê duyệt', value: 'Hiệu lực', subtext: 'Theo hạn mức & ủy quyền' }
  ];

  return <>
    <DataPage
      title="Hộp thư phê duyệt"
      subtitle="Thẩm tra và ra quyết định phê duyệt hoặc từ chối các hồ sơ mua sắm, chi phí trong thẩm quyền."
      stats={stats}
      rows={rows}
      columns={[
        { key: 'id', label: 'Hồ sơ' }, { key: 'requester_name', label: 'Người đề xuất' },
        { key: 'department_name', label: 'Phòng ban', render: row => departmentNameLabel(row.department_name) },
        { key: 'amount', label: 'Giá trị', render: row => money(row.amount ?? row.total_price) },
        { key: 'status', label: 'Trạng thái', render: status },
        { key: 'actions', label: 'Thao tác', render: row => <span className="toolbar"><button className="link-button" disabled={busy} onClick={() => window.confirm(`Xác nhận phê duyệt ${row.id}?`) && decide(row, 'approve')}>Duyệt</button><button className="link-button danger" disabled={busy} onClick={() => window.confirm(`Xác nhận từ chối ${row.id}?`) && decide(row, 'reject')}>Từ chối</button></span> }
      ]}
    />
    <DelegationPanel/>{message && <p role="status">{message}</p>}
  </>;
}

export function CataloguePage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  const categories = { monitor: 'Màn hình', laptop: 'Máy tính xách tay', keyboard: 'Bàn phím', mouse: 'Chuột' };
  useEffect(() => { procurementService.products().then(setProducts).catch(cause => setError(cause.message)); }, []);

  const stats = [
    { label: 'Tổng mặt hàng', value: products.length, subtext: 'Danh mục tiêu chuẩn' },
    { label: 'Tình trạng kho', value: `${products.filter(p => p.in_stock !== false).length} Có sẵn`, subtext: 'Sẵn sàng đặt mua' },
    { label: 'Nhà cung cấp đối tác', value: 'Đã duyệt', subtext: 'Bảo hành chính hãng' }
  ];

  return <>
    <DataPage
      title="Danh mục sản phẩm"
      subtitle="Danh mục trang thiết bị CNTT và đồ dùng văn phòng được phép mua sắm nội bộ."
      stats={stats}
      rows={products}
      columns={[
        { key: 'product_id', label: 'Mã sản phẩm' }, { key: 'name', label: 'Sản phẩm', render: row => productNameLabel(row.name) },
        { key: 'category', label: 'Nhóm', render: row => categories[row.category] || row.category }, { key: 'unit_price', label: 'Đơn giá', render: row => money(row.unit_price) },
        { key: 'in_stock', label: 'Tồn kho', render: row => row.in_stock === undefined ? 'Chưa có dữ liệu' : row.in_stock ? 'Có sẵn' : 'Hết hàng' }
      ]}
    />{error && <p role="alert">{error}</p>}
  </>;
}
