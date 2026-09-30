import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStore } from '../services/store';
import { backendAuth, backendToken } from '../services/backendApi';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const combineUser = (demoUser, backendUser) => {
    const role = backendUser?.system_role || backendUser?.role || demoUser?.system_role;
    return { ...demoUser, ...backendUser, role, system_role: role };
  };
  useEffect(() => {
    let live = true;
    (async () => {
      const store = await getStore();
      if (!backendToken.get()) { store.logout(); if (live) { setUser(null); setReady(true); } return; }
      try {
        const result = await backendAuth.me();
        const backendUser = result?.user || result;
        const demoUser = store.getCurrentUser();
        if (!backendUser?.user_id || demoUser?.user_id !== backendUser.user_id) throw new Error('Phiên đăng nhập không khớp.');
        if (live) setUser(combineUser(demoUser, backendUser));
      } catch {
        backendToken.clear();
        store.logout();
        if (live) setUser(null);
      } finally { if (live) setReady(true); }
    })();
    return () => { live = false; };
  }, []);
  const refreshUser = useCallback(async()=>{const store=await getStore();setUser(current => {
    if (!current || !backendToken.get()) return null;
    if (store.getCurrentUser()?.user_id !== current.user_id) { backendToken.clear(); return null; }
    return combineUser(store.getCurrentUser(), current);
  });},[]);
  useEffect(()=>{const refresh=()=>refreshUser();window.addEventListener('procura-role-switched',refresh);window.addEventListener('procura-state-changed',refresh);window.addEventListener('procura-store-reset',refresh);return()=>{window.removeEventListener('procura-role-switched',refresh);window.removeEventListener('procura-state-changed',refresh);window.removeEventListener('procura-store-reset',refresh)}},[refreshUser]);
  const login = useCallback(async(username,password)=>{
    try {
      const backendUser = await backendAuth.login(username,password);
      const store = await getStore();
      const result = store.login(username,password);
      if (!result.success || store.getCurrentUser()?.user_id !== backendUser.user_id) {
        await backendAuth.logout();
        return { success:false, error:'Tài khoản chưa được đồng bộ với giao diện demo.' };
      }
      setUser(combineUser(store.getCurrentUser(),backendUser));
      return { success:true };
    } catch (error) { backendToken.clear(); return { success:false, error:error.message }; }
  },[]);
  const logout = useCallback(async()=>{const store=await getStore();try { await backendAuth.logout(); } finally { store.logout();setUser(null); }},[]);
  const value = useMemo(() => ({ user, ready, isAuthenticated: Boolean(user), login, logout }), [user,ready,login,logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
