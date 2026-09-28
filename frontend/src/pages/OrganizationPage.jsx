import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStore } from '../services/store';
import { accessService } from '../services/businessService';
import DataPage from '../components/common/DataPage';
import DelegationPanel from '../components/business/DelegationPanel';

const roles = ['EMPLOYEE', 'MANAGER', 'HR', 'OPS_ADMIN', 'SYSTEM_ADMIN'];
const currency = value => new Intl.NumberFormat('vi-VN').format(Number(value) || 0);

export default function OrganizationPage() {
  const { user } = useAuth();
  const role = user?.system_role;
  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null);
  const [editRole, setEditRole] = useState('EMPLOYEE');
  const [editPermissions, setEditPermissions] = useState([]);
  const [editDepartments, setEditDepartments] = useState([]);
  const [editLimit, setEditLimit] = useState('0');
  const [accountDraft, setAccountDraft] = useState(null);
  const [profileDraft, setProfileDraft] = useState(null);
  const [profileDepartment, setProfileDepartment] = useState('');
  const [profileManager, setProfileManager] = useState('');
  const [profileTitle, setProfileTitle] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const reload = async () => setRows(await accessService.users());
  useEffect(() => {
    let live = true;
    Promise.all([accessService.users(), getStore()]).then(([people, store]) => {
      if (!live) return;
      setRows(people);
      const deptList = store.getDepartments();
      setDepartments(deptList.map(dept => ({ id: dept.id || dept.department_id, name: dept.name || dept.department_name })));
      setPermissionOptions([...new Set(store.getUsers().flatMap(person => person.permissions || []))].sort());
    }).catch(error => setMessage(error.message));
    return () => { live = false; };
  }, [role]);

  const changeStatus = async (person, nextStatus) => {
    if (nextStatus === person.account_status) return;
    if (!confirm(`Xác nhận đổi trạng thái tài khoản ${person.user_id} thành ${nextStatus}?`)) return;
    try { await accessService.setAccountStatus(person.user_id, nextStatus); setMessage(`Đã cập nhật tài khoản ${person.user_id}.`); await reload(); }
    catch (error) { setMessage(error.message); }
  };
  const openAccess = person => {
    setEditing(person);
    setEditRole(person.system_role || 'EMPLOYEE');
    setEditPermissions(person.permissions || []);
    setEditDepartments(person.scope?.department_ids || [person.department_id].filter(Boolean));
    setEditLimit(String(person.scope?.approval_limit || 0));
  };
  const saveAccess = async event => {
    event.preventDefault();
    if (!confirm(`Xác nhận cập nhật vai trò và quyền cho ${editing.user_id}?`)) return;
    try {
      await accessService.updateUserAccess(editing.user_id, {
        system_role: editRole,
        permissions: editPermissions,
        scope: { department_ids: editDepartments, approval_limit: Number(editLimit) }
      });
      setEditing(null); setMessage(`Đã cập nhật quyền truy cập cho ${editing.user_id}.`); await reload();
    } catch (error) { setMessage(error.message); }
  };
  const createAccount = async event => {
    event.preventDefault();
    if (!confirm(`Xác nhận cấp tài khoản cho ${accountDraft.user_id}?`)) return;
    try {
      await accessService.createUserAccount(accountDraft.user_id, { username, email });
      setAccountDraft(null); setUsername(''); setEmail(''); setMessage(`Đã kích hoạt tài khoản ${accountDraft.user_id}.`); await reload();
    } catch (error) { setMessage(error.message); }
  };
  const saveProfile = async event => {
    event.preventDefault();
    if (!confirm(`Xác nhận cập nhật hồ sơ nhân sự ${profileDraft.user_id}?`)) return;
    try {
      await accessService.updateEmployeeOrganization(profileDraft.user_id, { department_id: profileDepartment, manager_id: profileManager, job_title: profileTitle });
      setProfileDraft(null); setMessage(`Đã cập nhật hồ sơ ${profileDraft.user_id}.`); await reload();
    } catch (error) { setMessage(error.message); }
  };

  const columns = role === 'HR'
    ? [{key:'user_id',label:'Mã nhân sự'},{key:'name',label:'Họ tên'},{key:'department_name',label:'Phòng ban'},{key:'job_title',label:'Chức danh'},{key:'manager_id',label:'Quản lý trực tiếp'},{key:'actions',label:'Thao tác',render:person=><button className="link-button" onClick={()=>{setProfileDraft(person);setProfileDepartment(person.department_id);setProfileManager(person.manager_id||'');setProfileTitle(person.job_title||'')}}>Cập nhật hồ sơ</button>}]
    : role === 'SYSTEM_ADMIN'
      ? [{key:'user_id',label:'Mã nhân sự'},{key:'name',label:'Họ tên'},{key:'department_name',label:'Phòng ban'},{key:'username',label:'Tên đăng nhập'},{key:'system_role',label:'Vai trò'},
        {key:'account_status',label:'Trạng thái tài khoản',render:person=><select aria-label={`Trạng thái ${person.user_id}`} value={person.account_status} onChange={event=>changeStatus(person,event.target.value)}>{['PENDING','ACTIVE','DISABLED'].map(value=><option key={value}>{value}</option>)}</select>},
        {key:'actions',label:'Thao tác',render:person=>person.account_status!=='ACTIVE'&&<button className="link-button" onClick={()=>setAccountDraft(person)}>Cấp tài khoản</button>}]
      : [{key:'user_id',label:'Mã nhân sự'},{key:'name',label:'Họ tên'},{key:'department_name',label:'Phòng ban'},{key:'system_role',label:'Vai trò'},{key:'account_status',label:'Tài khoản'},{key:'permissions',label:'Quyền',render:person=>(person.permissions||[]).join(', ')},{key:'scope',label:'Phạm vi / hạn mức',render:person=>`${(person.scope?.department_ids||[]).join(', ')} · ${currency(person.scope?.approval_limit)} VND`},{key:'actions',label:'Thao tác',render:person=><button className="link-button" onClick={()=>openAccess(person)}>Cấu hình quyền</button>}];

  return <>
    <DataPage title={role==='HR'?'Hồ sơ nhân sự':role==='SYSTEM_ADMIN'?'Quản trị tài khoản':'Phân quyền vận hành'} rows={rows} columns={columns}/>
    {message&&<p role="status">{message}</p>}
    {role==='OPS_ADMIN'&&<DelegationPanel/>}
    {profileDraft&&<div className="modal-overlay"><form className="modal-content" onSubmit={saveProfile}>
      <h3>Hồ sơ nhân sự · {profileDraft.name}</h3>
      <label>Phòng ban<select value={profileDepartment} onChange={event=>setProfileDepartment(event.target.value)}>{departments.map(dept=><option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>
      <label>Quản lý trực tiếp<select value={profileManager} onChange={event=>setProfileManager(event.target.value)}><option value="">Chưa chỉ định</option>{rows.filter(person=>person.user_id!==profileDraft.user_id).map(person=><option key={person.user_id} value={person.user_id}>{person.name} · {person.user_id}</option>)}</select></label>
      <label>Chức danh<input required value={profileTitle} onChange={event=>setProfileTitle(event.target.value)}/></label>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setProfileDraft(null)}>Hủy</button><button className="btn btn-primary">Lưu hồ sơ</button></div>
    </form></div>}
    {editing&&<div className="modal-overlay"><form className="modal-content" onSubmit={saveAccess}>
      <h3>Cấu hình quyền · {editing.name}</h3>
      <label>Vai trò hệ thống<select value={editRole} onChange={event=>setEditRole(event.target.value)}>{roles.map(value=><option key={value}>{value}</option>)}</select></label>
      <fieldset><legend>Phạm vi phòng ban</legend>{departments.map(dept=><label key={dept.id}><input type="checkbox" checked={editDepartments.includes(dept.id)} onChange={event=>setEditDepartments(current=>event.target.checked?[...current,dept.id]:current.filter(id=>id!==dept.id))}/>{dept.name}</label>)}</fieldset>
      <label>Hạn mức phê duyệt (VND)<input type="number" min="0" value={editLimit} onChange={event=>setEditLimit(event.target.value)}/></label>
      <fieldset><legend>Quyền được gán</legend><div className="perm-checkbox-grid">{permissionOptions.map(code=><label key={code}><input type="checkbox" checked={editPermissions.includes(code)} onChange={event=>setEditPermissions(current=>event.target.checked?[...current,code]:current.filter(value=>value!==code))}/>{code}</label>)}</div></fieldset>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setEditing(null)}>Hủy</button><button className="btn btn-primary">Lưu quyền</button></div>
    </form></div>}
    {accountDraft&&<div className="modal-overlay"><form className="modal-content" onSubmit={createAccount}>
      <h3>Cấp tài khoản · {accountDraft.name}</h3><label>Tên đăng nhập<input required autoComplete="off" value={username} onChange={event=>setUsername(event.target.value)}/></label><label>Email công ty<input required type="email" value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <p>Tài khoản được kích hoạt sau khi xác nhận; mật khẩu demo do Store quản lý.</p><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setAccountDraft(null)}>Hủy</button><button className="btn btn-primary">Cấp và kích hoạt</button></div>
    </form></div>}
  </>;
}
