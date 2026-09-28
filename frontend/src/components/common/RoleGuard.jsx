import { Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStore } from '../../services/store';
export default function RoleGuard({roles,permissions=[],children}){const {user}=useAuth();const [effectivePermission,setEffectivePermission]=useState(false);const role=user?.system_role||user?.role;useEffect(()=>{let live=true;if(user&&permissions.length){getStore().then(store=>{const allowed=permissions.some(code=>store.resolveAuthorities(user.user_id,code).length>0);if(live)setEffectivePermission(allowed);});}else setEffectivePermission(false);return()=>{live=false}},[user?.user_id,user?.permissions,permissions.join('|')]);const allowed=roles.includes(role)||effectivePermission;const fallback=['HR','SYSTEM_ADMIN'].includes(role)?'/organization':'/agent';return allowed?children:<Navigate to={fallback} replace/>}
