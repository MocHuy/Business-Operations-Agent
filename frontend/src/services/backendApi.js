const TOKEN_KEY = 'business-ops-backend-token';
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export const backendToken = {
  get: () => sessionStorage.getItem(TOKEN_KEY),
  set: token => sessionStorage.setItem(TOKEN_KEY, token),
  clear: () => sessionStorage.removeItem(TOKEN_KEY)
};

function errorMessage(payload, status) {
  if (typeof payload?.detail?.message === 'string') return payload.detail.message;
  if (status === 400 || status === 422) return 'Dữ liệu gửi lên không hợp lệ.';
  if (status === 401) return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  if (status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (status === 404) return 'Không tìm thấy dữ liệu yêu cầu.';
  if (status === 405) return 'Máy chủ không hỗ trợ thao tác này.';
  if (status === 408 || status === 504) return 'Máy chủ phản hồi quá lâu. Vui lòng thử lại.';
  if (status === 409) return 'Dữ liệu đã thay đổi. Vui lòng tải lại và thử lại.';
  if (status === 429) return 'Có quá nhiều yêu cầu. Vui lòng thử lại sau.';
  if (status >= 500) return 'Máy chủ đang gặp lỗi. Vui lòng thử lại sau.';
  return `Không thể hoàn tất yêu cầu (mã ${status}).`;
}

export async function apiRequest(path, { method = 'GET', body, authenticated = true, extraHeaders = {} } = {}) {
  const token = backendToken.get();
  if (authenticated && !token) throw new Error('Vui lòng đăng nhập để tiếp tục.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...extraHeaders,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(authenticated ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(errorMessage(payload, response.status));
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Máy chủ phản hồi quá lâu. Vui lòng thử lại.');
    if (error instanceof TypeError) throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra backend.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const backendAuth = {
  async login(username, password) {
    const result = await apiRequest('/api/auth/login', { method: 'POST', body: { username, password }, authenticated: false });
    const token = result?.token;
    if (!token || !result.user) throw new Error('Máy chủ trả về phiên đăng nhập không hợp lệ.');
    backendToken.set(token);
    return result.user;
  },
  me: () => apiRequest('/api/auth/me'),
  async logout() {
    try { if (backendToken.get()) await apiRequest('/api/auth/logout', { method: 'POST' }); }
    finally { backendToken.clear(); }
  }
};

export const rowsOf = (result, key) => Array.isArray(result) ? result : (result?.[key] || result?.items || result?.approvals || []);
export const recordOf = result => result?.request || result;
