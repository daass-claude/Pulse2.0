import { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';

export interface User {
  email: string;
  username?: string;
  name: string;
  role: 'admin' | 'employee';
  tz: 'PHT' | 'EST';
}

interface AuthContextType {
  user: User | null;
  login: (identifier: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;
}

const USERS: Array<User & { password: string }> = [
  // Admins
  { email: 'malka@pulse.app',        password: 'malka123',     name: 'Malka',        role: 'admin',    tz: 'EST' },
  { email: 'moshe@pulse.app',        password: 'moshe123',     name: 'Moshe',        role: 'admin',    tz: 'EST' },
  { email: 'julia@pulse.app',        password: 'julia123',     name: 'Julia',        role: 'admin',    tz: 'PHT' },
  { email: 'admin.guy@pulse.app',    username: '1',            password: '1',        name: 'Admin Guy',    role: 'admin',    tz: 'EST' },
  // Employees
  { email: 'christian@pulse.app',    password: 'christian123', name: 'Christian',    role: 'employee', tz: 'PHT' },
  { email: 'judy@pulse.app',         password: 'judy123',      name: 'Judy',         role: 'employee', tz: 'PHT' },
  { email: 'sandra@pulse.app',       password: 'sandra123',    name: 'Sandra',       role: 'employee', tz: 'PHT' },
  { email: 'gian@pulse.app',         password: 'gian123',      name: 'Gian',         role: 'employee', tz: 'PHT' },
  { email: 'richard@pulse.app',      password: 'richard123',   name: 'Richard',      role: 'employee', tz: 'PHT' },
  { email: 'employee.guy@pulse.app', username: '2',            password: '2',        name: 'Employee Guy', role: 'employee', tz: 'PHT' },
];

export const TEAM_MEMBERS: User[] = USERS.map(({ password: _pw, ...rest }) => rest);

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_KEY = 'pulse2_session';

function todayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getStoredUser(): User | null {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as User & { _date?: string };
    // Force re-login if the session is from a previous day (tab left open overnight)
    if (parsed._date !== todayKey()) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    // Re-validate against USERS so role/name changes take effect without re-login
    const current = USERS.find(u => u.email === parsed.email);
    if (!current) return null;
    const { password: _pw, ...userRecord } = current;
    return userRecord;
  } catch { return null; }
}

function getAutoLoginUser(): User | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('autologin');
    if (!token) return null;
    const t = token.trim().toLowerCase();
    const match = USERS.find(u =>
      u.name.toLowerCase() === t ||
      u.email.toLowerCase() === t ||
      u.username === token.trim()
    );
    if (!match) return null;
    const { password: _pw, ...userRecord } = match;
    saveSession(userRecord);
    // Remove the param from the URL so it doesn't persist on refresh
    const url = new URL(window.location.href);
    url.searchParams.delete('autologin');
    window.history.replaceState({}, '', url.toString());
    return userRecord;
  } catch { return null; }
}

function saveSession(userRecord: User) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...userRecord, _date: todayKey() }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser() ?? getAutoLoginUser());

  const login = async (identifier: string, password: string): Promise<boolean> => {
    const id = identifier.trim().toLowerCase();

    // Try Supabase RPC first — respects any password changes made in-app
    try {
      const { data, error } = await supabase.rpc('check_password', { p_email: id, p_password: password });
      if (!error && Array.isArray(data) && data.length > 0) {
        const u = data[0] as { email: string; name: string; role: string; tz: string; username?: string };
        const userRecord: User = { email: u.email, name: u.name, role: u.role as User['role'], tz: u.tz as User['tz'], username: u.username ?? undefined };
        setUser(userRecord);
        saveSession(userRecord);
        return true;
      }
    } catch { /* Supabase unavailable — fall through to local */ }

    // Fallback: hardcoded USERS + localStorage password overrides (set by changePassword)
    const match = USERS.find(u => u.email.toLowerCase() === id || u.username === identifier.trim());
    if (!match) return false;
    const overrides: Record<string, string> = JSON.parse(localStorage.getItem('pulse2_pw_overrides') || '{}');
    const currentPw = overrides[match.email] ?? match.password;
    if (currentPw !== password) return false;
    const { password: _pw, ...userRecord } = match;
    setUser(userRecord);
    saveSession(userRecord);
    return true;
  };

  const changePassword = async (oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> => {
    if (!user) return { ok: false, error: 'Not logged in.' };
    if (newPassword.trim().length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };

    // Try Supabase RPC
    try {
      const { data, error } = await supabase.rpc('change_password', {
        p_email: user.email,
        p_old_password: oldPassword,
        p_new_password: newPassword.trim(),
      });
      if (!error) {
        if (!data) return { ok: false, error: 'Current password is incorrect.' };
        // Mirror to localStorage so login fallback uses updated password immediately
        const overrides: Record<string, string> = JSON.parse(localStorage.getItem('pulse2_pw_overrides') || '{}');
        overrides[user.email] = newPassword.trim();
        localStorage.setItem('pulse2_pw_overrides', JSON.stringify(overrides));
        return { ok: true };
      }
    } catch { /* network/RPC unavailable — fall through to local */ }

    // Local fallback: verify old password against USERS + any prior override, save new one
    const overrides: Record<string, string> = JSON.parse(localStorage.getItem('pulse2_pw_overrides') || '{}');
    const hardcoded = USERS.find(u => u.email === user.email);
    const currentPw = overrides[user.email] ?? hardcoded?.password ?? '';
    if (currentPw !== oldPassword) return { ok: false, error: 'Current password is incorrect.' };
    overrides[user.email] = newPassword.trim();
    localStorage.setItem('pulse2_pw_overrides', JSON.stringify(overrides));
    return { ok: true };
  };

  const logout = () => {
    setUser(null);
    sessionStorage.removeItem(SESSION_KEY);
  };

  return <AuthContext.Provider value={{ user, login, logout, changePassword }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
