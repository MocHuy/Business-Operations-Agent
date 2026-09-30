import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { getStore } from './services/store';
import { backendToken } from './services/backendApi';

const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });
let server;

function installServer({ denyConfirm = false, loseFirstManualResponse = false } = {}) {
  const storePromise = getStore();
  const state = {
    request: {
      id: 'PR-900', product_id: 'MON-27-001', product_name: 'ViewPro 27 IPS Monitor',
      requester_id: 'EMP002', requester_name: 'Trần Minh Bình', department_id: 'DEP002', department_name: 'Marketing',
      quantity: 1, unit_price: 5000000, total_price: 5000000,
      reason: 'Trang bị cho nhân viên mới', status: 'DRAFT'
    },
    confirmed: false,
    decided: false,
    createCount: 0,
    createKeys: []
  };
  const fetchMock = vi.fn(async (url, options = {}) => {
    const path = new URL(String(url), 'http://localhost').pathname;
    const store = await storePromise;
    if (path === '/api/auth/me') return response({ user: store.getCurrentUser() });
    if (path === '/api/auth/logout') return response({});
    if (path === '/api/products') return response([{ product_id: 'MON-27-001', name: 'ViewPro 27 IPS Monitor', unit_price: 5000000 }]);
    if (path === '/api/procurement' && options.method === 'POST') {
      const key = options.headers?.['Idempotency-Key'];
      state.createKeys.push(key);
      if (!state.createCount) {
        state.createCount = 1;
        state.confirmed = true;
        if (loseFirstManualResponse) throw new TypeError('Phản hồi bị mất sau khi máy chủ đã tạo PR');
      }
      return response({ request: state.request });
    }
    if (path === '/api/procurement') return response(state.confirmed ? [state.request] : []);
    if (path === '/api/agent/procurement' && options.method === 'POST') return response({
      kind: 'proposal', message: 'Đã tìm thấy phương án phù hợp.', session_id: 'session-1', trace_id: 'trace-1',
      proposal: { quantity: 1, budget: { available_amount: 20000000 }, reason: state.request.reason,
        products: [{ product_id: 'MON-27-001', name: 'ViewPro 27 IPS Monitor', quantity: 1, unit_price: 5000000, total_price: 5000000 }] }
    });
    if (path === '/api/agent/procurement/session-1/confirm' && options.method === 'POST') {
      if (denyConfirm) return response({ detail: { code: 'FORBIDDEN', message: 'Bạn không có quyền gửi yêu cầu này.' } }, 403);
      state.confirmed = true;
      state.request.status = 'PENDING_APPROVAL';
      return response({ request: state.request });
    }
    if (path === '/api/approvals') return response(store.getCurrentUser()?.system_role === 'MANAGER' && state.confirmed && !state.decided ? [state.request] : []);
    if (path === '/api/procurement/PR-900') return state.confirmed ? response(state.request) : response({ detail: { code: 'NOT_FOUND', message: 'Không tìm thấy yêu cầu.' } }, 404);
    if (path === '/api/procurement/PR-900/decision' && options.method === 'POST') {
      if (store.getCurrentUser()?.system_role !== 'MANAGER') return response({ detail: { code: 'FORBIDDEN', message: 'Bạn không có quyền phê duyệt.' } }, 403);
      state.decided = true;
      state.request.status = JSON.parse(options.body).decision === 'approve' ? 'APPROVED' : 'REJECTED';
      return response(state.request);
    }
    throw new Error(`API mock chưa khai báo: ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { state, fetchMock };
}

async function renderAs(username, path) {
  const store = await getStore();
  store.login(username, '123');
  backendToken.set('test-token');
  window.history.replaceState({}, '', path);
  render(<App/>);
  await screen.findByText('TRỢ LÝ VẬN HÀNH');
}

describe('React Procurement integration', () => {
  beforeEach(async () => { (await getStore()).reset(); backendToken.clear(); window.history.replaceState({}, '', '/'); });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('confirms an Agent proposal through backend and reads back the submitted request', async () => {
    server = installServer();
    window.confirm = vi.fn(() => true);
    await renderAs('nhanvien1', '/agent');
    fireEvent.click(screen.getByRole('button', { name: 'Mua 1 màn hình 27 inch cho nhân viên mới' }));
    expect(await screen.findByText('Màn hình ViewPro 27 IPS')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận và gửi yêu cầu' }));
    expect(await screen.findByText(/Đã gửi yêu cầu PR-900 đến quản lý phê duyệt/)).toBeTruthy();
    expect(server.state.request.status).toBe('PENDING_APPROVAL');
    const paths = server.fetchMock.mock.calls.map(([url]) => new URL(String(url), 'http://localhost').pathname);
    expect(paths).toContain('/api/agent/procurement/session-1/confirm');
    expect(paths).toContain('/api/procurement/PR-900');
    const confirmCall = server.fetchMock.mock.calls.find(([url]) => String(url).includes('/session-1/confirm'));
    expect(JSON.parse(confirmCall[1].body)).toEqual({ product_id: 'MON-27-001', confirmed: true });
    expect(server.state.request.product_name).toBe('ViewPro 27 IPS Monitor');
  });

  it('shows localized product names in catalogue, request list and detail', async () => {
    server = installServer();
    server.state.confirmed = true;
    server.state.request.status = 'PENDING_APPROVAL';
    await renderAs('nhanvien1', '/catalogue');
    expect(await screen.findByText('Màn hình ViewPro 27 IPS')).toBeTruthy();
    cleanup();
    await renderAs('nhanvien1', '/procurement');
    expect(await screen.findByText('Màn hình ViewPro 27 IPS')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Chi tiết' }));
    expect(await screen.findByText('Màn hình ViewPro 27 IPS')).toBeTruthy();
    expect(server.state.request.product_name).toBe('ViewPro 27 IPS Monitor');
  });

  it('reuses the manual create key after a lost response and verifies one saved request', async () => {
    server = installServer({ loseFirstManualResponse: true });
    window.confirm = vi.fn(() => true);
    await renderAs('nhanvien1', '/procurement');
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo yêu cầu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }));
    expect(await screen.findByText('Không kết nối được máy chủ. Vui lòng kiểm tra backend.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tạo bản nháp' }));
    expect(await screen.findByText('Yêu cầu PR-900 đã tạo')).toBeTruthy();
    expect(server.state.createCount).toBe(1);
    expect(server.state.createKeys).toHaveLength(2);
    expect(server.state.createKeys[0]).toMatch(/^[a-f0-9]{32}$/);
    expect(server.state.createKeys[1]).toBe(server.state.createKeys[0]);
    expect(sessionStorage.getItem('procurement-pending-create')).toBeNull();
  });

  it('shows Vietnamese seeded department, meeting and expense details', async () => {
    server = installServer();
    await renderAs('nhanvien2', '/meetings');
    expect(await screen.findByText('Họp kỹ thuật về báo giá và quy trình bán hàng quý 3')).toBeTruthy();
    expect(screen.getByText(/Phát triển phần mềm/)).toBeTruthy();
    cleanup();
    await renderAs('nhanvien2', '/expenses/EXP-001');
    expect(await screen.findByText('Ăn trưa làm việc với chuyên gia đánh giá bảo mật bên ngoài')).toBeTruthy();
    expect(screen.getByText('Ăn uống')).toBeTruthy();
  });

  it('lets a manager approve a backend request and verifies the saved status', async () => {
    server = installServer();
    server.state.confirmed = true;
    server.state.request.status = 'PENDING_APPROVAL';
    window.confirm = vi.fn(() => true);
    await renderAs('thaomkt', '/approvals');
    fireEvent.click((await screen.findByText('PR-900')).closest('tr').querySelector('button'));
    expect(await screen.findByText('Đã phê duyệt PR-900.')).toBeTruthy();
    expect(server.state.request.status).toBe('APPROVED');
    const decisionCall = server.fetchMock.mock.calls.find(([url]) => String(url).endsWith('/PR-900/decision'));
    expect(JSON.parse(decisionCall[1].body)).toEqual({ decision: 'approve', confirmed: true });
    expect(server.fetchMock.mock.calls.some(([url]) => String(url).endsWith('/PR-900'))).toBe(true);
  });

  it('shows the backend denial and does not claim Agent success', async () => {
    server = installServer({ denyConfirm: true });
    window.confirm = vi.fn(() => true);
    await renderAs('nhanvien1', '/agent');
    fireEvent.click(screen.getByRole('button', { name: 'Mua 1 màn hình 27 inch cho nhân viên mới' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận và gửi yêu cầu' }));
    expect(await screen.findByText('Bạn không có quyền gửi yêu cầu này.')).toBeTruthy();
    expect(screen.queryByText(/Đã gửi yêu cầu PR-900/)).toBeNull();
    expect(server.state.confirmed).toBe(false);
  });

  it('does not call the sensitive endpoint when the user cancels confirmation', async () => {
    server = installServer();
    window.confirm = vi.fn(() => false);
    await renderAs('nhanvien1', '/agent');
    fireEvent.click(screen.getByRole('button', { name: 'Mua 1 màn hình 27 inch cho nhân viên mới' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận và gửi yêu cầu' }));
    expect(server.fetchMock.mock.calls.some(([url]) => String(url).includes('/session-1/confirm'))).toBe(false);
    expect(server.state.confirmed).toBe(false);
  });
});
