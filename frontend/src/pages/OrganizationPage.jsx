import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getStore } from '../services/store';
import { accessService } from '../services/businessService';
import DataPage from '../components/common/DataPage';
import DelegationPanel from '../components/business/DelegationPanel';
import { statusLabel } from '../components/common/StatusBadge';
import { SYSTEM_PERMISSIONS_CATALOGUE } from '../data/mockData';
import { departmentNameLabel, jobTitleLabel } from '../services/uiText';

const roles = ['EMPLOYEE', 'MANAGER', 'HR', 'OPS_ADMIN', 'SYSTEM_ADMIN'];
const roleNames = { EMPLOYEE: 'Nhân viên', MANAGER: 'Quản lý', HR: 'Nhân sự', OPS_ADMIN: 'Quản trị vận hành', SYSTEM_ADMIN: 'Quản trị hệ thống' };
const permissionNames = Object.fromEntries(SYSTEM_PERMISSIONS_CATALOGUE.map(permission => [permission.code, permission.name]));
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
      setDepartments(deptList.map(dept => ({ id: dept.id || dept.department_id, name: departmentNameLabel(dept.name || dept.department_name) })));
      setPermissionOptions([...new Set(store.getUsers().flatMap(person => person.permissions || []))].sort());
    }).catch(error => setMessage(error.message));
    return () => { live = false; };
  }, [role]);

  const changeStatus = async (person, nextStatus) => {
    if (nextStatus === person.account_status) return;
    if (!confirm(`Xác nhận đổi trạng thái tài khoản ${person.user_id} thành ${statusLabel(nextStatus)}?`)) return;
    try { await accessService.setAccountStatus(person.user_id, nextStatus); setMessage(`Đã cập nhật tài khoản mô phỏng ${person.user_id}.`); await reload(); }
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
      setEditing(null); setMessage(`Đã cập nhật quyền mô phỏng cho ${editing.user_id}.`); await reload();
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
      const jobTitle = profileTitle === jobTitleLabel(profileDraft.job_title) ? profileDraft.job_title : profileTitle;
      await accessService.updateEmployeeOrganization(profileDraft.user_id, { department_id: profileDepartment, manager_id: profileManager, job_title: jobTitle });
      setProfileDraft(null); setMessage(`Đã cập nhật hồ sơ ${profileDraft.user_id}.`); await reload();
    } catch (error) { setMessage(error.message); }
  };

  const columns = role === 'HR'
    ? [{key:'user_id',label:'Mã nhân sự'},{key:'name',label:'Họ tên'},{key:'department_name',label:'Phòng ban',render:person=>departmentNameLabel(person.department_name)},{key:'job_title',label:'Chức danh',render:person=>jobTitleLabel(person.job_title)},{key:'manager_id',label:'Quản lý trực tiếp'},{key:'actions',label:'Thao tác',render:person=><button className="link-button" onClick={()=>{setProfileDraft(person);setProfileDepartment(person.department_id);setProfileManager(person.manager_id||'');setProfileTitle(jobTitleLabel(person.job_title)||'')}}>Cập nhật hồ sơ</button>}]
    : role === 'SYSTEM_ADMIN'
      ? [{key:'user_id',label:'Mã nhân sự'},{key:'name',label:'Họ tên'},{key:'department_name',label:'Phòng ban',render:person=>departmentNameLabel(person.department_name)},{key:'username',label:'Tên đăng nhập'},{key:'system_role',label:'Vai trò',render:person=>roleNames[person.system_role]||person.system_role},
        {key:'account_status',label:'Trạng thái tài khoản',render:person=><select aria-label={`Trạng thái ${person.user_id}`} value={person.account_status} onChange={event=>changeStatus(person,event.target.value)}>{['PENDING','ACTIVE','DISABLED'].map(value=><option key={value} value={value}>{statusLabel(value)}</option>)}</select>},
        {key:'actions',label:'Thao tác',render:person=>person.account_status!=='ACTIVE'&&<button className="link-button" onClick={()=>setAccountDraft(person)}>Cấp tài khoản</button>}]
      : [{key:'user_id',label:'Mã nhân sự'},{key:'name',label:'Họ tên'},{key:'department_name',label:'Phòng ban',render:person=>departmentNameLabel(person.department_name)},{key:'system_role',label:'Vai trò',render:person=>roleNames[person.system_role]||person.system_role},{key:'account_status',label:'Tài khoản',render:person=>statusLabel(person.account_status)},{key:'permissions',label:'Quyền',render:person=>(person.permissions||[]).map(code=>permissionNames[code]||code).join(', ')},{key:'scope',label:'Phạm vi / hạn mức',render:person=>`${(person.scope?.department_ids||[]).join(', ')} · ${currency(person.scope?.approval_limit)} VND`},{key:'actions',label:'Thao tác',render:person=><button className="link-button" onClick={()=>openAccess(person)}>Cấu hình quyền</button>}];

  const stats = role === 'HR' ? [
    { label: 'Tổng nhân sự', value: rows.length, subtext: 'Hồ sơ nhân sự công ty' },
    { label: 'Phòng ban', value: departments.length, subtext: 'Đơn vị tổ chức trực thuộc' },
    { label: 'Đã gán quản lý', value: rows.filter(person => person.manager_id).length, subtext: 'Báo cáo trực tiếp' }
  ] : role === 'SYSTEM_ADMIN' ? [
    { label: 'Tổng tài khoản', value: rows.length, subtext: 'Định danh hệ thống' },
    { label: 'Đang hoạt động', value: rows.filter(person => person.account_status === 'ACTIVE').length, subtext: 'Tài khoản có hiệu lực' },
    { label: 'Chờ kích hoạt', value: rows.filter(person => person.account_status === 'PENDING').length, subtext: 'Cần cấp quyền truy cập' }
  ] : [
    { label: 'Tổng nhân sự', value: rows.length, subtext: 'Nhân sự trong phạm vi' },
    { label: 'Cấp phê duyệt', value: rows.filter(person => ['MANAGER', 'OPS_ADMIN'].includes(person.system_role)).length, subtext: 'Có thẩm quyền ký duyệt' },
    { label: 'Quy tắc phân quyền', value: permissionOptions.length, subtext: 'Thẩm quyền gán động' }
  ];

  return <>
    <DataPage
      title={role==='HR'?'Hồ sơ nhân sự':role==='SYSTEM_ADMIN'?'Quản trị tài khoản':'Phân quyền vận hành'}
      subtitle={role==='HR'?'Quản lý cây cơ cấu phòng ban, sơ đồ báo cáo và chức danh nhân sự.':role==='SYSTEM_ADMIN'?'Quản trị trạng thái kích hoạt, tên đăng nhập và phân cấp vai trò.':'Kiểm soát ma trận phân quyền, phạm vi phòng ban và hạn mức ký duyệt.'}
      stats={stats}
      rows={rows}
      columns={columns}
    />
    {['SYSTEM_ADMIN','OPS_ADMIN'].includes(role)&&<p>Thay đổi tài khoản, phân quyền và ủy quyền ở màn này chỉ áp dụng cho dữ liệu mô phỏng. Quyền mua sắm thực tế do máy chủ kiểm soát.</p>}
    {message&&<p role="status">{message}</p>}
    {role==='OPS_ADMIN'&&<DelegationPanel/>}
    {profileDraft&&<div className="modal-overlay"><form className="modal-content" onSubmit={saveProfile}>
      <h3>Hồ sơ nhân sự · {profileDraft.name}</h3>
      <label>Phòng ban<select value={profileDepartment} onChange={event=>setProfileDepartment(event.target.value)}>{departments.map(dept=><option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label>
      <label>Quản lý trực tiếp<select value={profileManager} onChange={event=>setProfileManager(event.target.value)}><option value="">Chưa chỉ định</option>{rows.filter(person=>person.user_id!==profileDraft.user_id).map((person, idx)=><option key={`${person.user_id}-${idx}`} value={person.user_id}>{person.name} · {person.user_id}</option>)}</select></label>
      <label>Chức danh<input required value={profileTitle} onChange={event=>setProfileTitle(event.target.value)}/></label>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setProfileDraft(null)}>Hủy</button><button className="btn btn-primary">Lưu hồ sơ</button></div>
    </form></div>}
    {editing&&<div className="modal-overlay"><form className="modal-content" onSubmit={saveAccess}>
      <h3>Cấu hình quyền · {editing.name}</h3>
      <p>Cấu hình này chỉ thay đổi dữ liệu mô phỏng, không thay đổi quyền mua sắm trên máy chủ.</p>
      <label>Vai trò hệ thống<select value={editRole} onChange={event=>setEditRole(event.target.value)}>{roles.map(value=><option key={value} value={value}>{roleNames[value]}</option>)}</select></label>
      <fieldset><legend>Phạm vi phòng ban</legend>{departments.map(dept=><label key={dept.id}><input type="checkbox" checked={editDepartments.includes(dept.id)} onChange={event=>setEditDepartments(current=>event.target.checked?[...current,dept.id]:current.filter(id=>id!==dept.id))}/>{dept.name}</label>)}</fieldset>
      <label>Hạn mức phê duyệt (VND)<input type="number" min="0" value={editLimit} onChange={event=>setEditLimit(event.target.value)}/></label>
      <fieldset><legend>Quyền được gán</legend><div className="perm-checkbox-grid">{permissionOptions.map(code=><label key={code}><input type="checkbox" checked={editPermissions.includes(code)} onChange={event=>setEditPermissions(current=>event.target.checked?[...current,code]:current.filter(value=>value!==code))}/>{permissionNames[code]||code}</label>)}</div></fieldset>
      <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setEditing(null)}>Hủy</button><button className="btn btn-primary">Lưu quyền</button></div>
    </form></div>}
    {accountDraft&&<div className="modal-overlay"><form className="modal-content" onSubmit={createAccount}>
      <h3>Cấp tài khoản · {accountDraft.name}</h3><label>Tên đăng nhập<input required autoComplete="off" value={username} onChange={event=>setUsername(event.target.value)}/></label><label>Email công ty<input required type="email" value={email} onChange={event=>setEmail(event.target.value)}/></label>
      <p>Tài khoản dùng thử vừa cấp áp dụng cho dữ liệu mô phỏng; cần đồng bộ với máy chủ để đăng nhập.</p><div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={()=>setAccountDraft(null)}>Hủy</button><button className="btn btn-primary">Cấp và kích hoạt</button></div>
    </form></div>}
  </>;
}
