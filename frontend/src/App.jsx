import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/common/ProtectedRoute';
import RoleGuard from './components/common/RoleGuard';
import OrganizationPage from './pages/OrganizationPage';
import AgentPage from './pages/AgentPage';
import { ProcurementPage, ProcurementDetailPage, ApprovalsPage, CataloguePage } from './pages/ProcurementPages';
import {
  LoginPage, MyWorkPage,
  ExpensesPage, ExpenseDetailPage, AssetsPage, MeetingsPage, FormsPage,
  PoliciesPage, ActivityPage
} from './pages/Pages';

const operationsRoles = ['EMPLOYEE', 'MANAGER', 'OPS_ADMIN'];
const procurementRoles = ['EMPLOYEE', 'MANAGER'];
const documentRoles = ['EMPLOYEE', 'MANAGER', 'HR', 'OPS_ADMIN'];
function Guarded({ roles, children }) { return <RoleGuard roles={roles}>{children}</RoleGuard>; }
function Index() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="loading">Đang tải…</div>;
  if (!user) return <Navigate to="/login" replace/>;
  if (['HR', 'SYSTEM_ADMIN'].includes(user.system_role)) return <Navigate to="/organization" replace/>;
  return <Navigate to="/agent" replace/>;
}

export default function App() {
  return <AuthProvider><BrowserRouter><Routes>
    <Route path="/" element={<Index/>}/>
    <Route path="/login" element={<LoginPage/>}/>
    <Route element={<ProtectedRoute/>}><Route element={<AppLayout/>}>
      <Route path="agent" element={<Guarded roles={operationsRoles}><AgentPage/></Guarded>}/>
      <Route path="my-work" element={<Guarded roles={operationsRoles}><MyWorkPage/></Guarded>}/>
      <Route path="procurement" element={<Guarded roles={procurementRoles}><ProcurementPage/></Guarded>}/>
      <Route path="procurement/:id" element={<Guarded roles={procurementRoles}><ProcurementDetailPage/></Guarded>}/>
      <Route path="expenses" element={<Guarded roles={operationsRoles}><ExpensesPage/></Guarded>}/>
      <Route path="expenses/:id" element={<Guarded roles={operationsRoles}><ExpenseDetailPage/></Guarded>}/>
      <Route path="assets" element={<Guarded roles={operationsRoles}><AssetsPage/></Guarded>}/>
      <Route path="meetings" element={<Guarded roles={operationsRoles}><MeetingsPage/></Guarded>}/>
      <Route path="forms" element={<Guarded roles={documentRoles}><FormsPage/></Guarded>}/>
      <Route path="policies" element={<Guarded roles={documentRoles}><PoliciesPage/></Guarded>}/>
      <Route path="approvals" element={<RoleGuard roles={['MANAGER','OPS_ADMIN']} permissions={['APPROVE_PROCUREMENT','APPROVE_EXPENSE']}><ApprovalsPage/></RoleGuard>}/>
      <Route path="organization" element={<RoleGuard roles={['HR','OPS_ADMIN','SYSTEM_ADMIN']} permissions={['MANAGE_ACCESS','MANAGE_ACCOUNTS','MANAGE_EMPLOYEE_PROFILE']}><OrganizationPage/></RoleGuard>}/>
      <Route path="catalogue" element={<Guarded roles={procurementRoles}><CataloguePage/></Guarded>}/>
      <Route path="activity" element={<Guarded roles={['OPS_ADMIN','SYSTEM_ADMIN']}><ActivityPage/></Guarded>}/>
    </Route></Route>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></BrowserRouter></AuthProvider>;
}
