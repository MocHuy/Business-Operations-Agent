import { getStore } from './store';
import { apiRequest, backendAuth, recordOf, rowsOf } from './backendApi';
import { localizePolicy } from './policyUi';
import { departmentNameLabel, jobTitleLabel, systemNameLabel } from './uiText';
export const authService = backendAuth;
export const agentService = {
  sendMessage: async (prompt, sessionId = null) => {
    const store = await getStore();
    const user = store.requireAuthenticatedUser();
    const text = String(prompt || '').trim();
    const lower = text.toLowerCase();
    if (!text) throw new Error('Hãy nhập yêu cầu.');
    const match = text.match(/(?:PR|EXP)-\d+/i);
    if (sessionId) return { skill: 'Mua sắm', ...await apiRequest('/api/agent/procurement', { method: 'POST', body: { message: text, session_id: sessionId } }) };
    if (/ceo|giám đốc|bỏ qua|bypass|ignore/.test(lower)) return { skill: 'Mua sắm', ...await apiRequest('/api/agent/procurement', { method: 'POST', body: { message: text } }) };
    if (/quy định|chính sách|policy|hóa đơn|receipt/.test(lower)) return apiRequest('/api/agent/policy', { method: 'POST', body: { message: text } });
    if (/mua|purchase/.test(lower)) return { skill: 'Mua sắm', ...await apiRequest('/api/agent/procurement', { method: 'POST', body: { message: text } }) };
    if (/thêm nhân viên|onboarding|tạo nhân sự/.test(lower)) {
      const permitted = ['HR', 'OPS_ADMIN'].includes(user.system_role);
      return { skill: 'HR & Onboarding', kind: permitted ? 'navigation' : 'text', message: permitted ? 'Quy trình tiếp nhận cần hồ sơ do bộ phận nhân sự tạo và tài khoản do quản trị hệ thống quản lý.' : 'Gửi yêu cầu đến phòng nhân sự; tạo hồ sơ nhân viên cần vai trò được ủy quyền.', href: permitted ? '/organization' : null };
    }
    if (/nghỉ|leave/.test(lower)) return { skill: 'Forms & Documents', kind: 'navigation', message: 'Chọn biểu mẫu nghỉ phép, nhập ngày và lý do, xem trước rồi xác nhận sinh văn bản.', href: '/forms', templateId: 'FORM-HR-001' };
    if (/duyệt|approve|phê duyệt/.test(lower)) {
      let record;
      if (match?.[0].toUpperCase().startsWith('EXP')) record = store.getExpenseById(match[0].toUpperCase());
      else if (match) record = await procurementService.get(match[0].toUpperCase()).catch(() => null);
      else record = [...await approvalService.all(), ...store.getExpenses()].find(row => row.status === 'PENDING_APPROVAL');
      if (!record) return { skill: 'Governance & Approval', kind: 'text', message: 'Không tìm thấy hồ sơ phù hợp để thẩm định.' };
      const isExpense = record.amount !== undefined;
      const check = isExpense ? store.canApproveExpenseClaim(user.user_id, record) : { allowed: (await approvalService.all()).some(row => row.id === record.id), message: 'Bạn không có quyền phê duyệt hồ sơ này.' };
      return { skill: 'Quản trị và phê duyệt', kind: 'approval', record, isExpense, allowed: check.allowed && record.status === 'PENDING_APPROVAL', message: record.status !== 'PENDING_APPROVAL' ? 'Chỉ hồ sơ đang chờ phê duyệt mới được xử lý.' : check.allowed ? 'Hồ sơ nằm trong quyền phê duyệt hiện tại. Hãy xác nhận quyết định.' : check.message };
    }
    if (/họp|meeting|doanh thu|stakeholder|nâng cấp/.test(lower)) {
      const systems = store.getBusinessSystems();
      const system = systems.find(item => {
        const text = `${item.name} ${item.code} ${item.description}`.toLowerCase();
        const tokens = text.split(/[^\p{L}\p{N}]+/u).filter(token => token.length > 3);
        const aliases = item.code === 'SMS' ? /bán hàng|sales management|sales system/i : item.code === 'MAP' ? /marketing analytics|phân tích marketing/i : item.code === 'CRM' ? /crm|khách hàng/i : /$a/;
        return tokens.some(token => lower.includes(token)) || aliases.test(lower);
      });
      let suggestions = [];
      if (system) {
        suggestions = [
          [system.business_owner_id, 'Chủ sở hữu nghiệp vụ'],
          [system.technical_owner_id, 'Chủ sở hữu kỹ thuật'],
          [system.engineering_lead_id, 'Phụ trách quản trị thay đổi hệ thống'],
          [system.data_lead_id, 'Phụ trách dữ liệu liên quan']
        ];
      } else if (/doanh thu|revenue/i.test(lower)) {
        suggestions = store.getUsers().filter(person => /sales|marketing|data|analytics/i.test(person.department_name || '')).map(person => [person.user_id, `Đại diện ${departmentNameLabel(person.department_name)}`]);
      } else {
        suggestions = store.getUsers().filter(person => person.account_status === 'ACTIVE' && /sales|it|bi|marketing/i.test(`${person.department_name} ${person.job_title}`)).slice(0, 5).map(person => [person.user_id, jobTitleLabel(person.job_title) || departmentNameLabel(person.department_name)]);
      }
      const attendees = suggestions.map(([id, reason]) => { const person = store.getUserById(id); return person?.account_status === 'ACTIVE' ? { user_id: person.user_id, name: person.name, department_name: person.department_name, reason } : null; }).filter(Boolean);
      return { skill: 'Meeting Coordination', kind: 'meeting', system, attendees, message: system ? `Đã tìm chủ sở hữu nghiệp vụ và kỹ thuật cho ${systemNameLabel(system.name)} từ sổ đăng ký hệ thống. Kiểm tra danh sách và thời gian trước khi tạo lịch.` : 'Gợi ý người tham dự từ các phòng ban liên quan đã được ghi trong hồ sơ tổ chức. Kiểm tra danh sách và thời gian trước khi tạo lịch.' };
    }
    if (/taxi|chi phí|expense|hoàn chi/.test(lower)) return { skill: 'Expense', kind: 'expense', amount: (text.match(/[\d,.]+/) || [])[0]?.replace(/[,.]/g, '') || '', prompt: text, message: 'Nhập thông tin chứng từ và xác nhận trước khi tạo hồ sơ chi phí.' };
    if (/chưa cấp phát|tài sản|còn.*(?:màn hình|monitor|laptop)|trong kho|cấp phát/.test(lower) && !/cần (?:mua|sắm)|đề xuất/.test(lower)) return { skill: 'Asset Management', kind: 'assets', canAssign: user.system_role === 'OPS_ADMIN' || store.hasPermission(user.user_id, 'ASSIGN_ASSET'), assets: store.getVisibleAssetsForUser(user).filter(asset => asset.status === 'AVAILABLE' && (!/marketing/i.test(lower) || asset.department_id === 'DEP002')), message: 'Chỉ hiển thị tài sản sẵn có trong phạm vi quyền của bạn.' };
    return { skill: 'Mua sắm', ...await apiRequest('/api/agent/procurement', { method: 'POST', body: { message: text } }) };
  },
  confirmProcurement: (sessionId, productId) => apiRequest(`/api/agent/procurement/${encodeURIComponent(sessionId)}/confirm`, { method: 'POST', body: { product_id: productId, confirmed: true } })
};
export const procurementService = {
  products: async () => rowsOf(await apiRequest('/api/products'), 'products'),
  all: async () => rowsOf(await apiRequest('/api/procurement'), 'requests'),
  get: async id => recordOf(await apiRequest(`/api/procurement/${encodeURIComponent(id)}`)),
  create: async input => recordOf(await apiRequest('/api/procurement', { method: 'POST', extraHeaders: { 'Idempotency-Key': input.idempotencyKey }, body: { product_id: input.productId, quantity: Number(input.quantity), reason: input.reason || '', confirmed: true } })),
  submit: async id => recordOf(await apiRequest(`/api/procurement/${encodeURIComponent(id)}/submit`, { method: 'POST', body: { confirmed: true } })),
  approve: async id => recordOf(await apiRequest(`/api/procurement/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { decision: 'approve', confirmed: true } })),
  reject: async (id, reason) => recordOf(await apiRequest(`/api/procurement/${encodeURIComponent(id)}/decision`, { method: 'POST', body: { decision: 'reject', confirmed: true, reason } }))
};
export const expenseService = { all: async () => {const s=await getStore(),u=s.getCurrentUser();return s.getExpenses().filter(r=>s.canViewExpenseClaim(u,r));}, get: async id => {const s=await getStore(),r=s.getExpenseById(id);if(!r||!s.canViewExpenseClaim(s.getCurrentUser(),r))throw new Error('Không tìm thấy hồ sơ hoặc bạn không có quyền xem.');return r;}, create: async input => (await getStore()).createExpenseClaim(input), submit: async id => (await getStore()).submitExpenseClaim(id), approve: async id => (await getStore()).approveExpenseClaim(id), reject: async (id, reason) => (await getStore()).rejectExpenseClaim(id, reason) };
export const approvalService = {
  all: async () => {
    const store = await getStore();
    const user = store.requireAuthenticatedUser();
    return [
      ...(user.system_role === 'MANAGER' ? rowsOf(await apiRequest('/api/approvals'), 'requests') : []),
      ...store.getExpenses().filter(row => row.status === 'PENDING_APPROVAL' && store.canApproveExpenseClaim(user.user_id, row).allowed)
    ];
  },
  decide: async (row, decision) => {
    if (!['approve', 'reject'].includes(decision)) throw new Error('Quyết định phê duyệt không hợp lệ.');
    const store = await getStore();
    if (row.amount !== undefined) return decision === 'approve' ? store.approveExpenseClaim(row.id) : store.rejectExpenseClaim(row.id, 'Từ chối qua React');
    return decision === 'approve' ? procurementService.approve(row.id) : procurementService.reject(row.id, 'Từ chối qua giao diện');
  }
};
export const assetService = { all: async () => {const s=await getStore();return s.getVisibleAssetsForUser(s.getCurrentUser());}, canAssign: async () => {const s=await getStore(),u=s.requireAuthenticatedUser();return u.system_role==='OPS_ADMIN'||s.hasPermission(u.user_id,'ASSIGN_ASSET');}, assign: async (id, userId) => (await getStore()).assignAsset(id, userId), return: async id => (await getStore()).returnAsset(id), returnForUser: async (id,userId) => {const s=await getStore(),asset=s.getAssetById(id);if(asset?.assigned_to===userId)return asset;s.requirePermission('ASSIGN_ASSET');return s.returnAsset(id);} };
export const meetingService = { all: async () => {const s=await getStore(),u=s.getCurrentUser();return s.getMeetings().filter(m=>s.canViewMeeting(u,m));}, create: async input => {const s=await getStore(),u=s.requireAuthenticatedUser();const date=input.date_time||input.dateTime||input.timeSlot;if(date){const parsed=new Date(date);if(!Number.isFinite(parsed.getTime()))throw new Error('Ngày và giờ cuộc họp không hợp lệ.');}const ids=(input.attendees||[]).map(att=>typeof att==='string'?att:att.user_id||att.id).filter(Boolean);const active=new Map(s.getUsers().filter(person=>person.account_status==='ACTIVE').map(person=>[person.user_id,person]));for(const id of ids){if(!active.has(id))throw new Error('Danh sách người tham dự có tài khoản không tồn tại hoặc chưa hoạt động.');}return s.createMeeting({...input,attendees:ids.map(id=>({user_id:id,name:active.get(id).name}))});} };
export const documentService = { all: async () => (await getStore()).getVisibleDocumentsForCurrentUser(), get: async id => {const s=await getStore(),doc=s.getDocumentById(id);if(!doc||!s.canViewDocument(s.getCurrentUser(),doc))throw new Error('Không tìm thấy văn bản hoặc bạn không có quyền xem.');return doc;}, generate: async input => (await getStore()).generateDocument(input), draft: async input => (await getStore()).createEmailDraft(input), send: async id => (await getStore()).sendEmailDraft(id) };
export const policyService = { all: async () => (await getStore()).getPolicies().map(localizePolicy) };
export const accessService = { users: async () => {const s=await getStore(),u=s.getCurrentUser(),role=u?.system_role; if(role==='HR')return s.getUsers().map(({user_id,name,department_id,department_name,job_title,manager_id,employee_code})=>({user_id,name,department_id,department_name,job_title,manager_id,employee_code})); if(role==='OPS_ADMIN')return s.getUsers().map(({user_id,name,department_id,department_name,system_role,account_status,permissions,scope})=>({user_id,name,department_id,department_name,system_role,account_status,permissions,scope})); if(role==='SYSTEM_ADMIN')return s.getUsers().map(({user_id,name,department_id,department_name,system_role,account_status,username})=>({user_id,name,department_id,department_name,system_role,account_status,username})); if(role==='MANAGER'){const scope=u.scope?.department_ids||[u.department_id];return s.getUsers().filter(v=>v.account_status==='ACTIVE'&&scope.includes(v.department_id)).map(({user_id,name,department_id,department_name,system_role,account_status})=>({user_id,name,department_id,department_name,system_role,account_status}));}return [];}, delegations: async () => {const s=await getStore(),u=s.getCurrentUser();if(u?.system_role==='OPS_ADMIN')return s.getDelegations();return s.getDelegations().filter(d=>d.from_user===u?.user_id||d.to_user===u?.user_id);}, createDelegation: async input=>(await getStore()).createDelegation(input), revokeDelegation: async id=>(await getStore()).revokeDelegation(id), createEmployeeProfile: async input=>(await getStore()).createEmployeeProfile(input), createUserAccount: async (id,input)=>(await getStore()).createUserAccount(id,input), updateEmployeeOrganization: async (id,input)=>(await getStore()).updateEmployeeOrganization(id,input), setAccountStatus: async (id,status)=>(await getStore()).setAccountStatus(id,status), updateUserAccess: async (id,input)=>(await getStore()).updateUserAccess(id,input) };
