import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getStore } from '../../services/store';
import { departmentNameLabel } from '../../services/uiText';

const navIcons = {
  '/agent': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v1H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3V5a3 3 0 0 0-3-3z"/>
      <path d="M9 12h.01M15 12h.01M10 16c.5.5 1.5.5 2 0"/>
    </svg>
  ),
  '/my-work': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
      <path d="m9 14 2 2 4-4"/>
    </svg>
  ),
  '/procurement': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="21" r="1"/>
      <circle cx="19" cy="21" r="1"/>
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>
    </svg>
  ),
  '/expenses': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="5" rx="2"/>
      <line x1="2" x2="22" y1="10" y2="10"/>
    </svg>
  ),
  '/assets': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2"/>
      <line x1="8" x2="16" y1="21" y2="21"/>
      <line x1="12" x2="12" y1="17" y2="21"/>
    </svg>
  ),
  '/meetings': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  ),
  '/forms': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" x2="8" y1="13" y2="13"/>
      <line x1="16" x2="8" y1="17" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  '/policies': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <path d="m9 12 2 2 4-4"/>
    </svg>
  ),
  '/approvals': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
      <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  ),
  '/organization': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  '/catalogue': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2"/>
      <polyline points="2 17 12 22 22 17"/>
      <polyline points="2 12 12 17 22 12"/>
    </svg>
  ),
  '/activity': (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )
};

const links = {
  EMPLOYEE: [['/agent','Trợ lý vận hành'],['/my-work','Công việc của tôi'],['/procurement','Mua sắm'],['/expenses','Chi phí'],['/assets','Tài sản'],['/meetings','Cuộc họp'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định'],['/catalogue','Danh mục']],
  MANAGER: [['/agent','Trợ lý vận hành'],['/my-work','Công việc của tôi'],['/procurement','Mua sắm'],['/expenses','Chi phí'],['/assets','Tài sản'],['/meetings','Cuộc họp'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định'],['/approvals','Phê duyệt'],['/catalogue','Danh mục']],
  HR: [['/organization','Tổ chức & phân quyền'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định']],
  OPS_ADMIN: [['/agent','Trợ lý vận hành'],['/my-work','Công việc'],['/expenses','Chi phí'],['/assets','Tài sản'],['/meetings','Cuộc họp'],['/forms','Biểu mẫu & văn bản'],['/policies','Quy định'],['/approvals','Phê duyệt'],['/organization','Tổ chức & phân quyền'],['/activity','Nhật ký hoạt động']],
  SYSTEM_ADMIN: [['/organization','Tài khoản & tổ chức'],['/activity','Nhật ký hoạt động']]
};

const roleLabelMap = {
  EMPLOYEE: 'Nhân viên',
  MANAGER: 'Quản lý',
  HR: 'Nhân sự',
  OPS_ADMIN: 'Quản trị vận hành',
  SYSTEM_ADMIN: 'Quản trị hệ thống'
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
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
  const currentPage = [...visible].reverse().find(([path]) => location.pathname === path || location.pathname.startsWith(`${path}/`))?.[1] || 'Không gian làm việc';
  const navGroups = [
    { title: 'Không gian làm việc', paths: ['/agent', '/my-work', '/approvals'] },
    { title: 'Nghiệp vụ', paths: ['/procurement', '/expenses', '/assets', '/meetings'] },
    { title: 'Tài nguyên', paths: ['/forms', '/policies', '/catalogue'] },
    { title: 'Quản trị', paths: ['/organization', '/activity'] }
  ].map(group => ({ ...group, items: visible.filter(([path]) => group.paths.includes(path)) })).filter(group => group.items.length);
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = event => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);
  return <div className="app-container">
    {menuOpen && <button className="sidebar-backdrop" aria-label="Đóng menu điều hướng" onClick={() => setMenuOpen(false)}/>}
    <aside className={`app-sidebar${menuOpen ? ' is-open' : ''}`}>
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <div className="brand-copy"><strong>TRỢ LÝ VẬN HÀNH</strong><small>Business workspace</small></div>
        <button className="sidebar-close" aria-label="Đóng menu" onClick={() => setMenuOpen(false)}>×</button>
      </div>
      <nav aria-label="Điều hướng chính">
        {navGroups.map(group => <div className="nav-group" key={group.title}>
          <div className="nav-group-label">{group.title}</div>
          {group.items.map(([to, label]) => (
            <NavLink key={to} to={to} className="nav-item" onClick={() => setMenuOpen(false)}>
              <span className="nav-icon" aria-hidden="true">{navIcons[to] || null}</span>
              <span className="nav-label">{label}</span>
            </NavLink>
          ))}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-user-card">
          <div className="user-avatar-badge" aria-hidden="true">{user?.name ? user.name[0] : 'U'}</div>
          <div className="user-meta">
            <span className="user-meta-name">{user?.name}</span>
            <span className="user-meta-role">{roleLabelMap[role] || role}</span>
          </div>
        </div>
        {['OPS_ADMIN','SYSTEM_ADMIN'].includes(role) && (
          <button className="btn btn-secondary logout" onClick={async () => {
            if (!confirm('Khôi phục dữ liệu mô phỏng và đăng xuất? Các yêu cầu mua sắm trên máy chủ vẫn được giữ nguyên.')) return;
            await logout();
            const store = await getStore();
            store.reset();
            navigate('/login', { replace: true });
          }}>
            Khôi phục dữ liệu mẫu
          </button>
        )}
        <button className="btn btn-secondary logout" onClick={async () => {
          await logout();
          navigate('/login', { replace: true });
        }}>
          Đăng xuất
        </button>
      </div>
    </aside>
    <main className="app-main">
      <header className="app-topbar">
        <button className="mobile-menu-button" aria-label="Mở menu điều hướng" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
        </button>
        <div className="topbar-left">
          <span className="topbar-eyebrow">KHÔNG GIAN VẬN HÀNH <span aria-hidden="true">/</span> {currentPage}</span>
          <h1 className="topbar-title">{departmentNameLabel(user?.department_name) || 'Doanh nghiệp'}</h1>
          <div className="topbar-subtitle">
            {user?.name} · {roleLabelMap[role] || role}
          </div>
        </div>
        <div className="topbar-right">
          <span className="live-pill">Chế độ dùng thử</span>
        </div>
      </header>
      <section className="page-content"><Outlet/></section>
    </main>
  </div>;
}
