import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { accessService } from '../../services/businessService';

const delegationOptions = ['APPROVE_PROCUREMENT', 'APPROVE_EXPENSE', 'CREATE_PROCUREMENT'];
export default function DelegationPanel() {
  const { user } = useAuth();
  const [people, setPeople] = useState([]);
  const [rows, setRows] = useState([]);
  const [toUser, setToUser] = useState('');
  const [permission, setPermission] = useState('APPROVE_PROCUREMENT');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const reload = async () => {
    const [directory, delegations] = await Promise.all([accessService.users(), accessService.delegations()]);
    setPeople(directory.filter(person => person.user_id !== user?.user_id));
    setRows(delegations);
  };
  useEffect(() => { reload().catch(error => setMessage(error.message)); }, [user?.user_id]);
  const create = async event => {
    event.preventDefault();
    setSaving(true);
    try {
      await accessService.createDelegation({ from_user: user.user_id, to_user: toUser, permissions: [permission], start_date: today, end_date: end });
      setMessage('Đã tạo ủy quyền trong phạm vi và hạn mức hiện có.');
      await reload();
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  const revoke = async id => {
    try { await accessService.revokeDelegation(id); setMessage(`Đã thu hồi ${id}.`); await reload(); }
    catch (error) { setMessage(error.message); }
  };
  return <section className="card delegation-panel">
    <div className="section-heading"><h3>Ủy quyền công việc</h3></div>
    <p>Ủy quyền chỉ dùng các quyền, phạm vi và hạn mức mà tài khoản của bạn đang sở hữu.</p>
    <form className="toolbar delegation-form" onSubmit={create}>
      <label>Người được ủy quyền<select required value={toUser} onChange={event => setToUser(event.target.value)}><option value="">Chọn người trong phạm vi</option>{people.map(person => <option key={person.user_id} value={person.user_id}>{person.name} · {person.department_name}</option>)}</select></label>
      <label>Quyền<select value={permission} onChange={event => setPermission(event.target.value)}>{delegationOptions.filter(code => user?.permissions?.includes(code)).map(code => <option key={code}>{code}</option>)}</select></label>
      <button className="btn btn-primary" disabled={saving || !toUser || !user?.permissions?.some(code => delegationOptions.includes(code))} onClick={event => { if (!confirm('Xác nhận tạo ủy quyền trong giới hạn quyền hiện tại?')) event.preventDefault(); }}>Xác nhận ủy quyền</button>
    </form>
    <div className="table-card"><table className="data-table"><thead><tr><th>Mã</th><th>Người giao</th><th>Người nhận</th><th>Thời hạn</th><th>Trạng thái</th><th></th></tr></thead><tbody>{rows.map(row => <tr key={row.delegation_id}><td>{row.delegation_id}</td><td>{row.from_user_name}</td><td>{row.to_user_name}</td><td>{row.start_date} – {row.end_date}</td><td>{row.status}</td><td>{row.status === 'ACTIVE' && row.from_user === user?.user_id && <button type="button" className="link-button danger" onClick={() => confirm(`Thu hồi ${row.delegation_id}?`) && revoke(row.delegation_id)}>Thu hồi</button>}</td></tr>)}</tbody></table>{rows.length === 0 && <p className="empty-state">Chưa có ủy quyền được ghi nhận.</p>}</div>
    {message && <p role="status">{message}</p>}
  </section>;
}
