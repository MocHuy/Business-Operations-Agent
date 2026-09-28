import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStore } from '../../services/store';

const links = {
  EMPLOYEE: [['/agent','Trợ lý vận hành'],['/my-work','Công việc của tôi'],['/procurement','Mua sắm'],['/expenses','Chi phí'],['/assets','Tài sản'],['/meetings','Cuộc họp'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định'],['/catalogue','Danh mục']],
  MANAGER: [['/agent','Trợ lý vận hành'],['/my-work','Công việc của tôi'],['/procurement','Mua sắm'],['/expenses','Chi phí'],['/assets','Tài sản'],['/meetings','Cuộc họp'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định'],['/approvals','Phê duyệt'],['/catalogue','Danh mục']],
  HR: [['/organization','Tổ chức & phân quyền'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định']],
  OPS_ADMIN: [['/agent','Trợ lý vận hành'],['/my-work','Công việc'],['/procurement','Mua sắm'],['/expenses','Chi phí'],['/assets','Tài sản'],['/meetings','Cuộc họp'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định'],['/approvals','Phê duyệt'],['/organization','Tổ chức & phân quyền'],['/catalogue','Danh mục'],['/activity','Nhật ký hoạt động']],
  SYSTEM_ADMIN: [['/organization','Tài khoản & tổ chức'],['/activity','Nhật ký hoạt động']]
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [delegatedApprover, setDelegatedApprover] = useState(false);
  const role = user?.system_role || user?.role;
  useEffect(() => {
    let live = true;
    if (user) getStore().then(store => {
      const allowed = ['APPROVE_PROCUREMENT','APPROVE_EXPENSE'].some(code => store.resolveAuthorities(user.user_id, code).length > 0);
      if (live) setDelegatedApprover(allowed);
    });
    return () => { live = false; };
  }, [user?.user_id, user?.permissions]);
  const visible = [...(links[role] || [])];
  if (delegatedApprover && !visible.some(([path]) => path === '/approvals')) visible.push(['/approvals','Phê duyệt']);
  return <div className="app-container">
    <aside className="app-sidebar">
      <div className="brand"><strong>BUSINESS OPS</strong><small>Operations Workspace</small></div>
      <nav>{visible.map(([to,label])=><NavLink key={to} to={to}>{label}</NavLink>)}</nav>
      <div className="sidebar-bottom">
        {['OPS_ADMIN','SYSTEM_ADMIN'].includes(role)&&<button className="btn btn-secondary logout" onClick={()=>confirm('Khôi phục toàn bộ dữ liệu demo?')&&getStore().then(store=>store.reset())}>Khôi phục dữ liệu mẫu</button>}
        <button className="btn btn-secondary logout" onClick={async()=>{await logout();navigate('/login',{replace:true})}}>Đăng xuất</button>
      </div>
    </aside>
    <main className="app-main">
      <header className="app-topbar"><div><h1 className="topbar-title">Business Operations</h1><div className="topbar-subtitle">{user?.name} · {role} · {user?.department_name}</div></div><span>Chế độ Demo</span></header>
      <section className="page-content"><Outlet/></section>
    </main>
  </div>;
}
