import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStore } from '../services/store';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { getStore().then(store => { setUser(store.getCurrentUser()); setReady(true); }); }, []);
  const refreshUser = useCallback(async()=>{const store=await getStore();setUser(store.getCurrentUser());},[]);
  useEffect(()=>{const refresh=()=>refreshUser();window.addEventListener('procura-role-switched',refresh);window.addEventListener('procura-state-changed',refresh);window.addEventListener('procura-store-reset',refresh);return()=>{window.removeEventListener('procura-role-switched',refresh);window.removeEventListener('procura-state-changed',refresh);window.removeEventListener('procura-store-reset',refresh)}},[refreshUser]);
  const login = useCallback(async(username,password)=>{const store=await getStore();const result=store.login(username,password);if(result.success)setUser(store.getCurrentUser());return result},[]);
  const logout = useCallback(async()=>{const store=await getStore();store.logout();setUser(null)},[]);
  const value = useMemo(() => ({ user, ready, isAuthenticated: Boolean(user), login, logout }), [user,ready,login,logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
