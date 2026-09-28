import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
export default function ProtectedRoute(){const {user,ready}=useAuth();if(!ready)return <div className="loading">Đang tải…</div>;return user?<Outlet/>:<Navigate to="/login" replace/>}
