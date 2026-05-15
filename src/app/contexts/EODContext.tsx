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

// Merge local + Supabase data. Supabase wins on same employee+date.
function mergeSupabaseIntoLocal(local: EmployeeEOD[], rows: any[]): EmployeeEOD[] {
  // Build map: employeeName → Map<date, EODEntry>
  const map = new Map<string, Map<string, EODEntry>>();

  for (const emp of local) {
    const dateMap = new Map<string, EODEntry>();
    for (const entry of emp.entries) dateMap.set(entry.date, entry);
    map.set(emp.employeeName, dateMap);
  }

  // Supabase rows overwrite local for the same date (Supabase is authoritative)
  for (const row of rows) {
    const entry: EODEntry = {
      date:       row.date,
      tasks:      row.tasks ?? [],
      loginTime:  row.login_time,
      logoutTime: row.logout_time,
      totalHours: row.total_hours,
      loomLink:   row.loom_link ?? undefined,
    };
    if (!map.has(row.employee_name)) map.set(row.employee_name, new Map());
    map.get(row.employee_name)!.set(entry.date, entry);
  }

  return [...map.entries()].map(([employeeName, dateMap]) => ({
    employeeName,
    entries: [...dateMap.values()],
  }));
}

export function EODProvider({ children }: { children: ReactNode }) {
  const [employeeEODs, setEmployeeEODs] = useState<EmployeeEOD[]>(loadFromLocalStorage);
  const [eodLoading, setEodLoading] = useState(true);

  // On mount: load localStorage immediately, then fetch Supabase and merge.
  // Supabase is the source of truth — data persists even if localStorage is cleared.
  useEffect(() => {
    supabase
      .from('eod_entries')
      .select('*')
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) {
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

    // 2. Upsert to Supabase — permanent record, safe to re-submit same day
    const { error } = await supabase.from('eod_entries').upsert({
      employee_name:  employeeName,
      employee_email: employeeEmail,
      date,
      login_time:     loginTime,
      logout_time:    logoutTime,
      total_hours:    totalHours,
      loom_link:      loomLink ?? null,
      tasks,
    }, { onConflict: 'employee_email,date' });

    if (error) console.warn('Supabase EOD sync failed (data saved locally):', error.message);
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
