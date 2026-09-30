import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getStore } from '../services/store';
import { procurementService, expenseService, assetService, meetingService, documentService, policyService, accessService } from '../services/businessService';
import DataPage from '../components/common/DataPage';
import StatusBadge, { statusLabel } from '../components/common/StatusBadge';
import { assignedNameLabel, demoTextLabel, departmentNameLabel, expenseCategoryLabel, localizeDocumentText, localizeProductText, productNameLabel } from '../services/uiText';

function useLoad(loader, deps=[]) { const [data,setData]=useState([]); const [error,setError]=useState(''); useEffect(()=>{let live=true; Promise.resolve(loader()).then(v=>live&&setData(v||[])).catch(e=>live&&setError(e.message)); return()=>{live=false}},deps); return {data,error,setData}; }
const currency = n => typeof n==='number' ? new Intl.NumberFormat('vi-VN').format(n)+' ₫' : n;
const status = row => <StatusBadge status={row.status}/>;
const assetCategoryLabels = { monitor: 'Màn hình', laptop: 'Máy tính xách tay', keyboard: 'Bàn phím', mouse: 'Chuột' };
const fieldLabels = {
  leave_date: 'Ngày nghỉ', reason: 'Lý do', asset_id: 'Mã tài sản', device_name: 'Tên thiết bị',
  serial_number: 'Số sê ri', receiver_name: 'Người nhận', handover_date: 'Ngày bàn giao',
  returner_name: 'Người hoàn trả', return_date: 'Ngày hoàn trả', meeting_id: 'Mã cuộc họp',
  topic: 'Chủ đề', organizer_name: 'Người tổ chức', date_time: 'Ngày và giờ',
  attendees_list: 'Danh sách người tham dự', agenda: 'Nội dung họp', attendee_name: 'Người tham dự',
  role_in_meeting: 'Vai trò trong cuộc họp', subject: 'Tiêu đề', content: 'Nội dung'
};
const translateFieldError = message => Object.entries(fieldLabels).reduce((text, [field, label]) => text.replace(new RegExp(`\\b${field}\\b`, 'g'), label), message);

