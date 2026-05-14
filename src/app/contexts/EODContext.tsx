import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface TimeLogEntry {
  action: 'start' | 'pause';
  time: string;
}

export interface Task {
  id: string;
  status: 'In Progress' | 'Done';
  task: string;
  priority?: 'Urgent Today' | 'High' | 'Normal';
  elapsedTime: number;
  startTime: number | null;
  notes: string;
  relatedLinks: string;
  timeLog?: TimeLogEntry[];
}

export interface EODEntry {
  date: string;
  tasks: Task[];
  loginTime: string;
  logoutTime: string;
  totalHours: string;
  loomLink?: string;
}

export interface EmployeeEOD {
  employeeName: string;
  entries: EODEntry[];
}

interface EODContextType {
  employeeEODs: EmployeeEOD[];
  eodLoading: boolean;
  submitEOD: (
    employeeName: string,
    employeeEmail: string,
    tasks: Task[],
    loginTime: string,
    logoutTime: string,
    totalHours: string,
    loomLink?: string
  ) => Promise<void>;
  clearAllData: () => void;
}

const EODContext = createContext<EODContextType | undefined>(undefined);

const LS_KEY = 'pulse2_eods_v2';

function loadFromLocalStorage(): EmployeeEOD[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function saveToLocalStorage(data: EmployeeEOD[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function mergeSupabaseIntoLocal(local: EmployeeEOD[], rows: any[]): EmployeeEOD[] {
  const map = new Map<string, EODEntry[]>();
  // Seed with local data
  for (const emp of local) map.set(emp.employeeName, [...emp.entries]);
  // Merge Supabase rows
  for (const row of rows) {
    const entry: EODEntry = {
      date: row.date, tasks: row.tasks ?? [],
      loginTime: row.login_time, logoutTime: row.logout_time,
      totalHours: row.total_hours, loomLink: row.loom_link ?? undefined,
    };
    const key = row.employee_name;
    if (!map.has(key)) { map.set(key, [entry]); continue; }
    const existing = map.get(key)!;
    // Avoid duplicate dates
    if (!existing.some(e => e.date === entry.date && e.loginTime === entry.loginTime)) {
      existing.push(entry);
    }
  }
  return [...map.entries()].map(([employeeName, entries]) => ({ employeeName, entries }));
}

export function EODProvider({ children }: { children: ReactNode }) {
  const [employeeEODs, setEmployeeEODs] = useState<EmployeeEOD[]>(loadFromLocalStorage);
  const [eodLoading, setEodLoading] = useState(true);

  // On mount: load from localStorage immediately, then merge Supabase data
  useEffect(() => {
    supabase
      .from('eod_entries')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data?.length) {
          setEmployeeEODs(prev => {
            const merged = mergeSupabaseIntoLocal(prev, data);
            saveToLocalStorage(merged);
            return merged;
          });
        } else if (error) {
          console.warn('Supabase EOD load failed (using localStorage):', error.message);
        }
        setEodLoading(false);
      });
  }, []);

  const submitEOD = async (
    employeeName: string,
    employeeEmail: string,
    tasks: Task[],
    loginTime: string,
    logoutTime: string,
    totalHours: string,
    loomLink?: string
  ) => {
    const date = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: '2-digit',
    });

    const entry: EODEntry = { date, tasks, loginTime, logoutTime, totalHours, loomLink };

    // 1. Update local state — replace existing entry for same day, or append
    setEmployeeEODs(prev => {
      const idx = prev.findIndex(e => e.employeeName === employeeName);
      let next: EmployeeEOD[];
      if (idx >= 0) {
        const entries = [...prev[idx].entries];
        const dayIdx  = entries.findIndex(e => e.date === date);
        if (dayIdx >= 0) entries[dayIdx] = entry; else entries.push(entry);
        next = [...prev];
        next[idx] = { ...next[idx], entries };
      } else {
        next = [...prev, { employeeName, entries: [entry] }];
      }
      saveToLocalStorage(next);
      return next;
    });

    // 2. Upsert to Supabase — onConflict prevents duplicate rows for same employee+day
    supabase.from('eod_entries').upsert({
      employee_name: employeeName, employee_email: employeeEmail,
      date, login_time: loginTime, logout_time: logoutTime,
      total_hours: totalHours, loom_link: loomLink ?? null, tasks,
    }, { onConflict: 'employee_email,date' }).then(({ error }) => {
      if (error) console.warn('Supabase EOD sync failed (data saved locally):', error.message);
    });
  };

  const clearAllData = () => {
    setEmployeeEODs([]);
    localStorage.removeItem(LS_KEY);
  };

  return (
    <EODContext.Provider value={{ employeeEODs, eodLoading, submitEOD, clearAllData }}>
      {children}
    </EODContext.Provider>
  );
}

export function useEOD() {
  const ctx = useContext(EODContext);
  if (!ctx) throw new Error('useEOD must be used within EODProvider');
  return ctx;
}
