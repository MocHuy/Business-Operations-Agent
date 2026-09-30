import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import AppLayout from './components/layout/AppLayout';
import { getStore } from './services/store';
import { backendToken } from './services/backendApi';

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
const loginAs = (store, username) => { store.login(username, '123'); backendToken.set('test-token'); };
beforeEach(async()=>{
  const store = await getStore();
  store.reset();
  backendToken.clear();
  window.history.replaceState({},'', '/');
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    const path = new URL(String(url), 'http://localhost').pathname;
    if (path === '/api/auth/login') {
      const { username } = JSON.parse(options.body);
      const user = store.getUsers().find(person => person.username === username);
      return user ? response({ token: 'test-token', user }) : response({ detail: 'Sai tài khoản.' }, 401);
    }
    if (path === '/api/auth/me') return response({ user: store.getCurrentUser() });
    if (path === '/api/auth/logout') return response({});
    if (path === '/api/products') return response(store.getProducts());
    if (path === '/api/procurement') return response(store.getRequests());
    if (path === '/api/approvals') return response([]);
    if (path.startsWith('/api/procurement/')) {
      const id = decodeURIComponent(path.split('/')[3]);
      const row = store.getRequestById(id);
      return row ? response(row) : response({ detail: 'Không tìm thấy yêu cầu.' }, 404);
    }
    throw new Error(`API mock chưa khai báo: ${path}`);
  }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
const renderAt=path=>{window.history.replaceState({},'',path);return render(<App/>)};

describe('React route and role rendering',()=>{
  it('redirects signed out root and allows login page',async()=>{renderAt('/');await waitFor(()=>expect(window.location.pathname).toBe('/login'));expect(await screen.findByText('Đăng nhập không gian vận hành doanh nghiệp')).toBeTruthy();});
  it('authenticates an ACTIVE demo user and renders the protected shell',async()=>{renderAt('/login');fireEvent.change(screen.getByLabelText('Tên đăng nhập'),{target:{value:'nhanvien1'}});fireEvent.change(screen.getByLabelText('Mật khẩu'),{target:{value:'123'}});fireEvent.click(screen.getByRole('button',{name:'Đăng nhập'}));await waitFor(()=>expect(window.location.pathname).toBe('/agent'));expect((await screen.findAllByText('Trợ lý vận hành')).length).toBeGreaterThan(0);});
  it('shows only active seeded demo accounts and lets a row fill the login fields',async()=>{(await getStore()).logout();renderAt('/login');const username=await screen.findByText('nhanvien2 / 123');fireEvent.click(username.closest('button'));expect(screen.getByLabelText('Tên đăng nhập').value).toBe('nhanvien2');expect(screen.getByLabelText('Mật khẩu').value).toBe('123');});
  it('logs out through React routing and sends restricted HR URLs to organization',async()=>{const store=await getStore();loginAs(store,'nhanvien1');renderAt('/agent');fireEvent.click(await screen.findByRole('button',{name:'Đăng xuất'}));await waitFor(()=>expect(window.location.pathname).toBe('/login'));loginAs(store,'hr1');cleanup();renderAt('/procurement');await waitFor(()=>expect(window.location.pathname).toBe('/organization'));});
  it('keeps System Admin inside account and activity screens',async()=>{const store=await getStore();loginAs(store,'sysadmin1');renderAt('/agent');await waitFor(()=>expect(window.location.pathname).toBe('/organization'));expect(screen.getByText('Quản trị tài khoản')).toBeTruthy();expect(await screen.findByText('EMP015')).toBeTruthy();expect(screen.getByText('Cấp tài khoản')).toBeTruthy();});
  it('renders manager delegation and OPS access controls only in their workspaces',async()=>{const store=await getStore();loginAs(store,'quanly1');renderAt('/approvals');expect(await screen.findByText('Ủy quyền công việc')).toBeTruthy();cleanup();loginAs(store,'admin1');renderAt('/organization');expect((await screen.findAllByText('Cấu hình quyền')).length).toBeGreaterThan(0);expect(await screen.findByText('Ủy quyền công việc')).toBeTruthy();});
  it('grants a delegated approver the approval route from effective Store authority',async()=>{const store=await getStore();loginAs(store,'quanly1');const start=new Date().toISOString().slice(0,10);const end=new Date(Date.now()+86400000*5).toISOString().slice(0,10);store.createDelegation({from_user:'MGR001',to_user:'EMP001',permissions:['APPROVE_EXPENSE'],start_date:start,end_date:end});loginAs(store,'nhanvien2');renderAt('/approvals');expect(await screen.findByText('Hộp thư phê duyệt')).toBeTruthy();});
  it('renders every business route inside the authenticated shell for permitted roles',async()=>{const store=await getStore();for(const [account,paths] of [['nhanvien1',['/agent','/my-work','/procurement','/procurement/PR-001','/expenses','/expenses/EXP-001','/assets','/meetings','/forms','/policies','/catalogue']],['quanly1',['/agent','/my-work','/procurement','/expenses','/assets','/meetings','/forms','/policies','/approvals','/catalogue']],['hr1',['/organization','/forms','/policies']],['admin1',['/organization','/approvals','/activity']],['sysadmin1',['/organization','/activity']]]){cleanup();store.reset();loginAs(store,account);for(const path of paths){cleanup();renderAt(path);await waitFor(()=>expect(screen.getByText('TRỢ LÝ VẬN HÀNH')).toBeTruthy());await waitFor(()=>expect(screen.queryByText('Đang tải…')).toBeNull());expect(document.querySelector('.page-content')?.textContent).toBeTruthy();}}});
  it('keeps HR, manager, and system administration navigation role-aware',async()=>{const store=await getStore();loginAs(store,'hr1');const {unmount}=render(<MemoryRouter><AuthProvider><AppLayout/></AuthProvider></MemoryRouter>);await waitFor(()=>expect(screen.getByText('Tổ chức & phân quyền')).toBeTruthy());expect(screen.queryByText('Mua sắm')).toBeNull();expect(screen.queryByText('Phê duyệt')).toBeNull();unmount();loginAs(store,'quanly1');render(<MemoryRouter><AuthProvider><AppLayout/></AuthProvider></MemoryRouter>);await waitFor(()=>expect(screen.getByText('Phê duyệt')).toBeTruthy());expect(screen.queryByText('Tổ chức & phân quyền')).toBeNull();expect(screen.queryByText('Nhật ký hoạt động')).toBeNull();});
});