export function LoginPage(){
  const {login,isAuthenticated}=useAuth();
  const nav=useNavigate();
  const [username,setUsername]=useState('nhanvien1');
  const [password,setPassword]=useState('123');
  const [error,setError]=useState('');
  const [demoAccounts,setDemoAccounts]=useState([]);
  useEffect(()=>{if(isAuthenticated)nav('/agent',{replace:true})},[isAuthenticated]);
  useEffect(()=>{let live=true;getStore().then(store=>{
    const order=['nhanvien1','thaomkt','nhanvien2','quanly1','hr1','admin1','sysadmin1'];
    const accounts=store.getUsers().filter(user=>order.includes(user.username)&&user.account_status==='ACTIVE')
      .sort((a,b)=>order.indexOf(a.username)-order.indexOf(b.username));
    if(live)setDemoAccounts(accounts.map(user=>({username:user.username,role:store.getRoleLabel(user.system_role)})));
  });return()=>{live=false}},[]);
  return <main className="login-shell">
    <div className="login-wrapper">
      <div className="login-hero-panel">
        <div className="hero-badge">
          <span className="hero-badge-dot" aria-hidden="true"></span>
          <span>Doanh nghiệp thông minh · SE373 Ops</span>
        </div>
        <h2 className="hero-title">Không gian Vận hành & Trợ lý Điều phối Doanh nghiệp</h2>
        <p className="hero-desc">
          Nền tảng hợp nhất tự động hóa quy trình mua sắm, quản trị chi phí, tài sản, phê duyệt đa tầng và tra cứu quy định thông minh.
        </p>
        <div className="hero-features">
          <div className="hero-feature-item">
            <span className="feature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </span>
            <div>
              <strong>Trợ lý AI tác nghiệp chính xác</strong>
              <p>Khảo sát ngân sách theo phòng ban, đối soát danh mục và lập tờ trình tự động.</p>
            </div>
          </div>
          <div className="hero-feature-item">
            <span className="feature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>
            <div>
              <strong>Phân quyền & Kiểm soát đa vai trò</strong>
              <p>Ủy quyền linh hoạt theo hạn mức, bảo vệ toàn vẹn thẩm quyền theo cấp quản lý.</p>
            </div>
          </div>
          <div className="hero-feature-item">
            <span className="feature-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </span>
            <div>
              <strong>Tự động sinh văn bản & Email</strong>
              <p>Sinh biểu mẫu chuẩn hóa, đính kèm chứng từ và gửi phê duyệt tức thì.</p>
            </div>
          </div>
        </div>
      </div>
      <form className="card login-card" onSubmit={async e=>{
    e.preventDefault();const result=await login(username,password);
    if(result.success)nav('/agent');else setError(result.error);
  }}>
    <header className="login-heading"><h1>TRỢ LÝ VẬN HÀNH</h1><p>Đăng nhập không gian vận hành doanh nghiệp</p></header>
    <label>Tên đăng nhập<input autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)}/></label>
    <label>Mật khẩu<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
    {error&&<p className="error-text" role="alert">{error}</p>}
    <button className="btn btn-primary login-submit">Đăng nhập</button>
    <section className="demo-account-section" aria-label="Tài khoản dùng thử">
      <div className="demo-account-heading"><strong>Tài khoản dùng thử</strong><span>Mật khẩu: 123</span></div>
      <div className="demo-account-list">{demoAccounts.map(account=><button type="button" className="demo-account-row" key={account.username} onClick={()=>{setUsername(account.username);setPassword('123');setError('')}}>
        <span>{account.role}</span><code>{account.username} / 123</code>
      </button>)}</div>
    </section>
    </form>
    </div>
  </main>;
}
export function MyWorkPage() {
  const { user } = useAuth();
  const work = useLoad(async () => {
    const [store, requests] = await Promise.all([
      getStore(),
      ['EMPLOYEE', 'MANAGER'].includes(user?.system_role) ? procurementService.all() : Promise.resolve([])
    ]);
    return [
      ...store.getMyWorkItems(user?.user_id).filter(item => item.type !== 'Procurement'),
      ...requests.filter(row => row.requester_id === user?.user_id).map(row => ({
        type: 'Procurement',
        ref_id: row.id,
        title: `${row.quantity} × ${productNameLabel(row.product_name)}`,
        amount_str: currency(row.total_price),
        status: row.status,
        date: row.created_at
      }))
    ];
  }, [user?.user_id]);

  const rows = work.data || [];
  const pendingCount = rows.filter(r => r.status === 'PENDING_APPROVAL').length;
  const approvedCount = rows.filter(r => ['APPROVED', 'COMPLETED', 'CONFIRMED'].includes(r.status)).length;
  const draftCount = rows.filter(r => r.status === 'DRAFT').length;

  const stats = [
    { label: 'Tổng nhiệm vụ', value: rows.length, subtext: 'Công việc liên kết tài khoản' },
    { label: 'Chờ phê duyệt', value: pendingCount, subtext: 'Đang đợi quản lý xử lý' },
    { label: 'Đã hoàn tất', value: approvedCount, subtext: 'Đã được duyệt & xác nhận' },
    { label: 'Bản nháp', value: draftCount, subtext: 'Chưa gửi phê duyệt' }
  ];

  return (
    <>
      <DataPage
        title="Công việc của tôi"
        subtitle="Tổng hợp các yêu cầu mua sắm, hồ sơ chi phí và lịch điều phối bạn đang phụ trách."
        stats={stats}
        rows={rows}
        columns={[
          { key: 'ref_id', label: 'Mã' },
          { key: 'type', label: 'Loại', render: row => ({ Procurement: 'Mua sắm', Expense: 'Chi phí', Asset: 'Tài sản', Meeting: 'Cuộc họp' })[row.type] || row.type },
          { key: 'title', label: 'Nội dung', render: row => demoTextLabel(row.title) },
          { key: 'amount_str', label: 'Giá trị' },
          { key: 'status', label: 'Trạng thái', render: status },
          { key: 'date', label: 'Ngày' }
        ]}
      />
      {work.error && <p role="alert">{work.error}</p>}
    </>
  );
}
export function ExpensesPage() {
  const { data } = useLoad(expenseService.all);
  const [show, setShow] = useState(false);
  const [category, setCategory] = useState('Taxi');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [receipt, setReceipt] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(null);

  const rows = data || [];
  const totalAmount = rows.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);
  const pendingCount = rows.filter(r => r.status === 'PENDING_APPROVAL').length;
  const approvedCount = rows.filter(r => r.status === 'APPROVED').length;

  const stats = [
    { label: 'Tổng số hồ sơ', value: rows.length, subtext: 'Hồ sơ chi phí trong phạm vi' },
    { label: 'Chờ phê duyệt', value: pendingCount, subtext: 'Cần quản lý xác nhận' },
    { label: 'Đã duyệt', value: approvedCount, subtext: 'Sẵn sàng thanh toán' },
    { label: 'Tổng chi phí', value: currency(totalAmount), subtext: 'Chi phí thanh toán tích lũy' }
  ];

  const create = async () => {
    try {
      const r = await expenseService.create({ category, amount: Number(amount), reason, receiptFilename: receipt });
      setPending(r);
      setShow(false);
    } catch (e) {
      setMessage(e.message);
    }
  };

  const submit = async () => {
    try {
      await expenseService.submit(pending.id);
      setMessage(`Đã gửi hồ sơ ${pending.id} để phê duyệt.`);
      setPending(null);
    } catch (e) {
      setMessage(e.message);
      setPending(null);
    }
  };

  return (
    <>
      <DataPage
        title="Hồ sơ chi phí"
        subtitle="Quản lý và theo dõi các khoản thanh toán, hoàn ứng công tác theo đúng chính sách."
        stats={stats}
        rows={rows}
        columns={[
          { key: 'id', label: 'Mã hồ sơ' },
          { key: 'requester_name', label: 'Nhân viên' },
          { key: 'category', label: 'Danh mục', render: row => expenseCategoryLabel(row.category) },
          { key: 'amount', label: 'Số tiền', render: r => currency(r.amount) },
          { key: 'expense_date', label: 'Ngày chi' },
          { key: 'status', label: 'Trạng thái', render: status },
          { key: 'details', label: '', render: r => <Link to={`/expenses/${r.id}`}>Chi tiết</Link> }
        ]}
        actions={<button className="btn btn-primary" onClick={() => setShow(true)}>Tạo hồ sơ chi phí</button>}
      />
      {message && <p>{message}</p>}
      {show && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Tạo hồ sơ chi phí</h3>
            <label>Khoản mục<input value={category} onChange={e => setCategory(e.target.value)} /></label>
            <label>Số tiền<input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label>Lý do<input value={reason} onChange={e => setReason(e.target.value)} /></label>
            <label>Chứng từ<input value={receipt} onChange={e => setReceipt(e.target.value)} placeholder="Tên tệp chứng từ" /></label>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShow(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={() => confirm('Xác nhận tạo hồ sơ chi phí?') && create()}>Tạo hồ sơ</button>
            </div>
          </div>
        </div>
      )}
      {pending && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Hồ sơ {pending.id} đã tạo</h3>
            <p>Kiểm tra nội dung và chứng từ, rồi xác nhận gửi đến quản lý.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setPending(null)}>Để bản nháp</button>
              <button className="btn btn-primary" onClick={() => confirm(`Xác nhận gửi hồ sơ ${pending.id}?`) && submit()}>Gửi phê duyệt</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
export function ExpenseDetailPage(){
  const {id}=useParams();const {user}=useAuth();const [reload,setReload]=useState(0);
  const {data,error}=useLoad(async()=>{const s=await getStore(),r=s.getExpenseById(id);if(!r||!s.canViewExpenseClaim(s.getCurrentUser(),r))throw new Error('Không tìm thấy hồ sơ hoặc bạn không có quyền xem.');return {record:r,approval:s.canApproveExpenseClaim(s.getCurrentUser().user_id,r).allowed}},[id,reload]);
  const [message,setMessage]=useState('');
  const act=async action=>{try{await action(id);setMessage('Đã cập nhật.');setReload(x=>x+1)}catch(e){setMessage(e.message)}};
  if(error)return <p role="alert">{error}</p>;if(!data?.record?.id)return <p className="loading">Đang tải…</p>;
  const record=data.record,owned=record.requester_id===user?.user_id,manager=data.approval;
  return <><div className="page-heading"><div><h2>Hồ sơ chi phí</h2><p>Thông tin và trạng thái xử lý của hồ sơ.</p></div><Link to="/expenses">Quay lại danh sách</Link></div>
    <section className="card detail-card"><header className="detail-card-header"><div className="detail-title-group"><span className="detail-badge-pill">Hồ sơ nghiệp vụ</span><h2>{record.id}</h2><p>{record.requester_name} · {departmentNameLabel(record.department_name)}</p></div><div className="detail-status-group"><StatusBadge status={record.status}/><span className="detail-hero-amount">{currency(record.amount)}</span></div></header>
      <dl className="detail-grid"><div><dt>Khoản mục</dt><dd>{expenseCategoryLabel(record.category)}</dd></div><div><dt>Số tiền</dt><dd>{currency(record.amount)}</dd></div><div><dt>Ngày chi</dt><dd>{record.expense_date||'—'}</dd></div><div><dt>Trạng thái</dt><dd><StatusBadge status={record.status}/></dd></div><div><dt>Lý do</dt><dd>{demoTextLabel(record.reason)||'—'}</dd></div><div><dt>Chứng từ</dt><dd>{record.receipt_ref||record.receipt_filename||'—'}</dd></div></dl>
      {(owned&&record.status==='DRAFT'||manager&&record.status==='PENDING_APPROVAL')&&<div className="detail-actions">{owned&&record.status==='DRAFT'&&<button className="btn btn-secondary" onClick={()=>confirm('Gửi hồ sơ chi phí?')&&act(expenseService.submit)}>Gửi phê duyệt</button>}{manager&&record.status==='PENDING_APPROVAL'&&<><button className="btn btn-secondary" onClick={()=>confirm('Xác nhận từ chối chi phí?')&&act(id=>expenseService.reject(id,'Từ chối qua chi tiết'))}>Từ chối</button><button className="btn btn-primary" onClick={()=>confirm('Xác nhận phê duyệt chi phí?')&&act(expenseService.approve)}>Phê duyệt</button></>}</div>}
      {message&&<p role="status">{message}</p>}
    </section></>;
}
export function AssetsPage(){const {data,setData}=useLoad(assetService.all);const [message,setMessage]=useState('');const [confirming,setConfirming]=useState(null);const user=useAuth().user;const [canAssign,setCanAssign]=useState(false);useEffect(()=>{assetService.canAssign().then(setCanAssign).catch(()=>setCanAssign(false))},[user?.user_id]);const action=async asset=>{try{if(asset.status==='AVAILABLE')await assetService.assign(asset.id,user.user_id);else await assetService.returnForUser(asset.id,user.user_id);setMessage('Đã cập nhật tài sản.');setData(await assetService.all())}catch(e){setMessage(e.message)}setConfirming(null)};const rows = data || [];const stats = [{ label: 'Tổng thiết bị', value: rows.length, subtext: 'Thiết bị & tài sản quản lý' },{ label: 'Đang cấp phát', value: rows.filter(r => r.status === 'ASSIGNED').length, subtext: 'Nhân sự đang sử dụng' },{ label: 'Sẵn sàng trong kho', value: rows.filter(r => r.status === 'AVAILABLE').length, subtext: 'Khả dụng cấp mới ngay' }];return <><DataPage title="Tài sản" subtitle="Quản lý vòng đời tài sản công nghệ, bàn giao và thu hồi thiết bị làm việc." stats={stats} rows={data} columns={[{key:'asset_id',label:'Mã tài sản'},{key:'device_name',label:'Tên thiết bị',render:r=>localizeProductText(r.device_name)},{key:'category',label:'Loại',render:r=>assetCategoryLabels[r.category]||r.category},{key:'assigned_name',label:'Người sử dụng',render:row=>assignedNameLabel(row.assigned_name)},{key:'department_name',label:'Phòng ban',render:row=>departmentNameLabel(row.department_name)},{key:'status',label:'Trạng thái',render:status},{key:'id',label:'Thao tác',render:r=><button className="link-button" disabled={!['AVAILABLE','ASSIGNED'].includes(r.status)|| (r.status==='ASSIGNED'&&r.assigned_to!==user?.user_id&&!canAssign)||(r.status==='AVAILABLE'&&!canAssign)} onClick={()=>setConfirming(r)}>{r.status==='AVAILABLE'?'Cấp phát':'Hoàn trả'}</button>}]} />{message&&<p>{message}</p>}{confirming&&<div className="modal-overlay"><div className="modal-content"><h3>Xác nhận {confirming.status==='AVAILABLE'?'cấp phát':'hoàn trả'} tài sản</h3><p>{localizeProductText(confirming.device_name)} · {confirming.asset_id}</p><div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setConfirming(null)}>Hủy</button><button className="btn btn-primary" onClick={()=>action(confirming)}>Xác nhận</button></div></div></div>}</>}
export function MeetingsPage(){const {data}=useLoad(meetingService.all);const [show,setShow]=useState(false),[title,setTitle]=useState(''),[date,setDate]=useState(''),[attendees,setAttendees]=useState([]),[users,setUsers]=useState([]),[message,setMessage]=useState('');useEffect(()=>{getStore().then(s=>setUsers(s.getUsers().filter(u=>u.account_status==='ACTIVE')))},[]);const rows = data || [];const stats = [{ label: 'Tổng cuộc họp', value: rows.length, subtext: 'Lịch họp trong hệ thống' },{ label: 'Đã lên lịch', value: rows.filter(r => r.status === 'SCHEDULED').length, subtext: 'Cuộc họp có hiệu lực' },{ label: 'Lượt tham gia', value: rows.reduce((acc, c) => acc + (c.attendee_count || 0), 0), subtext: 'Tổng nhân sự được mời' }];const create=async()=>{try{await meetingService.create({topic:title,date_time:date,attendees:attendees.map(id=>{const u=users.find(x=>x.user_id===id);return {user_id:id,name:u?.name}})});setMessage('Đã tạo cuộc họp.');setShow(false)}catch(e){setMessage(e.message)}};return <><DataPage title="Cuộc họp" subtitle="Điều phối lịch họp kỹ thuật và hội đồng ra quyết định vận hành." stats={stats} rows={data} columns={[{key:'id',label:'Mã'},{key:'topic',label:'Chủ đề',render:row=>demoTextLabel(row.topic)},{key:'organizer_name',label:'Người tổ chức'},{key:'date_time',label:'Ngày, giờ'},{key:'attendee_count',label:'Người tham dự'},{key:'status',label:'Trạng thái',render:status}]} actions={<button className="btn btn-primary" onClick={()=>setShow(true)}>Tạo cuộc họp</button>}/>{message&&<p>{message}</p>}{show&&<div className="modal-overlay"><div className="modal-content"><h3>Tạo cuộc họp</h3><label>Chủ đề<input required value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Ngày và giờ<input required type="datetime-local" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Người tham dự<select multiple value={attendees} onChange={e=>setAttendees([...e.target.selectedOptions].map(o=>o.value))}>{users.map(u=><option value={u.user_id} key={u.user_id}>{u.name} · {departmentNameLabel(u.department_name)}</option>)}</select></label><div className="modal-actions"><button className="btn btn-secondary" onClick={()=>setShow(false)}>Hủy</button><button className="btn btn-primary" onClick={event=>{if(!event.currentTarget.closest('form')&&(!title.trim()||!date)){setMessage('Nhập chủ đề và ngày giờ hợp lệ trước khi tạo cuộc họp.');return;}if(confirm('Xác nhận tạo cuộc họp với danh sách tham dự đã chọn?'))create()}}>Xác nhận</button></div></div></div>}</>}
export function FormsPage(){const {search}=useLocation();const {user}=useAuth();const {data}=useLoad(documentService.all);const [templates,setTemplates]=useState([]),[selected,setSelected]=useState(''),[preview,setPreview]=useState(null),[message,setMessage]=useState(''),[recipient,setRecipient]=useState(''),[subject,setSubject]=useState(''),[body,setBody]=useState(''),[fieldValues,setFieldValues]=useState({}),[relatedId,setRelatedId]=useState(''),[relatedRows,setRelatedRows]=useState([]);useEffect(()=>{getStore().then(s=>{const t=s.getFormTemplates();setTemplates(t);const requested=new URLSearchParams(search).get('template');setSelected(t.find(x=>x.form_id===requested)?.form_id||t[0]?.form_id||'')})},[search]);useEffect(()=>{setRelatedId('');setFieldValues({});if(selected==='FORM-PROC-001')procurementService.all().then(setRelatedRows).catch(error=>setMessage(error.message));else if(selected==='FORM-EXP-001')expenseService.all().then(setRelatedRows);else setRelatedRows([])},[selected]);const rows = data || [];const stats = [{ label: 'Mẫu biểu khả dụng', value: templates.length, subtext: 'Mẫu văn bản chuẩn hóa' },{ label: 'Văn bản đã lập', value: rows.length, subtext: 'Hồ sơ đã tạo chính thức' },{ label: 'Email đã phát hành', value: rows.filter(r => r.status === 'SENT').length, subtext: 'Đã gửi qua luồng duyệt' }];const template=templates.find(t=>t.form_id===selected);const generate=async()=>{try{if(!confirm('Xác nhận tạo văn bản chính thức? Hãy kiểm tra thông tin trước khi tiếp tục.'))return;const relatedWorkflow=selected==='FORM-PROC-001'?'Mua sắm':selected==='FORM-EXP-001'?'Chi phí':'';const doc=await documentService.generate({formId:selected,populatedData:fieldValues,relatedEntityId:relatedId||null,relatedWorkflow});setPreview(doc);setMessage(`Đã tạo ${doc.id}`)}catch(e){setMessage(translateFieldError(e.message))}};const view=async id=>{try{const d=await documentService.get(id);setPreview(d);setRecipient(d.email_draft?.to||'');setSubject(d.email_draft?.subject||'');setBody(d.email_draft?.body||'')}catch(e){setMessage(translateFieldError(e.message))}};const makeDraft=async()=>{try{const d=await documentService.draft({docId:preview.id,to:recipient||undefined,subject,body});setPreview({...preview,email_draft:d});setMessage('Đã tạo bản nháp email.')}catch(e){setMessage(translateFieldError(e.message))}};const send=async()=>{try{if(!confirm(`Xác nhận gửi email đến ${preview.email_draft?.to}?`))return;const sent=await documentService.send(preview.id);setPreview({...preview,email_draft:sent,status:'SENT'});setMessage('Đã gửi email (mô phỏng).')}catch(e){setMessage(translateFieldError(e.message))}};return <><DataPage title="Biểu mẫu & văn bản" subtitle="Hệ thống tự động sinh tờ trình, biểu mẫu mua sắm, đề xuất nghỉ phép và dự thảo email." stats={stats} rows={data} columns={[{key:'id',label:'Mã văn bản'},{key:'title',label:'Tiêu đề'},{key:'template_name',label:'Mẫu'},{key:'related_workflow',label:'Quy trình'},{key:'created_at',label:'Ngày tạo'},{key:'status',label:'Trạng thái',render:status},{key:'actions',label:'',render:r=><button className="link-button" onClick={()=>view(r.id)}>Xem</button>}]} actions={<div className="toolbar"><select value={selected} onChange={e=>{setSelected(e.target.value);setFieldValues({})}}>{templates.map(t=><option key={t.form_id} value={t.form_id}>{t.name}</option>)}</select>{template&&<button className="btn btn-primary" onClick={()=>setPreview({formOnly:true})}>Chuẩn bị văn bản</button>}</div>}/>{message&&<p>{message}</p>}{preview?.formOnly&&template&&<div className="modal-overlay"><div className="modal-content document-preview"><button className="close-button" onClick={()=>setPreview(null)}>Đóng</button><h3>{template.name}</h3><p>{template.description}</p>{['FORM-PROC-001','FORM-EXP-001'].includes(selected)&&<label>Hồ sơ liên kết<select value={relatedId} onChange={e=>setRelatedId(e.target.value)}><option value=''>Chọn hồ sơ</option>{relatedRows.map(row=><option key={row.id} value={row.id}>{row.id} · {statusLabel(row.status)}</option>)}</select></label>}{['FORM-PROC-001','FORM-EXP-001'].includes(selected)&&!relatedId&&<p>Chọn hồ sơ liên kết để điền dữ liệu đã xác thực.</p>}{(template.required_fields||[]).filter(f=>!['employee_name','employee_id','department','job_title','manager_name','request_id','claim_id','product_name','quantity','unit_price','total_price','category','amount','expense_date','receipt_ref'].includes(f)).map(f=><label key={f}>{fieldLabels[f]||f}<input value={fieldValues[f]||''} onChange={e=>setFieldValues(v=>({...v,[f]:e.target.value}))}/></label>)}<button className="btn btn-primary" disabled={['FORM-PROC-001','FORM-EXP-001'].includes(selected)&&!relatedId} onClick={generate}>Xác nhận và sinh văn bản</button></div></div>}{preview&&!preview.formOnly&&<div className="modal-overlay"><div className="modal-content document-preview"><button className="close-button" onClick={()=>setPreview(null)}>Đóng</button><h3>{preview.title}</h3><p>Mã {preview.id} · {preview.related_workflow}</p><pre>{localizeDocumentText(preview.content)}</pre>{preview.email_draft?<section><h4>Bản nháp email</h4><dl className="email-fields"><dt>Từ</dt><dd>{user?.email||user?.username}</dd><dt>Đến</dt><dd>{preview.email_draft.to}</dd><dt>Tiêu đề</dt><dd>{preview.email_draft.subject}</dd></dl><p>{localizeDocumentText(preview.email_draft.body)}</p>{preview.email_draft.attachment&&<div className="document-attachment">Tệp đính kèm · {preview.email_draft.attachment}</div>}{preview.email_draft.status!=='SENT'&&<button className="btn btn-primary" onClick={send}>Gửi email</button>}</section>:<section><h4>Tạo bản nháp email</h4><label>Người nhận<input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Bỏ trống để dùng quản lý trực tiếp"/></label><label>Tiêu đề<input value={subject} onChange={e=>setSubject(e.target.value)}/></label><label>Nội dung<textarea value={body} onChange={e=>setBody(e.target.value)}/></label><button className="btn btn-secondary" onClick={makeDraft}>Tạo bản nháp</button></section>}</div></div>}</>}
export function PoliciesPage(){const {data}=useLoad(policyService.all);const rows = data || [];const stats = [{ label: 'Điều khoản quy định', value: rows.length, subtext: 'Chính sách vận hành nội bộ' },{ label: 'Lĩnh vực nghiệp vụ', value: new Set(rows.map(p => p.section)).size, subtext: 'Phân loại theo quy trình' },{ label: 'Độ tin cậy RAG', value: '100%', subtext: 'Trích dẫn nguồn chính xác' }];return <DataPage title="Quy định nội bộ" subtitle="Cơ sở tri thức pháp quy và chính sách nội bộ được AI đối soát tự động." stats={stats} rows={data} columns={[{key:'id',label:'Mã'},{key:'section',label:'Mục'},{key:'title',label:'Quy định'},{key:'summary',label:'Tóm tắt'},{key:'excerpt',label:'Nội dung'}]}/>}
export function ActivityPage(){const {data}=useLoad(async()=>(await getStore()).getAgentRuns());const rows = data || [];const stats = [{ label: 'Lượt tác nghiệp AI', value: rows.length, subtext: 'Phiên hội thoại và lệnh' },{ label: 'Hoàn thành đúng luật', value: rows.filter(r => r.status === 'SUCCESS').length, subtext: 'Đã thẩm tra chính sách' },{ label: 'Kỹ năng kích hoạt', value: new Set(rows.map(r => r.skill)).size, subtext: 'Kỹ năng nghiệp vụ sử dụng' }];return <DataPage title="Nhật ký mô phỏng" subtitle="Bản ghi kiểm toán mọi lượt thực thi và tương tác của Trợ lý vận hành." stats={stats} rows={rows} columns={[{key:'run_id',label:'Mã'},{key:'timestamp',label:'Thời gian'},{key:'skill',label:'Kỹ năng',render:row=>({Procurement:'Mua sắm',Expenses:'Chi phí',Meetings:'Cuộc họp'})[row.skill]||row.skill},{key:'intent',label:'Tác vụ',render:row=>demoTextLabel(row.intent)||'—'},{key:'status',label:'Kết quả',render:status}]}/>}
