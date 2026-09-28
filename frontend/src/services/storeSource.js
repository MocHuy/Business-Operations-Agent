/**
 * BUSINESS OPS — State Management & LocalStorage Store
 * Unified enterprise storage supporting Procurement, Expenses, Assets, Meetings, Policies, and Delegation
 */

const ProcuraStore = (function () {
  const STORAGE_KEYS = {
    CURRENT_USER_ID: "bizops_current_user_id",
    SESSION: "businessOpsSession",
    USERS: "bizops_users",
    DEPARTMENTS: "bizops_departments",
    BUDGETS: "bizops_budgets",
    PRODUCTS: "bizops_products",
    REQUESTS: "bizops_requests",
    ASSETS: "bizops_assets",
    SYSTEMS: "bizops_systems",
    EXPENSES: "bizops_expenses",
    MEETINGS: "bizops_meetings",
    RUNS: "bizops_agent_runs",
    POLICIES: "bizops_policies",
    FORM_TEMPLATES: "bizops_form_templates",
    GENERATED_DOCUMENTS: "bizops_generated_documents",
    DELEGATIONS: "bizops_delegations",
    PERMISSIONS_CATALOGUE: "bizops_permissions_catalogue"
  };

  const NON_DELEGABLE_PERMISSIONS = ["MANAGE_ACCESS", "MANAGE_ACCOUNTS", "MANAGE_EMPLOYEE_PROFILE"];

  function formatVND(amount) {
    if (typeof amount !== "number") {
      amount = Number(amount) || 0;
    }
    return new Intl.NumberFormat("vi-VN").format(amount) + " VND";
  }

  function getFromStorage(key, fallback) {
    try {
      if (typeof localStorage === "undefined") return fallback;
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : fallback;
    } catch (e) {
      console.error(`Error reading ${key} from localStorage:`, e);
      return fallback;
    }
  }

  function saveToStorage(key, value) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(key, JSON.stringify(value));
      if (typeof window !== "undefined" && window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent("procura-state-changed", { detail: { key } }));
      }
    } catch (e) {
      console.error(`Error saving ${key} to localStorage:`, e);
    }
  }

  function init() {
    if (typeof localStorage === "undefined") return;
    if (!localStorage.getItem(STORAGE_KEYS.REQUESTS) || !localStorage.getItem(STORAGE_KEYS.USERS)) {
      reset();
    } else {
      if (!localStorage.getItem(STORAGE_KEYS.FORM_TEMPLATES) && typeof FORM_TEMPLATES !== "undefined") {
        saveToStorage(STORAGE_KEYS.FORM_TEMPLATES, FORM_TEMPLATES);
      }
      if (!localStorage.getItem(STORAGE_KEYS.GENERATED_DOCUMENTS) && typeof INITIAL_GENERATED_DOCUMENTS !== "undefined") {
        saveToStorage(STORAGE_KEYS.GENERATED_DOCUMENTS, INITIAL_GENERATED_DOCUMENTS);
      }
      if (!localStorage.getItem(STORAGE_KEYS.DELEGATIONS) && typeof INITIAL_DELEGATIONS !== "undefined") {
        saveToStorage(STORAGE_KEYS.DELEGATIONS, INITIAL_DELEGATIONS);
      }
      if (!localStorage.getItem(STORAGE_KEYS.PERMISSIONS_CATALOGUE) && typeof SYSTEM_PERMISSIONS_CATALOGUE !== "undefined") {
        saveToStorage(STORAGE_KEYS.PERMISSIONS_CATALOGUE, SYSTEM_PERMISSIONS_CATALOGUE);
      }
    }
  }

  function reset() {
    if (typeof localStorage === "undefined") return;
    const currentSession = getDemoSession();
    let preserveUserId = null;
    const initialUsers = typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {};
    if (currentSession && currentSession.userId && initialUsers[currentSession.userId] && initialUsers[currentSession.userId].account_status === "ACTIVE") {
      preserveUserId = currentSession.userId;
    }

    saveToStorage(STORAGE_KEYS.USERS, initialUsers);
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, typeof INITIAL_DEPARTMENTS !== "undefined" ? INITIAL_DEPARTMENTS : {});
    saveToStorage(STORAGE_KEYS.BUDGETS, typeof INITIAL_BUDGETS !== "undefined" ? INITIAL_BUDGETS : {});
    saveToStorage(STORAGE_KEYS.PRODUCTS, typeof INITIAL_PRODUCTS !== "undefined" ? INITIAL_PRODUCTS : []);
    saveToStorage(STORAGE_KEYS.REQUESTS, typeof INITIAL_REQUESTS !== "undefined" ? INITIAL_REQUESTS : []);
    saveToStorage(STORAGE_KEYS.ASSETS, typeof INITIAL_ASSETS !== "undefined" ? INITIAL_ASSETS : []);
    saveToStorage(STORAGE_KEYS.SYSTEMS, typeof INITIAL_SYSTEMS !== "undefined" ? INITIAL_SYSTEMS : []);
    saveToStorage(STORAGE_KEYS.EXPENSES, typeof INITIAL_EXPENSES !== "undefined" ? INITIAL_EXPENSES : []);
    saveToStorage(STORAGE_KEYS.MEETINGS, typeof INITIAL_MEETINGS !== "undefined" ? INITIAL_MEETINGS : []);
    saveToStorage(STORAGE_KEYS.RUNS, typeof INITIAL_AGENT_RUNS !== "undefined" ? INITIAL_AGENT_RUNS : []);
    saveToStorage(STORAGE_KEYS.POLICIES, typeof INITIAL_POLICIES !== "undefined" ? INITIAL_POLICIES : []);
    saveToStorage(STORAGE_KEYS.DELEGATIONS, typeof INITIAL_DELEGATIONS !== "undefined" ? INITIAL_DELEGATIONS : []);
    saveToStorage(STORAGE_KEYS.PERMISSIONS_CATALOGUE, typeof SYSTEM_PERMISSIONS_CATALOGUE !== "undefined" ? SYSTEM_PERMISSIONS_CATALOGUE : []);
    saveToStorage(STORAGE_KEYS.FORM_TEMPLATES, typeof FORM_TEMPLATES !== "undefined" ? FORM_TEMPLATES : []);
    saveToStorage(STORAGE_KEYS.GENERATED_DOCUMENTS, typeof INITIAL_GENERATED_DOCUMENTS !== "undefined" ? INITIAL_GENERATED_DOCUMENTS : []);

    if (preserveUserId && initialUsers[preserveUserId]) {
      _setSessionUserInternal(initialUsers[preserveUserId]);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
      } catch (e) {}
    }

    console.log("Business Ops store reset to factory demo seeds.");
    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("procura-store-reset"));
    }
  }

  function getRoleLabel(role) {
    switch (String(role || "").toUpperCase()) {
      case "EMPLOYEE":
        return "Nhân viên";
      case "MANAGER":
        return "Quản lý";
      case "HR":
        return "Nhân sự";
      case "OPS_ADMIN":
        return "Quản trị vận hành";
      case "SYSTEM_ADMIN":
        return "Quản trị hệ thống";
      default:
        return role || "Người dùng";
    }
  }

  // --- Session & Demo Authentication ---
  function getDemoSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  function isAuthenticated() {
    const session = getDemoSession();
    if (!session || !session.userId) return false;
    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    const user = users[session.userId];
    if (!user || user.account_status !== "ACTIVE") return false;
    return true;
  }

  function _setSessionUserInternal(targetUser) {
    const effectiveRole = targetUser.system_role || targetUser.role || "EMPLOYEE";
    const sessionData = {
      username: targetUser.username || targetUser.user_id,
      userId: targetUser.user_id,
      role: effectiveRole,
      systemRole: effectiveRole,
      roleLabel: getRoleLabel(effectiveRole),
      jobTitle: targetUser.job_title || "",
      name: targetUser.name,
      department: targetUser.department_name || "",
      departmentId: targetUser.department_id,
      loginTime: new Date().toISOString()
    };

    try {
      localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(sessionData));
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, JSON.stringify(targetUser.user_id));
    } catch (e) {
      console.error("Error setting session in localStorage:", e);
    }

    if (typeof window !== "undefined" && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("procura-role-switched", { detail: { user: targetUser } }));
    }
    return sessionData;
  }

  function login(username, password) {
    const usersMap = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    const usersList = Object.values(usersMap);
    const accounts = typeof DEMO_ACCOUNTS !== "undefined" ? DEMO_ACCOUNTS : [];

    const cleanUser = String(username || "").trim().toLowerCase();
    const cleanPass = String(password || "").trim();

    let matchedUser = usersList.find(u => u.username && u.username.trim().toLowerCase() === cleanUser);
    let matchedAccount = accounts.find(a => a.username.trim().toLowerCase() === cleanUser);

    if (!matchedUser && matchedAccount) {
      matchedUser = usersMap[matchedAccount.user_id];
    }

    if (!matchedUser && !matchedAccount) {
      return { success: false, error: "Tên đăng nhập không tồn tại trong hệ thống demo." };
    }

    const expectedPass = (matchedAccount && matchedAccount.password) ? matchedAccount.password : "123";
    if (cleanPass !== expectedPass && cleanPass !== "123") {
      return { success: false, error: "Mật khẩu không chính xác. Mật khẩu demo là 123." };
    }

    const userObj = matchedUser || {
      user_id: matchedAccount.user_id,
      name: matchedAccount.name,
      department_name: matchedAccount.department,
      department_id: matchedAccount.department_id || "DEP001",
      system_role: matchedAccount.role,
      job_title: matchedAccount.job_title || matchedAccount.role_label,
      account_status: "ACTIVE"
    };

    if (userObj.account_status === "DISABLED") {
      return {
        success: false,
        error: "Tài khoản của bạn đã bị vô hiệu hóa bởi Quản trị viên hệ thống (SysAdmin). Vui lòng liên hệ IT để được hỗ trợ."
      };
    }
    if (userObj.account_status === "PENDING") {
      return {
        success: false,
        error: "Tài khoản đang ở trạng thái chờ cấp phát và kích hoạt (PENDING). Vui lòng đợi Quản trị hệ thống phê duyệt."
      };
    }

    const sessionData = _setSessionUserInternal(userObj);
    return { success: true, session: sessionData };
  }

  function logout() {
    try {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
    } catch (e) {
      console.error("Error clearing session:", e);
    }
  }

  function checkAuthOrRedirect() {
    if (typeof window === "undefined" || !window.location) return true;
    const path = window.location.pathname || "";
    const isLoginPage = path.endsWith("login.html") || path.endsWith("/login") || path.endsWith("/login.html");
    const authenticated = isAuthenticated();

    if (!authenticated) {
      const session = getDemoSession();
      if (session) {
        try {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
          localStorage.removeItem(STORAGE_KEYS.CURRENT_USER_ID);
        } catch (e) {}
      }
      if (!isLoginPage) {
        window.location.href = "login.html";
        return false;
      }
    } else {
      if (isLoginPage) {
        window.location.href = "index.html";
        return false;
      }
    }
    return true;
  }

  // --- Users & Roles ---
  function getCurrentUser() {
    const session = getDemoSession();
    if (!session || !session.userId) return null;

    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    const rawUser = users[session.userId];
    if (!rawUser) return null;
    if (rawUser.account_status !== "ACTIVE") return null;

    const user = { ...rawUser };
    user.id = user.user_id;
    user.role = user.system_role || user.role || "EMPLOYEE";
    user.system_role = user.role;
    user.permissions = Array.isArray(user.permissions) ? [...user.permissions] : [];
    user.scope = user.scope || {
      department_ids: [user.department_id].filter(Boolean),
      approval_limit: 0
    };
    return user;
  }

  function switchDemoUser(userId) {
    const currentUser = requireAuthenticatedUser();
    const currentRole = (currentUser.system_role || currentUser.role || "").toUpperCase();
    if (currentRole !== "OPS_ADMIN" && currentRole !== "SYSTEM_ADMIN") {
      throw new Error("Chỉ Quản trị viên (OPS_ADMIN hoặc SYSTEM_ADMIN) mới có quyền chuyển đổi tài khoản demo.");
    }

    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    let target = users[userId];
    if (!target) {
      const list = Object.values(users);
      target = list.find(u => u.user_id === userId || u.employee_code === userId || u.username === userId);
    }

    if (!target) {
      throw new Error(`Không tìm thấy tài khoản người dùng: ${userId}`);
    }

    if (target.account_status !== "ACTIVE") {
      throw new Error(`Không thể chuyển sang tài khoản có trạng thái [${target.account_status}]. Chỉ hỗ trợ chuyển sang tài khoản ACTIVE.`);
    }

    _setSessionUserInternal(target);
    return target;
  }

  function setCurrentUser(userId) {
    return switchDemoUser(userId);
  }

  // --- Reusable Store Authorization Guards ---
  function requireAuthenticatedUser() {
    const user = getCurrentUser();
    if (!user || !user.user_id) {
      throw new Error("Phiên làm việc không hợp lệ hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại.");
    }
    return user;
  }

  function requireRole(...allowedRoles) {
    const user = requireAuthenticatedUser();
    const currentRole = (user.system_role || user.role || "").toUpperCase();
    const allowed = allowedRoles.map(r => String(r).toUpperCase());
    if (!allowed.includes(currentRole)) {
      throw new Error(`Bạn không có quyền thực hiện thao tác này. Thao tác yêu cầu vai trò [${allowedRoles.join(", ")}], vai trò hiện tại là [${getRoleLabel(currentRole)}].`);
    }
    return user;
  }

  function requirePermission(permission) {
    const user = requireAuthenticatedUser();
    if (user.system_role === "OPS_ADMIN") return user;
    if (!hasPermission(user.user_id, permission)) {
      throw new Error(`Bạn không có quyền thực hiện thao tác này (yêu cầu quyền ${permission}).`);
    }
    return user;
  }

  // --- Permission-Aware Authority Resolution Engine ---
  function resolveAuthorities(userId, permissionCode) {
    const user = getUserById(userId);
    if (!user) return [];

    const authorities = [];

    // 1. Direct authority
    if (user.permissions && user.permissions.includes(permissionCode)) {
      const depts = Array.isArray(user.scope?.department_ids) && user.scope.department_ids.length > 0
        ? [...user.scope.department_ids]
        : [user.department_id].filter(Boolean);
      authorities.push({
        source: "DIRECT",
        permission: permissionCode,
        department_ids: depts,
        approval_limit: Number(user.scope?.approval_limit) || 0
      });
    }

    // 2. Active delegated authorities
    const activeDelegations = getActiveDelegationsForUser(userId);
    activeDelegations.forEach(d => {
      if (d.permissions && d.permissions.includes(permissionCode)) {
        const delegator = getUserById(d.from_user);
        const depts = Array.isArray(d.scope_department_ids) && d.scope_department_ids.length > 0
          ? [...d.scope_department_ids]
          : (delegator?.scope?.department_ids || [delegator?.department_id].filter(Boolean));
        const limit = d.approval_limit !== null && d.approval_limit !== undefined
          ? Number(d.approval_limit)
          : (Number(delegator?.scope?.approval_limit) || 0);
        authorities.push({
          source: "DELEGATION",
          delegation_id: d.delegation_id,
          delegator_id: d.from_user,
          permission: permissionCode,
          department_ids: depts,
          approval_limit: limit
        });
      }
    });

    return authorities;
  }

  function hasAuthorityForDepartment(userId, permissionCode, departmentId) {
    const user = getUserById(userId);
    if (!user) return false;
    const authorities = resolveAuthorities(userId, permissionCode);
    return authorities.some(a => a.department_ids.includes(departmentId));
  }

  function requireDepartmentScope(departmentId, permissionCode = null) {
    const user = requireAuthenticatedUser();

    if (permissionCode) {
      if (!hasAuthorityForDepartment(user.user_id, permissionCode, departmentId)) {
        throw new Error(`Phòng ban ${departmentId} nằm ngoài phạm vi thẩm quyền [${permissionCode}] của bạn.`);
      }
      return user;
    }

    const allowedDepts = new Set(user.scope?.department_ids || [user.department_id].filter(Boolean));
    if (departmentId && !allowedDepts.has(departmentId)) {
      throw new Error(`Phòng ban ${departmentId} nằm ngoài phạm vi quản lý được phân công của bạn.`);
    }
    return user;
  }

  function requireApprovalLimit(amount, permissionCode = null) {
    const user = requireAuthenticatedUser();
    const reqAmount = Number(amount) || 0;

    if (permissionCode) {
      const authorities = resolveAuthorities(user.user_id, permissionCode);
      const maxLimit = authorities.length > 0 ? Math.max(...authorities.map(a => a.approval_limit)) : 0;
      if (reqAmount > maxLimit) {
        throw new Error(`Giá trị thao tác ${formatVND(reqAmount)} vượt quá hạn mức phê duyệt tối đa ${formatVND(maxLimit)} của bạn.`);
      }
      return user;
    }

    const limit = Number(user.scope?.approval_limit) || 0;
    if (reqAmount > limit) {
      throw new Error(`Giá trị thao tác ${formatVND(reqAmount)} vượt quá hạn mức phê duyệt ${formatVND(limit)} của bạn.`);
    }
    return user;
  }

  function getUsers() {
    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    return Array.isArray(users) ? users : Object.values(users);
  }

  function getUserById(userId) {
    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    if (users[userId]) return { ...users[userId] };
    const list = Object.values(users);
    const found = list.find(u => u.user_id === userId || u.employee_code === userId);
    return found ? { ...found } : null;
  }

  function updateEmployeeOrganization(userId, { department_id, job_title, manager_id }) {
    requireRole("HR");

    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    if (!users[userId]) {
      throw new Error(`Không tìm thấy nhân sự có mã ${userId}`);
    }
    const depts = getFromStorage(STORAGE_KEYS.DEPARTMENTS, typeof INITIAL_DEPARTMENTS !== "undefined" ? INITIAL_DEPARTMENTS : {});
    if (!department_id || !depts[department_id]) {
      throw new Error(`Mã phòng ban ${department_id} không tồn tại trong hệ thống.`);
    }

    if (manager_id) {
      if (manager_id === userId) {
        throw new Error("Nhân viên không thể tự làm quản lý trực tiếp của chính mình.");
      }
      if (!users[manager_id]) {
        throw new Error(`Không tìm thấy người quản lý có mã ${manager_id}`);
      }
    }

    users[userId].department_id = department_id;
    users[userId].department_name = depts[department_id].name;
    if (job_title && job_title.trim()) {
      users[userId].job_title = job_title.trim();
    }
    users[userId].manager_id = manager_id || null;

    saveToStorage(STORAGE_KEYS.USERS, users);
    return users[userId];
  }

  function createEmployeeProfile({ name, department_id, job_title, manager_id, employee_code, responsibilities = [] }) {
    requireRole("HR");

    if (!name || !name.trim()) {
      throw new Error("Họ và tên nhân viên không được để trống.");
    }
    if (!job_title || !job_title.trim()) {
      throw new Error("Chức danh công việc không được để trống.");
    }

    const depts = getFromStorage(STORAGE_KEYS.DEPARTMENTS, typeof INITIAL_DEPARTMENTS !== "undefined" ? INITIAL_DEPARTMENTS : {});
    if (!department_id || !depts[department_id]) {
      throw new Error(`Mã phòng ban ${department_id} không tồn tại.`);
    }

    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});

    if (manager_id && !users[manager_id]) {
      throw new Error(`Không tìm thấy thông tin quản lý có mã ${manager_id}`);
    }

    if (employee_code) {
      const cleanCode = employee_code.trim().toUpperCase();
      const duplicate = Object.values(users).some(u => (u.employee_code && u.employee_code.toUpperCase() === cleanCode) || u.user_id === cleanCode);
      if (duplicate) {
        throw new Error(`Mã nhân viên ${cleanCode} đã tồn tại trong hệ thống.`);
      }
    }

    const existingKeys = Object.keys(users);
    let nextNum = 16;
    existingKeys.forEach(k => {
      const match = k.match(/EMP(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n >= nextNum) nextNum = n + 1;
      }
    });

    const newId = employee_code ? employee_code.trim().toUpperCase() : `EMP${String(nextNum).padStart(3, "0")}`;
    const newProfile = {
      user_id: newId,
      employee_code: newId,
      name: name.trim(),
      department_id,
      department_name: depts[department_id].name,
      job_title: job_title.trim(),
      system_role: "EMPLOYEE",
      role: "EMPLOYEE",
      manager_id: manager_id || null,
      responsibilities: Array.isArray(responsibilities) ? responsibilities : [responsibilities].filter(Boolean),
      permissions: ["VIEW_OWN_WORK", "CREATE_PROCUREMENT", "SUBMIT_PROCUREMENT", "CREATE_EXPENSE", "SUBMIT_EXPENSE"],
      scope: {
        department_ids: [department_id],
        approval_limit: 0
      },
      account_status: "PENDING",
      username: "",
      email: ""
    };

    users[newId] = newProfile;
    saveToStorage(STORAGE_KEYS.USERS, users);
    return newProfile;
  }

  function createUserAccount(userId, param2, emailParam) {
    requireRole("SYSTEM_ADMIN");

    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    if (!users[userId]) {
      throw new Error(`Không tìm thấy nhân sự có mã ${userId}`);
    }

    if (users[userId].account_status === "ACTIVE" && users[userId].username) {
      throw new Error(`Nhân viên ${userId} đã có tài khoản hệ thống ACTIVE.`);
    }

    let username, email;
    if (typeof param2 === "object" && param2 !== null) {
      username = param2.username;
      email = param2.email;
    } else {
      username = param2;
      email = emailParam;
    }

    const cleanUsername = String(username || "").trim().toLowerCase();
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!cleanUsername) {
      throw new Error("Tên đăng nhập không được để trống.");
    }
    if (!cleanEmail) {
      throw new Error("Email không được để trống.");
    }

    const allUsers = Object.values(users);
    const duplicateUser = allUsers.find(u => u.user_id !== userId && u.username && u.username.toLowerCase() === cleanUsername);
    if (duplicateUser) {
      throw new Error(`Tên đăng nhập "${cleanUsername}" đã được sử dụng bởi tài khoản khác.`);
    }

    const duplicateEmail = allUsers.find(u => u.user_id !== userId && u.email && u.email.toLowerCase() === cleanEmail);
    if (duplicateEmail) {
      throw new Error(`Email "${cleanEmail}" đã được sử dụng bởi tài khoản khác.`);
    }

    const targetRole = users[userId].system_role || "EMPLOYEE";
    users[userId].username = cleanUsername;
    users[userId].email = cleanEmail;
    users[userId].system_role = targetRole;
    users[userId].role = targetRole;
    users[userId].account_status = "ACTIVE";

    saveToStorage(STORAGE_KEYS.USERS, users);
    return users[userId];
  }

  function setAccountStatus(userId, status) {
    requireRole("SYSTEM_ADMIN");

    const ALLOWED_STATUSES = ["PENDING", "ACTIVE", "DISABLED"];
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new Error(`Trạng thái tài khoản không hợp lệ [${status}]. Chỉ chấp nhận: PENDING, ACTIVE, DISABLED.`);
    }

    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    if (!users[userId]) {
      throw new Error(`Không tìm thấy nhân sự có mã ${userId}`);
    }

    users[userId].account_status = status;
    saveToStorage(STORAGE_KEYS.USERS, users);
    return users[userId];
  }

  function activateUserAccount(userId) {
    return setAccountStatus(userId, "ACTIVE");
  }

  function disableUserAccount(userId) {
    return setAccountStatus(userId, "DISABLED");
  }

  function updateUserAccess(userId, { system_role, scope, permissions }) {
    const currentUser = requireAuthenticatedUser();
    const role = (currentUser.system_role || currentUser.role || "").toUpperCase();
    if (role !== "OPS_ADMIN" && !hasPermission(currentUser.user_id, "MANAGE_ACCESS")) {
      throw new Error("Bạn không có quyền phân quyền hoặc cấu hình vai trò hệ thống.");
    }

    const users = getFromStorage(STORAGE_KEYS.USERS, typeof INITIAL_USERS !== "undefined" ? INITIAL_USERS : {});
    if (!users[userId]) {
      throw new Error(`Không tìm thấy nhân sự có mã ${userId}`);
    }

    const ALLOWED_ROLES = ["EMPLOYEE", "MANAGER", "HR", "OPS_ADMIN", "SYSTEM_ADMIN"];
    if (system_role) {
      if (!ALLOWED_ROLES.includes(system_role)) {
        throw new Error(`Vai trò hệ thống không hợp lệ: ${system_role}. Cho phép: ${ALLOWED_ROLES.join(", ")}`);
      }
      users[userId].system_role = system_role;
      users[userId].role = system_role;
    }

    if (scope) {
      const depts = getFromStorage(STORAGE_KEYS.DEPARTMENTS, typeof INITIAL_DEPARTMENTS !== "undefined" ? INITIAL_DEPARTMENTS : {});
      const deptIds = Array.isArray(scope.department_ids) ? scope.department_ids : (scope.department_ids ? [scope.department_ids] : []);
      const invalidDepts = deptIds.filter(d => !depts[d]);
      if (invalidDepts.length > 0) {
        throw new Error(`Mã phòng ban trong phạm vi không tồn tại: ${invalidDepts.join(", ")}`);
      }

      const limit = Number(scope.approval_limit);
      if (!Number.isFinite(limit) || limit < 0) {
        throw new Error("Hạn mức phê duyệt phải là số hợp lệ không âm.");
      }

      users[userId].scope = {
        department_ids: deptIds,
        approval_limit: limit
      };
    }

    if (Array.isArray(permissions)) {
      const catalogue = getFromStorage(STORAGE_KEYS.PERMISSIONS_CATALOGUE, typeof SYSTEM_PERMISSIONS_CATALOGUE !== "undefined" ? SYSTEM_PERMISSIONS_CATALOGUE : []);
      const validCodes = new Set(catalogue.map(p => p.code));
      const invalidPerms = permissions.filter(p => !validCodes.has(p));
      if (invalidPerms.length > 0) {
        throw new Error(`Quyền không tồn tại trong danh mục: ${invalidPerms.join(", ")}`);
      }
      users[userId].permissions = [...permissions];
    }

    saveToStorage(STORAGE_KEYS.USERS, users);
    return users[userId];
  }

  function assignSystemRole(userId, newRole) {
    return updateUserAccess(userId, { system_role: newRole });
  }

  function updatePermissionScope(userId, scope) {
    return updateUserAccess(userId, { scope });
  }

  function resetPasswordDemo(userId) {
    requireRole("SYSTEM_ADMIN");
    return { success: true, message: `Mật khẩu demo cho tài khoản ${userId} đã đặt lại về mặc định (123).` };
  }

  // --- Delegations Management ---
  function getDelegations() {
    return getFromStorage(STORAGE_KEYS.DELEGATIONS, typeof INITIAL_DELEGATIONS !== "undefined" ? INITIAL_DELEGATIONS : []);
  }

  function isDelegationEffective(delegation) {
    if (!delegation) return false;
    if (delegation.status !== "ACTIVE") return false;

    // 1. Period validity
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    if (delegation.start_date && todayStr < delegation.start_date) return false;
    if (delegation.end_date && todayStr > delegation.end_date) return false;

    // 2. Delegator exists and is ACTIVE
    const delegator = getUserById(delegation.from_user);
    if (!delegator || delegator.account_status !== "ACTIVE") return false;

    // 3. Delegatee exists and is ACTIVE
    const delegatee = getUserById(delegation.to_user);
    if (!delegatee || delegatee.account_status !== "ACTIVE") return false;

    // 4. Delegator STILL directly owns every delegated permission
    const delegatorPerms = delegator.permissions || [];
    if (!Array.isArray(delegation.permissions) || delegation.permissions.length === 0) return false;
    const stillOwnsAllPerms = delegation.permissions.every(p => delegatorPerms.includes(p));
    if (!stillOwnsAllPerms) return false;

    // 5. Delegated scope is still inside the delegator's current scope
    const delegatorDepts = new Set(
      Array.isArray(delegator.scope?.department_ids) && delegator.scope.department_ids.length > 0
        ? delegator.scope.department_ids
        : [delegator.department_id].filter(Boolean)
    );
    const delegatedDepts = Array.isArray(delegation.scope_department_ids) && delegation.scope_department_ids.length > 0
      ? delegation.scope_department_ids
      : (delegator.scope?.department_ids || [delegator.department_id].filter(Boolean));
    const isScopeValid = delegatedDepts.every(deptId => delegatorDepts.has(deptId));
    if (!isScopeValid) return false;

    // 6. Delegated approval limit is still <= delegator's current approval limit
    const delegatorLimit = Number(delegator.scope?.approval_limit) || 0;
    const delegatedLimit = delegation.approval_limit !== null && delegation.approval_limit !== undefined
      ? Number(delegation.approval_limit)
      : delegatorLimit;
    if (delegatedLimit > delegatorLimit) return false;

    return true;
  }

  function getActiveDelegationsForUser(userId) {
    const delegations = getDelegations();
    return delegations.filter(d => {
      if (d.to_user !== userId) return false;
      return isDelegationEffective(d);
    });
  }

  function createDelegation({ from_user, to_user, permissions = [], start_date, end_date, note = "", approval_limit = null }) {
    const currentUser = requireAuthenticatedUser();

    if (from_user !== currentUser.user_id && currentUser.system_role !== "OPS_ADMIN") {
      throw new Error("Bạn chỉ có thể tạo ủy quyền từ tài khoản của chính mình.");
    }

    if (from_user === to_user) {
      throw new Error("Không thể tự ủy quyền cho chính mình.");
    }

    const delegator = getUserById(from_user);
    if (!delegator || delegator.account_status !== "ACTIVE") {
      throw new Error("Tài khoản người ủy quyền không tồn tại hoặc không ở trạng thái ACTIVE.");
    }

    const delegatee = getUserById(to_user);
    if (!delegatee || delegatee.account_status !== "ACTIVE") {
      throw new Error("Tài khoản người được ủy quyền không tồn tại hoặc không ở trạng thái ACTIVE.");
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new Error("Danh sách quyền ủy quyền không được để trống.");
    }

    const catalogue = getFromStorage(STORAGE_KEYS.PERMISSIONS_CATALOGUE, typeof SYSTEM_PERMISSIONS_CATALOGUE !== "undefined" ? SYSTEM_PERMISSIONS_CATALOGUE : []);
    const validCodes = new Set(catalogue.map(p => p.code));
    const invalidCodes = permissions.filter(p => !validCodes.has(p));
    if (invalidCodes.length > 0) {
      throw new Error(`Quyền không tồn tại trong danh mục: ${invalidCodes.join(", ")}`);
    }

    const blockedAdminPerms = permissions.filter(p => NON_DELEGABLE_PERMISSIONS.includes(p));
    if (blockedAdminPerms.length > 0) {
      throw new Error(`Các quyền quản trị hệ thống không được phép ủy quyền (${blockedAdminPerms.join(", ")}).`);
    }

    const delegatorPerms = delegator.permissions || [];
    const unownedPerms = permissions.filter(p => !delegatorPerms.includes(p));
    if (unownedPerms.length > 0) {
      throw new Error(`Người ủy quyền không thể ủy quyền quyền mà bản thân không sở hữu (${unownedPerms.join(", ")}).`);
    }

    if (!start_date || !end_date) {
      throw new Error("Ngày bắt đầu và ngày kết thúc ủy quyền không được để trống.");
    }
    const dStart = new Date(start_date);
    const dEnd = new Date(end_date);
    if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime())) {
      throw new Error("Định dạng ngày ủy quyền không hợp lệ.");
    }
    if (start_date > end_date) {
      throw new Error("Ngày kết thúc ủy quyền phải sau hoặc bằng ngày bắt đầu.");
    }

    const delegatorLimit = Number(delegator.scope?.approval_limit) || 0;
    const requestedLimit = approval_limit !== null && approval_limit !== undefined ? Number(approval_limit) : delegatorLimit;
    if (!Number.isFinite(requestedLimit) || requestedLimit < 0) {
      throw new Error("Hạn mức ủy quyền phải là số hợp lệ không âm.");
    }
    if (requestedLimit > delegatorLimit) {
      throw new Error(`Hạn mức ủy quyền không được vượt quá hạn mức phê duyệt của người ủy quyền (${formatVND(delegatorLimit)}).`);
    }

    const delegations = getDelegations();
    const numbers = delegations.map(d => {
      const match = (d.delegation_id || "").match(/DLG-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const nextId = `DLG-${String(maxNum + 1).padStart(3, "0")}`;

    const newDelegation = {
      delegation_id: nextId,
      from_user: delegator.user_id,
      from_user_name: delegator.name,
      to_user: delegatee.user_id,
      to_user_name: delegatee.name,
      permissions: [...permissions],
      scope_department_ids: delegator.scope?.department_ids || [delegator.department_id],
      approval_limit: requestedLimit,
      start_date,
      end_date,
      status: "ACTIVE",
      note: note || "Ủy quyền quyền hạn công tác"
    };

    delegations.unshift(newDelegation);
    saveToStorage(STORAGE_KEYS.DELEGATIONS, delegations);
    return newDelegation;
  }

  function revokeDelegation(delegationId) {
    const currentUser = requireAuthenticatedUser();
    const currentUserId = currentUser.user_id || currentUser.id;
    const role = (currentUser.system_role || currentUser.role || "").toUpperCase();

    const delegations = getDelegations();
    const dlg = delegations.find(d => d.delegation_id === delegationId);
    if (!dlg) throw new Error(`Không tìm thấy ủy quyền ${delegationId}`);

    if (dlg.status === "REVOKED") {
      throw new Error(`Ủy quyền ${delegationId} đã được thu hồi trước đó.`);
    }

    const isOriginalDelegator = currentUserId === dlg.from_user;
    const isOpsAdmin = role === "OPS_ADMIN";

    if (!isOriginalDelegator && !isOpsAdmin) {
      throw new Error("Bạn không có quyền thu hồi ủy quyền này.");
    }

    dlg.status = "REVOKED";
    saveToStorage(STORAGE_KEYS.DELEGATIONS, delegations);
    return dlg;
  }

  // --- Granular Permissions & Scope Authorization Layer ---
  function hasPermission(userId, permissionCode) {
    const user = getUserById(userId);
    if (!user) return false;
    if (user.permissions && user.permissions.includes(permissionCode)) return true;

    const activeDelegations = getActiveDelegationsForUser(userId);
    return activeDelegations.some(d => d.permissions && d.permissions.includes(permissionCode));
  }

  function canApprovePurchaseRequest(userId, request) {
    const user = getUserById(userId) || getCurrentUser();
    if (!user) return { allowed: false, code: "UNAUTHORIZED", message: "Phiên làm việc không xác thực." };

    // Self-approval prohibition (Separation of Duties)
    if (request.requester_id === user.user_id) {
      return {
        allowed: false,
        code: "SELF_APPROVAL_FORBIDDEN",
        message: "Bạn không thể tự phê duyệt yêu cầu do chính mình tạo."
      };
    }

    if (request.status && request.status !== "PENDING_APPROVAL") {
      return {
        allowed: false,
        code: "INVALID_STATE",
        message: `Yêu cầu không ở trạng thái chờ phê duyệt (trạng thái hiện tại: ${request.status}).`
      };
    }

    const authorities = resolveAuthorities(user.user_id, "APPROVE_PROCUREMENT");
    if (authorities.length === 0) {
      return {
        allowed: false,
        code: "PERMISSION_DENIED",
        message: "Bạn không có quyền phê duyệt yêu cầu mua sắm trên hệ thống."
      };
    }

    const reqAmount = Number(request.total_price || request.total_estimated_vnd || request.amount) || 0;

    // Match exact authority covering BOTH department and amount
    const matchingAuth = authorities.find(a => a.department_ids.includes(request.department_id) && a.approval_limit >= reqAmount);
    if (matchingAuth) {
      return { allowed: true, code: "OK", message: "Đủ thẩm quyền phê duyệt" };
    }

    // Check if department is covered at all
    const deptAuths = authorities.filter(a => a.department_ids.includes(request.department_id));
    if (deptAuths.length === 0) {
      return {
        allowed: false,
        code: "SCOPE_VIOLATION",
        message: `Bạn có quyền phê duyệt mua sắm nhưng yêu cầu này thuộc phòng ban ngoài phạm vi quản lý (${request.department_name || request.department_id}).`
      };
    }

    const maxDeptLimit = Math.max(...deptAuths.map(a => a.approval_limit));
    return {
      allowed: false,
      code: "APPROVAL_LIMIT_EXCEEDED",
      message: `Giá trị yêu cầu ${formatVND(reqAmount)} vượt hạn mức phê duyệt ${formatVND(maxDeptLimit)} cho phòng ban này.`
    };
  }

  function canApproveExpenseClaim(userId, claim) {
    const user = getUserById(userId) || getCurrentUser();
    if (!user) return { allowed: false, code: "UNAUTHORIZED", message: "Phiên làm việc không xác thực." };

    // Self-approval prohibition (Separation of Duties)
    if (claim.requester_id === user.user_id) {
      return {
        allowed: false,
        code: "SELF_APPROVAL_FORBIDDEN",
        message: "Bạn không thể tự phê duyệt yêu cầu do chính mình tạo."
      };
    }

    if (claim.status && claim.status !== "PENDING_APPROVAL") {
      return {
        allowed: false,
        code: "INVALID_STATE",
        message: `Hồ sơ chi phí không ở trạng thái chờ phê duyệt (trạng thái hiện tại: ${claim.status}).`
      };
    }

    const authorities = resolveAuthorities(user.user_id, "APPROVE_EXPENSE");
    if (authorities.length === 0) {
      return {
        allowed: false,
        code: "PERMISSION_DENIED",
        message: "Bạn không có quyền phê duyệt hồ sơ chi phí trên hệ thống."
      };
    }

    const claimAmount = Number(claim.amount || claim.total_price || claim.total_estimated_vnd) || 0;

    // Match exact authority covering BOTH department and amount
    const matchingAuth = authorities.find(a => a.department_ids.includes(claim.department_id) && a.approval_limit >= claimAmount);
    if (matchingAuth) {
      return { allowed: true, code: "OK", message: "Đủ thẩm quyền phê duyệt" };
    }

    const deptAuths = authorities.filter(a => a.department_ids.includes(claim.department_id));
    if (deptAuths.length === 0) {
      return {
        allowed: false,
        code: "SCOPE_VIOLATION",
        message: `Bạn có quyền phê duyệt chi phí nhưng yêu cầu này thuộc phòng ban ngoài phạm vi quản lý (${claim.department_name || claim.department_id}).`
      };
    }

    const maxDeptLimit = Math.max(...deptAuths.map(a => a.approval_limit));
    return {
      allowed: false,
      code: "APPROVAL_LIMIT_EXCEEDED",
      message: `Giá trị yêu cầu ${formatVND(claimAmount)} vượt hạn mức phê duyệt ${formatVND(maxDeptLimit)} cho phòng ban này.`
    };
  }

  // --- Visibility Helpers ---
  function canViewPurchaseRequest(user, request) {
    if (!user || !request) return false;
    const role = (user.system_role || user.role || "").toUpperCase();
    if (role === "SYSTEM_ADMIN" || role === "HR") return false;
    if (request.requester_id === user.user_id) return true;
    if (role === "OPS_ADMIN") return true;

    if (role === "MANAGER") {
      const directDepts = user.scope?.department_ids || [user.department_id].filter(Boolean);
      if (directDepts.includes(request.department_id)) return true;
      const auths = resolveAuthorities(user.user_id, "APPROVE_PROCUREMENT");
      if (auths.some(a => a.department_ids.includes(request.department_id))) return true;
    }
    return false;
  }

  function canViewExpenseClaim(user, claim) {
    if (!user || !claim) return false;
    const role = (user.system_role || user.role || "").toUpperCase();
    if (role === "SYSTEM_ADMIN" || role === "HR") return false;
    if (claim.requester_id === user.user_id) return true;
    if (role === "OPS_ADMIN") return true;

    if (role === "MANAGER") {
      const directDepts = user.scope?.department_ids || [user.department_id].filter(Boolean);
      if (directDepts.includes(claim.department_id)) return true;
      const auths = resolveAuthorities(user.user_id, "APPROVE_EXPENSE");
      if (auths.some(a => a.department_ids.includes(claim.department_id))) return true;
    }
    return false;
  }

  function canViewAsset(user, asset) {
    if (!user || !asset) return false;
    const role = (user.system_role || user.role || "").toUpperCase();
    if (role === "SYSTEM_ADMIN" || role === "HR") return false;
    if (role === "OPS_ADMIN") return true;
    if (asset.assigned_to === user.user_id) return true;

    if (role === "EMPLOYEE") {
      return asset.status === "AVAILABLE" && asset.department_id === user.department_id;
    }
    if (role === "MANAGER") {
      const directDepts = user.scope?.department_ids || [user.department_id].filter(Boolean);
      return directDepts.includes(asset.department_id);
    }
    return false;
  }

  function getVisibleAssetsForUser(user) {
    const u = user || getCurrentUser();
    if (!u) return [];
    return getAssets().filter(a => canViewAsset(u, a));
  }

  function isUserMeetingParticipant(user, meeting) {
    if (!user || !meeting || !Array.isArray(meeting.attendees)) return false;
    return meeting.attendees.some(att => {
      if (!att) return false;
      if (typeof att === "string") {
        const clean = att.trim();
        return clean === user.name || clean === user.user_id || clean.includes(user.name);
      }
      if (typeof att === "object") {
        return att.user_id === user.user_id || att.id === user.user_id || att.name === user.name || att.attendee_name === user.name;
      }
      return false;
    });
  }

  function canViewMeeting(user, meeting) {
    if (!user || !meeting) return false;
    const role = (user.system_role || user.role || "").toUpperCase();
    if (role === "SYSTEM_ADMIN" || role === "HR") return false;
    if (role === "OPS_ADMIN") return true;
    if (meeting.organizer_id === user.user_id) return true;
    if (isUserMeetingParticipant(user, meeting)) return true;

    if (role === "MANAGER") {
      return meeting.department_name === user.department_name;
    }
    return false;
  }

  function canViewDocument(user, doc) {
    if (!user || !doc) return false;
    const role = (user.system_role || user.role || "").toUpperCase();
    if (role === "SYSTEM_ADMIN") return false;
    if (doc.creator_id === user.user_id) return true;
    if (role === "OPS_ADMIN") return true;

    if (role === "HR") {
      return Boolean(doc.template_id && doc.template_id.startsWith("FORM-HR"));
    }
    if (role === "MANAGER") {
      return doc.department_name === user.department_name;
    }
    return false;
  }

  function getVisibleDocumentsForCurrentUser() {
    const user = getCurrentUser();
    if (!user) return [];
    return getGeneratedDocuments().filter(d => canViewDocument(user, d));
  }

  // --- Departments ---
  function getDepartments() {
    const depts = getFromStorage(STORAGE_KEYS.DEPARTMENTS, typeof INITIAL_DEPARTMENTS !== "undefined" ? INITIAL_DEPARTMENTS : {});
    return Array.isArray(depts) ? depts : Object.values(depts);
  }

  // --- Budgets ---
  function getBudgets() {
    return getFromStorage(STORAGE_KEYS.BUDGETS, typeof INITIAL_BUDGETS !== "undefined" ? INITIAL_BUDGETS : {});
  }

  function getDepartmentBudget(departmentId) {
    const budgets = getBudgets();
    return budgets[departmentId] || null;
  }

  function deductDepartmentBudget(departmentId, amount) {
    const budgets = getBudgets();
    if (budgets[departmentId]) {
      const b = budgets[departmentId];
      const newSpent = b.spent_amount + amount;
      if (newSpent > b.total_budget) {
        const err = new Error("Không thể trừ ngân sách: Giá trị chi tiêu vượt quá tổng ngân sách được cấp.");
        err.code = "BUDGET_EXCEEDED";
        throw err;
      }
      b.spent_amount = newSpent;
      b.available_amount = b.total_budget - b.spent_amount;
      saveToStorage(STORAGE_KEYS.BUDGETS, budgets);
    }
  }

  // --- Products ---
  function getProducts() {
    return getFromStorage(STORAGE_KEYS.PRODUCTS, typeof INITIAL_PRODUCTS !== "undefined" ? INITIAL_PRODUCTS : []);
  }

  function getProductById(productId) {
    const products = getProducts();
    return products.find(p => p.product_id === productId) || null;
  }

  function searchProducts(category, quantity = 1, specifications = null, maxTotalPrice = null) {
    const products = getProducts();
    const cat = category ? category.toLowerCase().trim() : null;
    const spec = specifications ? specifications.toLowerCase().trim() : null;

    return products.filter(p => {
      if (cat && p.category.toLowerCase() !== cat) return false;
      if (spec && !p.specifications.toLowerCase().includes(spec)) return false;
      const total = p.unit_price * quantity;
      if (maxTotalPrice !== null && total > maxTotalPrice) return false;
      return true;
    }).map(p => ({
      ...p,
      quantity,
      total_price: p.unit_price * quantity
    }));
  }

  // --- Purchase Requests ---
  function getRequests() {
    return getFromStorage(STORAGE_KEYS.REQUESTS, typeof INITIAL_REQUESTS !== "undefined" ? INITIAL_REQUESTS : []);
  }

  function getRequestById(id) {
    const requests = getRequests();
    return requests.find(r => r.id === id) || null;
  }

  function generateNextRequestId() {
    const requests = getRequests();
    const numbers = requests.map(r => {
      const match = (r.id || "").match(/PR-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `PR-${String(maxNum + 1).padStart(3, "0")}`;
  }

  function createPurchaseRequest({ productId, quantity, reason }) {
    const user = requireAuthenticatedUser();
    requirePermission("CREATE_PROCUREMENT");

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty <= 0) {
      throw new Error("Số lượng mua sắm phải là số nguyên dương hợp lệ.");
    }

    const product = getProductById(productId);
    if (!product) {
      throw new Error(`Sản phẩm ${productId} không tồn tại trong danh mục đã duyệt.`);
    }

    const totalPrice = product.unit_price * qty;
    const budget = getDepartmentBudget(user.department_id);

    if (budget && totalPrice > budget.available_amount) {
      throw new Error(`Giá trị mua sắm ${formatVND(totalPrice)} vượt quá ngân sách khả dụng ${formatVND(budget.available_amount)}.`);
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const newRequest = {
      id: generateNextRequestId(),
      product_id: product.product_id,
      product_name: product.name,
      specifications: product.specifications,
      category: product.category,
      quantity: qty,
      unit_price: product.unit_price,
      total_price: totalPrice,
      requester_id: user.user_id,
      requester_name: user.name,
      department_id: user.department_id,
      department_name: user.department_name,
      reason: reason || "Yêu cầu trang thiết bị phục vụ công việc",
      status: "DRAFT",
      created_at: timeStr,
      submitted_at: null,
      approved_at: null,
      history: [
        {
          type: "CREATED",
          user: user.name,
          time: timeStr,
          note: "Yêu cầu mua sắm được tạo ở trạng thái Bản nháp (DRAFT)"
        }
      ]
    };

    const requests = getRequests();
    requests.unshift(newRequest);
    saveToStorage(STORAGE_KEYS.REQUESTS, requests);
    return newRequest;
  }

  function submitPurchaseRequest(requestId) {
    const user = requireAuthenticatedUser();
    requirePermission("SUBMIT_PROCUREMENT");

    const requests = getRequests();
    const req = requests.find(r => r.id === requestId);

    if (!req) {
      throw new Error(`Không tìm thấy yêu cầu mua sắm: ${requestId}`);
    }
    if (req.status !== "DRAFT") {
      throw new Error(`Không thể gửi yêu cầu ở trạng thái [${req.status}].`);
    }

    const currentUserId = user.user_id || user.id;
    if (req.requester_id !== currentUserId) {
      throw new Error("Bạn chỉ có thể gửi yêu cầu mua sắm do chính mình tạo.");
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    req.status = "PENDING_APPROVAL";
    req.submitted_at = timeStr;
    req.history.push({
      type: "SUBMITTED",
      user: user.name,
      time: timeStr,
      note: "Đã gửi yêu cầu đến Quản lý bộ phận xét duyệt"
    });

    saveToStorage(STORAGE_KEYS.REQUESTS, requests);
    return req;
  }

  function approvePurchaseRequest(requestId) {
    const user = requireAuthenticatedUser();
    const requests = getRequests();
    const req = requests.find(r => r.id === requestId);

    if (!req) {
      throw new Error(`Không tìm thấy yêu cầu mua sắm: ${requestId}`);
    }
    if (req.status !== "PENDING_APPROVAL") {
      throw new Error(`Không thể phê duyệt yêu cầu ở trạng thái [${req.status}].`);
    }

    const check = canApprovePurchaseRequest(user.user_id, req);
    if (!check.allowed) {
      const err = new Error(check.message);
      err.code = check.code;
      throw err;
    }

    // Recheck current budget immediately before approval
    const currentBudget = getDepartmentBudget(req.department_id);
    if (currentBudget) {
      const available = currentBudget.total_budget - currentBudget.spent_amount;
      if (req.total_price > available) {
        const err = new Error("Ngân sách khả dụng hiện tại không còn đủ để phê duyệt yêu cầu này.");
        err.code = "BUDGET_EXCEEDED";
        throw err;
      }
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    req.status = "APPROVED";
    req.approved_at = timeStr;
    req.approved_by = user.name;
    req.history.push({
      type: "APPROVED",
      user: user.name,
      time: timeStr,
      note: `Phê duyệt bởi ${user.job_title || user.name} (${user.name})`
    });

    deductDepartmentBudget(req.department_id, req.total_price);
    saveToStorage(STORAGE_KEYS.REQUESTS, requests);
    return req;
  }

  function rejectPurchaseRequest(requestId, reason = "Từ chối bởi cấp quản lý") {
    const user = requireAuthenticatedUser();
    const requests = getRequests();
    const req = requests.find(r => r.id === requestId);

    if (!req) {
      throw new Error(`Không tìm thấy yêu cầu mua sắm: ${requestId}`);
    }

    if (req.requester_id === user.user_id) {
      throw new Error("Bạn không thể tự từ chối yêu cầu do chính mình tạo.");
    }

    const check = canApprovePurchaseRequest(user.user_id, req);
    if (!check.allowed) {
      throw new Error(check.message);
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    req.status = "REJECTED";
    req.rejected_at = timeStr;
    req.rejected_by = user.name;
    req.rejection_reason = reason;
    req.history.push({
      type: "REJECTED",
      user: user.name,
      time: timeStr,
      note: `Từ chối bởi ${user.job_title || user.name}: "${reason}"`
    });

    saveToStorage(STORAGE_KEYS.REQUESTS, requests);
    return req;
  }

  // --- ASSETS MANAGEMENT ---
  function getAssets() {
    return getFromStorage(STORAGE_KEYS.ASSETS, typeof INITIAL_ASSETS !== "undefined" ? INITIAL_ASSETS : []);
  }

  function getAssetById(id) {
    const assets = getAssets();
    return assets.find(a => a.id === id || a.asset_id === id) || null;
  }

  function searchAssets({ category = null, specifications = null, departmentId = null, status = null } = {}) {
    const assets = getAssets();
    return assets.filter(a => {
      if (category && a.category.toLowerCase() !== category.toLowerCase()) return false;
      if (specifications && !a.specifications.toLowerCase().includes(specifications.toLowerCase())) return false;
      if (departmentId && a.department_id !== departmentId) return false;
      if (status && a.status.toUpperCase() !== status.toUpperCase()) return false;
      return true;
    });
  }

  function assignAsset(assetId, employeeId) {
    const currentUser = requireAuthenticatedUser();
    if (currentUser.system_role !== "OPS_ADMIN" && !hasPermission(currentUser.user_id, "ASSIGN_ASSET")) {
      throw new Error("Bạn không có quyền cấp phát tài sản công ty (yêu cầu quyền ASSIGN_ASSET).");
    }

    const assets = getAssets();
    const asset = assets.find(a => a.id === assetId || a.asset_id === assetId);
    if (!asset) throw new Error(`Không tìm thấy tài sản ${assetId}`);

    if (asset.status !== "AVAILABLE") {
      throw new Error(`Tài sản hiện ở trạng thái [${asset.status}], chỉ tài sản AVAILABLE mới có thể cấp phát.`);
    }

    if (currentUser.system_role !== "OPS_ADMIN" && asset.department_id) {
      requireDepartmentScope(asset.department_id, "ASSIGN_ASSET");
    }

    const users = getUsers();
    const employee = users.find(u => u.user_id === employeeId);
    if (!employee || employee.account_status !== "ACTIVE") {
      throw new Error(`Nhân viên nhận tài sản ${employeeId} không tồn tại hoặc không ở trạng thái ACTIVE.`);
    }

    if (currentUser.system_role !== "OPS_ADMIN") {
      const authorities = resolveAuthorities(currentUser.user_id, "ASSIGN_ASSET");
      const allowedDepts = new Set();
      authorities.forEach(a => a.department_ids.forEach(d => allowedDepts.add(d)));
      if (!allowedDepts.has(employee.department_id)) {
        throw new Error("Nhân viên nhận tài sản thuộc phòng ban nằm ngoài phạm vi cấp phát tài sản của bạn.");
      }
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    asset.status = "ASSIGNED";
    asset.assigned_to = employee.user_id;
    asset.assigned_name = employee.name;
    asset.assigned_to_name = employee.name;
    asset.last_updated = dateStr;
    asset.updated_at = dateStr;

    saveToStorage(STORAGE_KEYS.ASSETS, assets);
    return asset;
  }

  function returnAsset(assetId) {
    const currentUser = requireAuthenticatedUser();
    if (currentUser.system_role !== "OPS_ADMIN" && !hasPermission(currentUser.user_id, "ASSIGN_ASSET")) {
      throw new Error("Bạn không có quyền thu hồi tài sản công ty (yêu cầu quyền ASSIGN_ASSET).");
    }

    const assets = getAssets();
    const asset = assets.find(a => a.id === assetId || a.asset_id === assetId);
    if (!asset) throw new Error(`Không tìm thấy tài sản ${assetId}`);

    if (asset.status !== "ASSIGNED") {
      throw new Error(`Tài sản hiện ở trạng thái [${asset.status}], chỉ tài sản ASSIGNED mới có thể thu hồi.`);
    }

    if (currentUser.system_role !== "OPS_ADMIN" && asset.department_id) {
      requireDepartmentScope(asset.department_id, "ASSIGN_ASSET");
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    asset.status = "AVAILABLE";
    asset.assigned_to = null;
    asset.assigned_name = "Unassigned";
    asset.assigned_to_name = null;
    asset.last_updated = dateStr;
    asset.updated_at = dateStr;

    saveToStorage(STORAGE_KEYS.ASSETS, assets);
    return asset;
  }

  // --- EXPENSE REIMBURSEMENT ---
  function getExpenses() {
    return getFromStorage(STORAGE_KEYS.EXPENSES, typeof INITIAL_EXPENSES !== "undefined" ? INITIAL_EXPENSES : []);
  }

  function getExpenseById(id) {
    const expenses = getExpenses();
    return expenses.find(e => e.id === id) || null;
  }

  function generateNextExpenseId() {
    const expenses = getExpenses();
    const numbers = expenses.map(e => {
      const match = (e.id || "").match(/EXP-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `EXP-${String(maxNum + 1).padStart(3, "0")}`;
  }

  function createExpenseClaim({ category, amount, reason, expenseDate, receiptFilename = null, receiptUrl = null }) {
    const user = requireAuthenticatedUser();
    requirePermission("CREATE_EXPENSE");

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error("Số tiền chi phí phải là số hợp lệ lớn hơn 0.");
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const dateStr = expenseDate || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const filename = receiptFilename || receiptUrl || null;

    const newClaim = {
      id: generateNextExpenseId(),
      category: category || "Travel",
      amount: parsedAmount,
      expense_date: dateStr,
      requester_id: user.user_id,
      requester_name: user.name,
      department_id: user.department_id,
      department_name: user.department_name,
      reason: reason || "Chi phí hoạt động tác nghiệp",
      business_reason: reason || "Chi phí hoạt động tác nghiệp",
      receipt_status: filename ? "ATTACHED" : "MISSING",
      receipt_filename: filename,
      receipt_url: filename,
      receipt_attached: Boolean(filename),
      status: "DRAFT",
      created_at: timeStr,
      submitted_at: null,
      approved_at: null,
      history: [
        {
          type: "CREATED",
          user: user.name,
          time: timeStr,
          note: "Hồ sơ hoàn chi phí được tạo ở trạng thái Bản nháp (DRAFT)"
        }
      ]
    };

    const expenses = getExpenses();
    expenses.unshift(newClaim);
    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
    return newClaim;
  }

  function submitExpenseClaim(claimId) {
    const user = requireAuthenticatedUser();
    requirePermission("SUBMIT_EXPENSE");

    const expenses = getExpenses();
    const claim = expenses.find(e => e.id === claimId);
    if (!claim) throw new Error(`Không tìm thấy hồ sơ chi phí: ${claimId}`);

    if (claim.status !== "DRAFT") {
      throw new Error(`Không thể nộp hồ sơ ở trạng thái [${claim.status}].`);
    }

    const currentUserId = user.user_id || user.id;
    if (claim.requester_id !== currentUserId) {
      throw new Error("Bạn chỉ có thể gửi hồ sơ chi phí do chính mình tạo.");
    }

    if (claim.amount > 500000 && claim.receipt_status !== "ATTACHED" && !claim.receipt_url && !claim.receipt_attached) {
      throw new Error("POLICY_RESTRICTION: Chi phí vượt quá 500.000 VND bắt buộc phải đính kèm hóa đơn trước khi nộp duyệt (Chính sách Mục 5.1).");
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    claim.status = "PENDING_APPROVAL";
    claim.submitted_at = timeStr;
    claim.history.push({
      type: "SUBMITTED",
      user: user.name,
      time: timeStr,
      note: "Đã nộp hồ sơ chờ Trưởng phòng xét duyệt"
    });

    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
    return claim;
  }

  function approveExpenseClaim(claimId) {
    const user = requireAuthenticatedUser();
    const expenses = getExpenses();
    const claim = expenses.find(e => e.id === claimId);
    if (!claim) throw new Error(`Không tìm thấy hồ sơ chi phí: ${claimId}`);

    const check = canApproveExpenseClaim(user.user_id, claim);
    if (!check.allowed) {
      const err = new Error(check.message);
      err.code = check.code;
      throw err;
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    claim.status = "APPROVED";
    claim.approved_at = timeStr;
    claim.approved_by = user.name;
    claim.history.push({
      type: "APPROVED",
      user: user.name,
      time: timeStr,
      note: `Phê duyệt bởi ${user.job_title || user.name} (${user.name})`
    });

    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
    return claim;
  }

  function rejectExpenseClaim(claimId, reason = "Từ chối bởi cấp quản lý") {
    const user = requireAuthenticatedUser();
    const expenses = getExpenses();
    const claim = expenses.find(e => e.id === claimId);
    if (!claim) throw new Error(`Không tìm thấy hồ sơ chi phí: ${claimId}`);

    if (claim.requester_id === user.user_id) {
      throw new Error("Bạn không thể tự từ chối hồ sơ do chính mình tạo.");
    }

    const check = canApproveExpenseClaim(user.user_id, claim);
    if (!check.allowed) {
      throw new Error(check.message);
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    claim.status = "REJECTED";
    claim.rejected_at = timeStr;
    claim.rejected_by = user.name;
    claim.rejection_reason = reason;
    claim.history.push({
      type: "REJECTED",
      user: user.name,
      time: timeStr,
      note: `Từ chối bởi ${user.job_title || user.name}: "${reason}"`
    });

    saveToStorage(STORAGE_KEYS.EXPENSES, expenses);
    return claim;
  }

  // --- BUSINESS SYSTEMS & MEETINGS ---
  function getBusinessSystems() {
    return getFromStorage(STORAGE_KEYS.SYSTEMS, typeof INITIAL_SYSTEMS !== "undefined" ? INITIAL_SYSTEMS : []);
  }

  function getSystemById(systemId) {
    const systems = getBusinessSystems();
    return systems.find(s => s.system_id === systemId) || null;
  }

  function getMeetings() {
    const list = getFromStorage(STORAGE_KEYS.MEETINGS, typeof INITIAL_MEETINGS !== "undefined" ? INITIAL_MEETINGS : []);
    return list.map(m => {
      const dt = m.date_time || (typeof m.time_slot === "object" ? (m.time_slot?.display || m.time_slot?.date_time) : m.time_slot) || "Chưa xác định";
      const attendees = Array.isArray(m.attendees) ? m.attendees : (m.attendees ? [m.attendees] : []);
      const count = typeof m.attendee_count === "number" ? m.attendee_count : attendees.length;
      return {
        ...m,
        date_time: dt,
        time_slot: dt,
        attendees,
        attendee_count: count
      };
    });
  }

  function generateNextMeetingId() {
    const meetings = getMeetings();
    const numbers = meetings.map(m => {
      const match = (m.id || "").match(/MTG-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    return `MTG-${String(maxNum + 1).padStart(3, "0")}`;
  }

  function createMeeting({ topic, systemId = null, systemName = null, timeSlot, dateTime, date_time, attendees, attendee_count, agenda }) {
    const user = requireAuthenticatedUser();
    if (user.system_role !== "OPS_ADMIN" && !hasPermission(user.user_id, "CREATE_MEETING")) {
      throw new Error("Bạn không có quyền lên lịch hoặc điều phối cuộc họp (yêu cầu quyền CREATE_MEETING).");
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;

    const resolvedDateTime =
      date_time ||
      dateTime ||
      (typeof timeSlot === "object" && timeSlot !== null ? (timeSlot.display || timeSlot.date_time || timeSlot.slot_id) : timeSlot) ||
      `${tomorrowStr} 14:00`;

    const resolvedAttendees = Array.isArray(attendees) ? attendees : (attendees ? [attendees] : []);
    const resolvedCount = typeof attendee_count === "number" ? attendee_count : resolvedAttendees.length;

    const newMeeting = {
      id: generateNextMeetingId(),
      topic: topic || "Cuộc họp điều phối nội bộ",
      system_id: systemId,
      system_name: systemName || (systemId ? "Enterprise System" : "General Coordination"),
      organizer_id: user.user_id,
      organizer_name: user.name,
      department_name: user.department_name,
      date_time: resolvedDateTime,
      time_slot: resolvedDateTime,
      attendees: resolvedAttendees,
      attendee_count: resolvedCount,
      agenda: agenda || [],
      status: "SCHEDULED",
      created_at: timeStr
    };

    const meetings = getMeetings();
    meetings.unshift(newMeeting);
    saveToStorage(STORAGE_KEYS.MEETINGS, meetings);
    return newMeeting;
  }

  function findCommonMeetingSlots(attendees = []) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);

    const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const fmtDisplay = (d, label) => `${label}, ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

    return [
      {
        slot_id: "slot-01",
        date: fmtDate(tomorrow),
        time: "09:00 - 10:00",
        display: fmtDisplay(tomorrow, "Ngày mai")
      },
      {
        slot_id: "slot-02",
        date: fmtDate(tomorrow),
        time: "14:30 - 15:30",
        display: fmtDisplay(tomorrow, "Ngày mai")
      },
      {
        slot_id: "slot-03",
        date: fmtDate(dayAfter),
        time: "10:00 - 11:00",
        display: fmtDisplay(dayAfter, "Ngày kia")
      }
    ];
  }

  // --- UNIFIED MY WORK ITEMS ---
  function getMyWorkItems(userId = null) {
    const currentUser = requireAuthenticatedUser();
    const targetUserId = userId || currentUser.user_id;
    const targetUser = getUserById(targetUserId);
    if (!targetUser) {
      throw new Error(`Không tìm thấy người dùng: ${targetUserId}`);
    }

    if (targetUserId !== currentUser.user_id) {
      const curRole = (currentUser.system_role || currentUser.role || "").toUpperCase();
      if (curRole === "EMPLOYEE" || curRole === "SYSTEM_ADMIN" || curRole === "HR") {
        throw new Error("Bạn không có quyền xem công việc của người dùng này.");
      } else if (curRole === "MANAGER" || curRole === "OPS_ADMIN") {
        const allowedDepts = new Set(currentUser.scope?.department_ids || [currentUser.department_id].filter(Boolean));
        if (!targetUser.department_id || !allowedDepts.has(targetUser.department_id)) {
          throw new Error("Bạn không có quyền xem công việc của người dùng này.");
        }
      } else {
        throw new Error("Bạn không có quyền xem công việc của người dùng này.");
      }
    }

    const items = [];

    // 1. Purchase requests
    const requests = getRequests().filter(r => r.requester_id === targetUserId);
    requests.forEach(r => {
      items.push({
        type: "Procurement",
        ref_id: r.id,
        title: `${r.quantity} × ${r.product_name}`,
        department: r.department_name,
        amount_str: formatVND(r.total_price),
        status: r.status,
        date: r.created_at,
        url: `request-detail.html?id=${r.id}`
      });
    });

    // 2. Expense claims
    const expenses = getExpenses().filter(e => e.requester_id === targetUserId);
    expenses.forEach(e => {
      items.push({
        type: "Expense",
        ref_id: e.id,
        title: `${e.category} — ${e.reason}`,
        department: e.department_name,
        amount_str: formatVND(e.amount),
        status: e.status,
        date: e.created_at,
        url: `expense-detail.html?id=${e.id}`
      });
    });

    // 3. Assigned Assets
    const assets = getAssets().filter(a => a.assigned_to === targetUserId);
    assets.forEach(a => {
      items.push({
        type: "Asset",
        ref_id: a.asset_id || a.id,
        title: `${a.device_name} (${a.serial_number})`,
        department: a.department_name,
        amount_str: "Thiết bị được cấp phát",
        status: a.status,
        date: a.last_updated || a.updated_at,
        url: `assets.html?search=${a.asset_id || a.id}`
      });
    });

    // 4. Meetings
    const meetings = getMeetings().filter(m =>
      m.organizer_id === targetUserId || isUserMeetingParticipant(targetUser, m)
    );
    meetings.forEach(m => {
      items.push({
        type: "Meeting",
        ref_id: m.id,
        title: m.topic,
        department: m.department_name,
        amount_str: `${m.attendees.length} thành viên`,
        status: m.status,
        date: m.date_time || m.time_slot,
        url: `meetings.html?id=${m.id}`
      });
    });

    // 5. Generated Documents
    const docs = getGeneratedDocuments().filter(d => d.creator_id === targetUserId);
    docs.forEach(d => {
      items.push({
        type: "Document",
        ref_id: d.id,
        title: d.title,
        department: d.department_name,
        amount_str: d.template_name,
        status: d.status,
        date: d.created_at,
        url: `forms.html?doc_id=${d.id}`
      });
    });

    return items;
  }

  // --- UNIFIED APPROVALS COUNT ---
  function getPendingApprovalsCount() {
    const user = getCurrentUser();
    if (!user) return 0;

    const prs = getRequests().filter(r => r.status === "PENDING_APPROVAL");
    const exps = getExpenses().filter(e => e.status === "PENDING_APPROVAL");

    const validPrs = prs.filter(r => canApprovePurchaseRequest(user.user_id, r).allowed);
    const validExps = exps.filter(e => canApproveExpenseClaim(user.user_id, e).allowed);

    return validPrs.length + validExps.length;
  }

  // --- Forms & Document Automation ---
  function getFormTemplates() {
    const fallback = typeof FORM_TEMPLATES !== "undefined" ? FORM_TEMPLATES : [];
    return getFromStorage(STORAGE_KEYS.FORM_TEMPLATES, fallback);
  }

  function getFormTemplateById(formId) {
    const templates = getFormTemplates();
    return templates.find(t => t.form_id === formId) || null;
  }

  function searchFormTemplates(query = "", category = "") {
    let templates = getFormTemplates();
    if (category && category !== "Tất cả") {
      templates = templates.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }
    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.form_id.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return templates;
  }

  function getGeneratedDocuments() {
    const fallback = typeof INITIAL_GENERATED_DOCUMENTS !== "undefined" ? INITIAL_GENERATED_DOCUMENTS : [];
    return getFromStorage(STORAGE_KEYS.GENERATED_DOCUMENTS, fallback);
  }

  function getDocumentById(docId) {
    const docs = getGeneratedDocuments();
    return docs.find(d => d.id === docId) || null;
  }

  const IMMUTABLE_DOCUMENT_FIELDS = [
    "id",
    "template_id",
    "template_name",
    "creator_id",
    "creator_name",
    "department_name",
    "related_workflow",
    "related_entity_id",
    "created_at"
  ];
  const MANAGED_WORKFLOW_FORM_IDS = ["FORM-HR-001", "FORM-PROC-001", "FORM-EXP-001"];

  function generateDocument({ formId, populatedData = {}, relatedWorkflow = "", relatedEntityId = null, title = null, customTitle = null }) {
    const currentUser = requireAuthenticatedUser();
    const template = getFormTemplateById(formId);
    if (!template) {
      throw new Error(`Không tìm thấy mẫu biểu mẫu: ${formId}`);
    }

    let workingData = { ...(populatedData || {}) };
    let resolvedEntityId = relatedEntityId;

    // 2A. FORM-PROC-001 GROUNDING
    if (formId === "FORM-PROC-001") {
      if (!resolvedEntityId && workingData.request_id) {
        resolvedEntityId = workingData.request_id;
      }
      if (!resolvedEntityId || !String(resolvedEntityId).trim()) {
        throw new Error("Tạo văn bản FORM-PROC-001 yêu cầu mã yêu cầu mua sắm hợp lệ (relatedEntityId).");
      }
      const request = getRequestById(resolvedEntityId);
      if (!request) {
        throw new Error(`Không tìm thấy yêu cầu mua sắm liên kết: ${resolvedEntityId}`);
      }

      if (currentUser.system_role === "EMPLOYEE" && request.requester_id !== currentUser.user_id) {
        throw new Error("Bạn không có quyền tạo văn bản cho yêu cầu mua sắm của nhân viên khác.");
      }
      if (!canViewPurchaseRequest(currentUser, request)) {
        throw new Error("Bạn không có quyền truy cập yêu cầu mua sắm này.");
      }

      const unitPriceVal = request.unit_price !== undefined ? request.unit_price : (request.total_price && request.quantity ? Math.round(request.total_price / request.quantity) : 0);
      const totalPriceVal = request.total_price !== undefined ? request.total_price : (request.estimated_cost || 0);

      workingData = {
        ...workingData,
        request_id: request.id,
        employee_name: request.requester_name,
        department: request.department_name,
        product_name: request.product_name || request.item_name || "",
        quantity: request.quantity,
        unit_price: unitPriceVal,
        total_price: totalPriceVal,
        reason: request.reason || request.business_justification || ""
      };
      resolvedEntityId = request.id;
      relatedWorkflow = relatedWorkflow || `Mua sắm / ${request.id}`;
    }

    // 2B. FORM-EXP-001 GROUNDING
    if (formId === "FORM-EXP-001") {
      if (!resolvedEntityId && workingData.claim_id) {
        resolvedEntityId = workingData.claim_id;
      }
      if (!resolvedEntityId || !String(resolvedEntityId).trim()) {
        throw new Error("Tạo văn bản FORM-EXP-001 yêu cầu mã hồ sơ chi phí hợp lệ (relatedEntityId).");
      }
      const claim = getExpenseById(resolvedEntityId);
      if (!claim) {
        throw new Error(`Không tìm thấy hồ sơ chi phí liên kết: ${resolvedEntityId}`);
      }

      if (currentUser.system_role === "EMPLOYEE" && claim.requester_id !== currentUser.user_id) {
        throw new Error("Bạn không có quyền tạo văn bản cho hồ sơ chi phí của nhân viên khác.");
      }
      if (!canViewExpenseClaim(currentUser, claim)) {
        throw new Error("Bạn không có quyền truy cập hồ sơ chi phí này.");
      }

      workingData = {
        ...workingData,
        claim_id: claim.id,
        employee_name: claim.requester_name,
        department: claim.department_name,
        category: claim.category,
        amount: claim.amount,
        expense_date: claim.expense_date,
        reason: claim.reason || claim.business_reason || "",
        receipt_ref: claim.receipt_filename || claim.receipt_url || claim.receipt_ref || "Đã kiểm tra chứng từ hợp lệ"
      };
      resolvedEntityId = claim.id;
      relatedWorkflow = relatedWorkflow || `Chi phí / ${claim.id}`;
    }

    // 2C. FORM-HR-001 GROUNDING
    if (formId === "FORM-HR-001") {
      let mgrName = "Trưởng phòng";
      if (currentUser.manager_id) {
        const mgr = getUserById(currentUser.manager_id);
        if (mgr && mgr.name) mgrName = mgr.name;
      } else if (currentUser.manager_name) {
        mgrName = currentUser.manager_name;
      }

      workingData = {
        ...workingData,
        employee_name: currentUser.name,
        employee_id: currentUser.user_id,
        department: currentUser.department_name || currentUser.department || "",
        job_title: currentUser.job_title || "",
        manager_name: mgrName
      };
    }

    // Required fields validation
    if (Array.isArray(template.required_fields) && template.required_fields.length > 0) {
      const missing = [];
      for (const field of template.required_fields) {
        const val = workingData ? workingData[field] : undefined;
        if (val === undefined || val === null || String(val).trim() === "") {
          missing.push(field);
        }
      }
      if (missing.length > 0) {
        throw new Error(`Chưa đủ dữ liệu bắt buộc để tạo văn bản: ${missing.join(", ")}`);
      }
    }

    // Fill content using nullish operator
    let filledContent = template.template_text;
    const keys = Object.keys(workingData || {});
    keys.forEach(k => {
      const regex = new RegExp(`{{${k}}}`, "g");
      const replaceVal = workingData[k] !== undefined && workingData[k] !== null ? String(workingData[k]) : "";
      filledContent = filledContent.replace(regex, replaceVal);
    });

    // Check for unresolved required placeholders
    if (Array.isArray(template.required_fields)) {
      for (const f of template.required_fields) {
        if (filledContent.includes(`{{${f}}}`)) {
          throw new Error(`Văn bản còn chứa trường bắt buộc chưa được giải quyết: {{${f}}}`);
        }
      }
    }

    // Clear optional unresolved placeholders
    filledContent = filledContent.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, "");

    const docs = getGeneratedDocuments();
    const numbers = docs.map(d => {
      const match = (d.id || "").match(/DOC-(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const newId = `DOC-${String(maxNum + 1).padStart(3, "0")}`;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    const resolvedTitle = title || customTitle || `${template.name} - ${currentUser.name}`;

    const newDoc = {
      id: newId,
      template_id: formId,
      template_name: template.name,
      title: resolvedTitle,
      creator_id: currentUser.user_id || currentUser.id,
      creator_name: currentUser.name,
      department_name: currentUser.department_name || currentUser.department || "N/A",
      related_workflow: relatedWorkflow || template.category,
      related_entity_id: resolvedEntityId || null,
      status: "DRAFT",
      created_at: timeStr,
      content: filledContent,
      data: workingData,
      email_draft: null
    };

    docs.unshift(newDoc);
    saveToStorage(STORAGE_KEYS.GENERATED_DOCUMENTS, docs);
    return newDoc;
  }

  function updateDocument(docId, updates) {
    requireAuthenticatedUser();
    const docs = getGeneratedDocuments();
    const doc = docs.find(d => d.id === docId);
    if (!doc) {
      throw new Error(`Không tìm thấy văn bản: ${docId}`);
    }
    throw new Error("Văn bản chính thức chỉ được cập nhật qua các quy trình nghiệp vụ đã xác thực.");
  }

  // Private workflow write. Never expose this helper through ProcuraStore.
  function _updateDocumentInternal(docId, updates) {
    const docs = getGeneratedDocuments();
    const idx = docs.findIndex(d => d.id === docId);
    if (idx === -1) throw new Error(`Không tìm thấy văn bản: ${docId}`);
    const targetDoc = { ...docs[idx], ...updates };
    docs[idx] = targetDoc;
    saveToStorage(STORAGE_KEYS.GENERATED_DOCUMENTS, docs);
    return targetDoc;
  }

  function createEmailDraft({ docId, to, subject, body, attachment }) {
    const currentUser = requireAuthenticatedUser();
    const doc = getDocumentById(docId);
    if (!doc) {
      throw new Error(`Không tìm thấy văn bản: ${docId}`);
    }

    if (currentUser.system_role !== "OPS_ADMIN" && doc.creator_id !== currentUser.user_id) {
      throw new Error("Bạn chỉ có thể tạo bản nháp email cho văn bản của chính mình.");
    }

    if (doc.status === "SENT" || (doc.email_draft && doc.email_draft.status === "SENT")) {
      throw new Error("Văn bản hoặc bản nháp email đã được gửi trước đó, không thể gửi lại hoặc tạo bản nháp mới.");
    }

    let recipient = null;

    if (MANAGED_WORKFLOW_FORM_IDS.includes(doc.template_id)) {
      const creator = getUserById(doc.creator_id);
      let managerEmail = null;
      if (creator && creator.manager_id) {
        const mgr = getUserById(creator.manager_id);
        if (mgr && mgr.email) managerEmail = mgr.email;
      }
      if (!managerEmail) {
        throw new Error("Không tìm thấy email của Quản lý trực tiếp trong sơ đồ tổ chức.");
      }
      if (to && String(to).trim() && String(to).trim().toLowerCase() !== managerEmail.toLowerCase()) {
        throw new Error("Không được phép thay đổi người nhận email cho các quy trình biểu mẫu nội bộ được quản lý.");
      }
      recipient = managerEmail;
    } else {
      recipient = to;
      if (!recipient) {
        const creator = getUserById(doc.creator_id);
        if (creator && creator.manager_id) {
          const mgr = getUserById(creator.manager_id);
          if (mgr && mgr.email) recipient = mgr.email;
        }
      }
    }

    if (!recipient || !String(recipient).trim()) {
      throw new Error("Địa chỉ email người nhận không được để trống.");
    }

    const resolvedSubject = (subject !== undefined && subject !== null ? String(subject).trim() : "") || `${doc.template_name} - ${doc.creator_name}`;
    if (!resolvedSubject) {
      throw new Error("Tiêu đề email không được để trống.");
    }

    const resolvedAttachment = attachment || `${doc.title.replace(/[\/\\]/g, "_")}.docx`;

    const draftId = "EML-" + String(Date.now()).slice(-4);
    const draft = {
      draft_id: draftId,
      to: recipient.trim(),
      subject: resolvedSubject,
      body: (body && String(body).trim()) ? body : `Kính gửi Quản lý,\n\nTôi xin gửi kèm văn bản ${doc.template_name} đề nghị được xem xét và phê duyệt.\n\nTrân trọng,\n${doc.creator_name}`,
      attachment: resolvedAttachment,
      status: "DRAFT",
      created_at: new Date().toISOString()
    };
    _updateDocumentInternal(docId, { email_draft: draft });
    return draft;
  }

  function sendEmailDraft(docId) {
    const currentUser = requireAuthenticatedUser();
    const doc = getDocumentById(docId);
    if (!doc || !doc.email_draft) {
      throw new Error(`Văn bản ${docId} chưa có bản nháp email.`);
    }

    if (currentUser.system_role !== "OPS_ADMIN" && doc.creator_id !== currentUser.user_id) {
      throw new Error("Bạn chỉ có thể gửi email cho văn bản của chính mình.");
    }

    if (doc.email_draft.status === "SENT" || doc.status === "SENT") {
      throw new Error("Bản nháp email đã được gửi trước đó, không thể gửi lại.");
    }

    if (!doc.email_draft.to || !doc.email_draft.to.trim()) {
      throw new Error("Bản nháp email thiếu địa chỉ người nhận.");
    }

    if (!doc.email_draft.subject || !doc.email_draft.subject.trim()) {
      throw new Error("Bản nháp email thiếu tiêu đề.");
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const updatedDraft = {
      ...doc.email_draft,
      status: "SENT",
      sent_at: timeStr
    };
    _updateDocumentInternal(docId, {
      email_draft: updatedDraft,
      status: "SENT"
    });
    return updatedDraft;
  }

  // --- Observability & Runs ---
  function getAgentRuns() {
    return getFromStorage(STORAGE_KEYS.RUNS, typeof INITIAL_AGENT_RUNS !== "undefined" ? INITIAL_AGENT_RUNS : []);
  }

  function logAgentRun(runData) {
    const runs = getAgentRuns();
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

    const newRun = {
      run_id: `RUN-${String(runs.length + 31).padStart(4, "0")}`,
      timestamp: timeStr,
      ...runData
    };
    runs.unshift(newRun);
    saveToStorage(STORAGE_KEYS.RUNS, runs);
    return newRun;
  }

  // --- Policies ---
  function getPolicies() {
    return getFromStorage(STORAGE_KEYS.POLICIES, typeof INITIAL_POLICIES !== "undefined" ? INITIAL_POLICIES : []);
  }

  init();

  return {
    formatVND,
    init,
    reset,
    resetToDefaults: reset,
    // Auth & Session & Identity Guards
    login,
    logout,
    isAuthenticated,
    getDemoSession,
    checkAuthOrRedirect,
    getRoleLabel,
    requireAuthenticatedUser,
    requireRole,
    requirePermission,
    requireDepartmentScope,
    requireApprovalLimit,
    switchDemoUser,
    // Users & Roles & Organization
    getCurrentUser,
    setCurrentUser,
    getUsers,
    getUserById,
    getDepartments,
    updateEmployeeOrganization,
    createEmployeeProfile,
    createUserAccount,
    setAccountStatus,
    activateUserAccount,
    disableUserAccount,
    updateUserAccess,
    assignSystemRole,
    updatePermissionScope,
    resetPasswordDemo,
    // Delegations & Authority Resolution
    getDelegations,
    isDelegationEffective,
    getActiveDelegationsForUser,
    createDelegation,
    revokeDelegation,
    resolveAuthorities,
    hasAuthorityForDepartment,
    // Permissions & Scope Authorization
    hasPermission,
    canApprovePurchaseRequest,
    canApproveExpenseClaim,
    // Visibility Helpers
    canViewPurchaseRequest,
    canViewExpenseClaim,
    canViewAsset,
    getVisibleAssetsForUser,
    canViewMeeting,
    isUserMeetingParticipant,
    canViewDocument,
    getVisibleDocumentsForCurrentUser,
    // Procurement
    getBudgets,
    getDepartmentBudget,
    deductDepartmentBudget,
    getProducts,
    getProductById,
    searchProducts,
    getRequests,
    getRequestById,
    getPurchaseRequests: getRequests,
    getPurchaseRequestById: getRequestById,
    createPurchaseRequest,
    submitPurchaseRequest,
    approvePurchaseRequest,
    rejectPurchaseRequest,
    // Assets
    getAssets,
    getAssetById,
    searchAssets,
    assignAsset,
    returnAsset,
    // Expenses
    getExpenses,
    getExpenseById,
    getExpenseClaims: getExpenses,
    getExpenseClaimById: getExpenseById,
    createExpenseClaim,
    submitExpenseClaim,
    approveExpenseClaim,
    rejectExpenseClaim,
    // Meetings & Systems
    getBusinessSystems,
    getSystemById,
    getMeetings,
    createMeeting,
    findCommonMeetingSlots,
    getMyWorkItems,
    getPendingApprovalsCount,
    // Forms & Document Automation
    getFormTemplates,
    getFormTemplateById,
    searchFormTemplates,
    getGeneratedDocuments,
    getDocumentById,
    generateDocument,
    updateDocument,
    createEmailDraft,
    sendEmailDraft,
    // Runs & Policies
    getAgentRuns,
    logAgentRun,
    getPolicies
  };
})();

if (typeof globalThis !== "undefined") {
  globalThis.ProcuraStore = ProcuraStore;
}
if (typeof window !== "undefined") {
  window.ProcuraStore = ProcuraStore;
}
export default ProcuraStore;
