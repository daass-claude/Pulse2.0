import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Trash2, Plus, Video, Clock, Play, Pause, Zap, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useEOD, type Task } from '../contexts/EODContext';
import { SODModal } from '../components/SODModal';
import { FinalizeEODModal } from '../components/FinalizeEODModal';
import { getDailyDateKey } from '../lib/gratitudePrompts';
import { supabase } from '../../lib/supabase';

function formatTime(s: number) {
  const h   = Math.floor(s / 3600).toString().padStart(2, '0');
  const m   = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  const sec = (s % 60).toString().padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function nowTimeStr(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function hasDoneSODThisSession(email: string): boolean {
  return sessionStorage.getItem(`pulse2_sod_session_${email}`) === '1';
}

async function pushLiveStatus(email: string, status: string, currentTask: string) {
  await supabase.from('live_status').upsert(
    { email, status, current_task: currentTask, updated_at: new Date().toISOString() },
    { onConflict: 'email' }
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const { submitEOD, employeeEODs } = useEOD();

  const [showSOD, setShowSOD] = useState(() =>
    user ? !hasDoneSODThisSession(user.email) : false
  );

  const [userTz, setUserTz] = useState<'PHT' | 'EST'>(() =>
    (localStorage.getItem(`pulse2_tz_${user?.email}`) ?? user?.tz ?? 'PHT') as 'PHT' | 'EST'
  );

  const [tasks, setTasks] = useState<Task[]>(() => {
    try { return JSON.parse(localStorage.getItem(`pulse2_tasks_${user?.email}`) || '[]'); } catch { return []; }
  });
  const [isLunch, setIsLunch] = useState(() => localStorage.getItem(`pulse2_lunch_${user?.email}`) === '1');
  const [lunchStartTime, setLunchStartTime] = useState<number | null>(() => {
    const s = localStorage.getItem(`pulse2_lunch_start_${user?.email}`);
    return s ? parseInt(s, 10) : null;
  });
  const [loomLink, setLoomLink] = useState(() => localStorage.getItem(`pulse2_loom_${user?.email}`) || '');
  const [loginTime] = useState(() =>
    localStorage.getItem(`pulse2_login_time_${user?.email}`) ||
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  );
  const [now, setNow] = useState(new Date());

  // ── Refs ────────────────────────────────────────────────
  // prevLiveRef: only push live_status to DB when status or task name actually changes
  const prevLiveRef     = useRef<{ status: string; task: string } | null>(null);
  // Current-value refs for use in intervals/callbacks without stale closures
  const tasksRef        = useRef(tasks);
  const loomRef         = useRef(loomLink);
  const isLunchRef      = useRef(isLunch);
  const routineInputRef = useRef<HTMLInputElement>(null);
  // Tracks whether SOD has been completed this session — prevents syncLiveStatus
  // from overwriting the "Online" push with "Offline" when task list is empty
  const sodDoneRef = useRef(!showSOD);

  // Keep refs in sync with state
  useEffect(() => { tasksRef.current  = tasks;    }, [tasks]);
  useEffect(() => { loomRef.current   = loomLink; }, [loomLink]);
  useEffect(() => { isLunchRef.current = isLunch; }, [isLunch]);

  // ── localStorage mirrors ─────────────────────────────────
  useEffect(() => { if (user?.email) localStorage.setItem(`pulse2_login_time_${user.email}`, loginTime); }, [loginTime, user?.email]);
  useEffect(() => { if (user?.email) localStorage.setItem(`pulse2_tasks_${user.email}`, JSON.stringify(tasks)); }, [tasks, user?.email]);
  useEffect(() => { if (user?.email) localStorage.setItem(`pulse2_loom_${user.email}`, loomLink); }, [loomLink, user?.email]);

  // Offline on tab/browser close or app background; re-publish Online on return
  useEffect(() => {
    if (!user?.email) return;
    const email = user.email;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const offlinePayload = () => JSON.stringify({
      email, status: 'Offline', current_task: '', updated_at: new Date().toISOString(),
    });

    const fetchOffline = () => fetch(`${supabaseUrl}/rest/v1/live_status`, {
      method: 'POST', keepalive: true,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: offlinePayload(),
    });

    // Tab/window close → immediate Offline
    const handleBeforeUnload = () => fetchOffline();

    // Phone/tablet: re-publish current status when the app comes back to foreground
    let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Delay Offline by 60s — covers brief tab switches without false Offline flicker
        hiddenTimer = setTimeout(() => fetchOffline(), 60_000);
      } else {
        // App is visible again — cancel pending Offline and re-publish real status
        if (hiddenTimer) { clearTimeout(hiddenTimer); hiddenTimer = null; }
        const inProgress = tasksRef.current.find(t => t.status === 'In Progress');
        const status = inProgress ? 'Working' : isLunchRef.current ? 'Lunch' : sodDoneRef.current ? 'Online' : 'Offline';
        prevLiveRef.current = null; // bypass dedup so push always fires
        pushLiveStatus(email, status, inProgress?.task || '');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (hiddenTimer) clearTimeout(hiddenTimer);
    };
  }, [user?.email]);
  useEffect(() => {
    if (!user) return;
    localStorage.setItem(`pulse2_lunch_${user.email}`, isLunch ? '1' : '0');
  }, [isLunch, user]);

  // ── Live status sync ─────────────────────────────────────
  // Only hits Supabase when status or task name actually changes — not on every elapsed-time tick
  const syncLiveStatus = useCallback((taskList: Task[], lunch: boolean) => {
    if (!user) return;
    const inProgress = taskList.find(t => t.status === 'In Progress');
    const liveStatus = inProgress ? 'Working' : lunch ? 'Lunch' : sodDoneRef.current ? 'Online' : 'Offline';
    const liveTask   = inProgress?.task || '';
    localStorage.setItem(`pulse2_live_status_${user.email}`, liveStatus);
    localStorage.setItem(`pulse2_live_task_${user.email}`, liveTask);
    if (prevLiveRef.current?.status === liveStatus && prevLiveRef.current?.task === liveTask) return;
    prevLiveRef.current = { status: liveStatus, task: liveTask };
    pushLiveStatus(user.email, liveStatus, liveTask);
  }, [user]);

  useEffect(() => { syncLiveStatus(tasks, isLunch); }, [tasks, isLunch, syncLiveStatus]);

  // ── Live status heartbeat ────────────────────────────────
  // Force-push every 45 min so updated_at stays fresh.
  // Without this, the 10-hour stale check on Team tab would
  // eventually show an active user as Offline.
  useEffect(() => {
    if (!user || showSOD) return;
    const beat = setInterval(() => {
      const inProgress = tasksRef.current.find(t => t.status === 'In Progress');
      const status = inProgress ? 'Working' : isLunchRef.current ? 'Lunch' : sodDoneRef.current ? 'Online' : 'Offline';
      const task   = inProgress?.task || '';
      prevLiveRef.current = null; // reset dedup so next syncLiveStatus also fires
      pushLiveStatus(user.email, status, task);
    }, 45 * 60 * 1000);
    return () => clearInterval(beat);
  }, [user, showSOD]);

  // ── daily_tasks sync ─────────────────────────────────────
  // Upserts the current session state so it survives page refresh / browser crash
  const syncDailyNow = useCallback(() => {
    if (!user) return;
    supabase.from('daily_tasks').upsert({
      email: user.email,
      tasks:      tasksRef.current,
      loom_link:  loomRef.current,
      login_time: loginTime,
      is_lunch:   isLunchRef.current,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' }).then(({ error }) => {
      if (error) console.warn('daily_tasks sync failed:', error.message);
    });
  }, [user, loginTime]);

  // Periodic backup every 30 seconds (captures elapsed-time changes without spamming)
  useEffect(() => {
    if (!user || showSOD) return;
    const interval = setInterval(syncDailyNow, 30_000);
    return () => clearInterval(interval);
  }, [user, showSOD, syncDailyNow]);

  // Restore tasks from daily_tasks on mount if localStorage is empty (e.g. cache cleared)
  useEffect(() => {
    if (!user || showSOD) return;
    const localTasks: Task[] = JSON.parse(localStorage.getItem(`pulse2_tasks_${user.email}`) || '[]');
    if (localTasks.length > 0) return;
    supabase.from('daily_tasks')
      .select('tasks, loom_link, updated_at')
      .eq('email', user.email)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (new Date(data.updated_at).toDateString() !== new Date().toDateString()) return;
        if ((data.tasks as Task[])?.length > 0) setTasks(data.tasks as Task[]);
        if (data.loom_link) setLoomLink(data.loom_link);
      });
  }, [user, showSOD]);

  // ── Clocks & timers ──────────────────────────────────────
  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);
  useEffect(() => {
    const timer = setInterval(() => {
      setTasks(prev => prev.map(t =>
        t.status === 'In Progress' && t.startTime ? { ...t, elapsedTime: t.elapsedTime + 1 } : t
      ));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pht = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Manila' });
  const est = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });

  // ── Task handlers ────────────────────────────────────────
  const addTask = () => {
    const ts = nowTimeStr();
    setIsLunch(false);
    const newTask: Task = { id: Date.now().toString(), status: 'In Progress', task: '', elapsedTime: 0, startTime: Date.now(), notes: '', relatedLinks: '', timeLog: [{ action: 'start', time: ts }] };
    setTasks(prev => {
      const updated = [newTask, ...prev.map(t => ({
        ...t, status: 'Done' as const, startTime: null,
        timeLog: t.status === 'In Progress' ? [...(t.timeLog ?? []), { action: 'pause' as const, time: ts }] : (t.timeLog ?? []),
      }))];
      tasksRef.current = updated;
      return updated;
    });
    syncDailyNow();
  };

  const removeTask = (id: string) => {
    setTasks(prev => {
      const updated = prev.filter(t => t.id !== id);
      tasksRef.current = updated;
      return updated;
    });
    syncDailyNow();
  };

  const toggleStatus = (id: string) => {
    const ts = nowTimeStr();
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        if (t.status === 'In Progress') return { ...t, status: 'Done' as const, startTime: null, timeLog: [...(t.timeLog ?? []), { action: 'pause' as const, time: ts }] };
        return { ...t, status: 'In Progress' as const, startTime: Date.now(), timeLog: [...(t.timeLog ?? []), { action: 'start' as const, time: ts }] };
      }
      if (t.status === 'In Progress') return { ...t, status: 'Done' as const, startTime: null, timeLog: [...(t.timeLog ?? []), { action: 'pause' as const, time: ts }] };
      return t;
    }));
  };

  const updateField = (id: string, field: keyof Pick<Task, 'task' | 'relatedLinks' | 'notes'>, value: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));

  const lunchElapsed = isLunch && lunchStartTime
    ? Math.floor((now.getTime() - lunchStartTime) / 1000)
    : 0;

  const pauseAll = () => {
    const ts = Date.now();
    const timeStr = nowTimeStr();
    setIsLunch(true);
    isLunchRef.current = true;
    setLunchStartTime(ts);
    if (user) localStorage.setItem(`pulse2_lunch_start_${user.email}`, ts.toString());
    setTasks(prev => {
      const updated = prev.map(t => ({
        ...t, status: 'Done' as const, startTime: null,
        timeLog: t.status === 'In Progress' ? [...(t.timeLog ?? []), { action: 'pause' as const, time: timeStr }] : (t.timeLog ?? []),
      }));
      tasksRef.current = updated;
      return updated;
    });
    syncDailyNow();
  };

  const resumeWork = () => {
    setIsLunch(false);
    isLunchRef.current = false;
    setLunchStartTime(null);
    if (user) localStorage.removeItem(`pulse2_lunch_start_${user.email}`);
    syncDailyNow();
  };

  const [showFinalize, setShowFinalize] = useState(false);
  const [finalizeLogoutTime, setFinalizeLogoutTime] = useState('');

  const handleFinalizeClick = () => {
    if (!tasks.length) { alert('No tasks to submit.'); return; }
    setFinalizeLogoutTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }));
    setShowFinalize(true);
  };

  const handleEODConfirm = async (finalTasks: Task[], finalLoom: string) => {
    setShowFinalize(false);
    const totalSec = finalTasks.reduce((sum, t) => sum + t.elapsedTime, 0);
    const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
    await submitEOD(user!.name, user!.email, finalTasks, loginTime, finalizeLogoutTime, `${h}:${m}`, finalLoom || undefined);
    supabase.from('daily_tasks').delete().eq('email', user!.email)
      .then(({ error }) => { if (error) console.warn('Failed to clear daily_tasks:', error.message); });
    setIsLunch(false);
    setLunchStartTime(null);
    setTasks([]); setLoomLink('');
    localStorage.removeItem(`pulse2_tasks_${user!.email}`);
    localStorage.removeItem(`pulse2_loom_${user!.email}`);
    localStorage.removeItem(`pulse2_login_time_${user!.email}`);
    if (user) localStorage.removeItem(`pulse2_lunch_start_${user.email}`);
    await pushLiveStatus(user!.email, 'Offline', '');
  };

  // ── Routine / Quick-start tasks ─────────────────────────
  const [routines, setRoutines] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`pulse2_routines_${user?.email}`) || '[]'); } catch { return []; }
  });
  const [newRoutine, setNewRoutine]         = useState('');
  const [showAddRoutine, setShowAddRoutine] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('routine_tasks')
      .select('name, created_at')
      .eq('user_email', user.email)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!data?.length) return;
        setRoutines(prev => {
          const merged = [...new Set([...prev, ...data.map((r: { name: string }) => r.name)])];
          localStorage.setItem(`pulse2_routines_${user.email}`, JSON.stringify(merged));
          return merged;
        });
      });
  }, [user]);

  useEffect(() => {
    if (showAddRoutine) setTimeout(() => routineInputRef.current?.focus(), 50);
  }, [showAddRoutine]);

  const saveRoutines = (updated: string[]) => {
    setRoutines(updated);
    localStorage.setItem(`pulse2_routines_${user!.email}`, JSON.stringify(updated));
  };

  const addRoutine = async () => {
    const name = newRoutine.trim();
    if (!name || routines.includes(name)) { setNewRoutine(''); setShowAddRoutine(false); return; }
    const updated = [...routines, name];
    saveRoutines(updated);
    setNewRoutine(''); setShowAddRoutine(false);
    supabase.from('routine_tasks').insert({ user_email: user!.email, name })
      .then(({ error }) => { if (error) console.warn('Routine sync failed:', error.message); });
  };

  const removeRoutine = async (name: string) => {
    saveRoutines(routines.filter(r => r !== name));
    supabase.from('routine_tasks').delete().eq('user_email', user!.email).eq('name', name)
      .then(({ error }) => { if (error) console.warn('Routine delete failed:', error.message); });
  };

  const startRoutineTask = (name: string) => {
    const ts = nowTimeStr();
    setIsLunch(false);
    const newTask: Task = { id: Date.now().toString(), status: 'In Progress', task: name, elapsedTime: 0, startTime: Date.now(), notes: '', relatedLinks: '', timeLog: [{ action: 'start', time: ts }] };
    setTasks(prev => {
      const updated = [newTask, ...prev.map(t => ({
        ...t, status: 'Done' as const, startTime: null,
        timeLog: t.status === 'In Progress' ? [...(t.timeLog ?? []), { action: 'pause' as const, time: ts }] : (t.timeLog ?? []),
      }))];
      tasksRef.current = updated;
      return updated;
    });
    syncDailyNow();
  };

  const inProgressTask = tasks.find(t => t.status === 'In Progress');

  const reminderVisible = useMemo(() => {
    const tzStr = userTz === 'PHT' ? 'Asia/Manila' : 'America/New_York';
    const hour = parseInt(now.toLocaleTimeString('en-US', { hour: 'numeric', hour12: false, timeZone: tzStr }), 10);
    const todayDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: '2-digit' });
    const hasSubmittedToday = employeeEODs.find(e => e.employeeName === user?.name)?.entries.some(e => e.date === todayDate) ?? false;
    return hour >= 17 && !hasSubmittedToday && !showSOD;
  }, [now, userTz, employeeEODs, user?.name, showSOD]);

  return (
    <>
      {showSOD && <SODModal onComplete={() => {
        sodDoneRef.current = true;
        setShowSOD(false);
        const tz = (localStorage.getItem(`pulse2_tz_${user?.email}`) ?? user?.tz ?? 'PHT') as 'PHT' | 'EST';
        setUserTz(tz);
        if (user) pushLiveStatus(user.email, 'Online', '');
      }} />}

      {showFinalize && (
        <FinalizeEODModal
          tasks={tasks}
          loomLink={loomLink}
          loginTime={loginTime}
          logoutTime={finalizeLogoutTime}
          onConfirm={handleEODConfirm}
          onCancel={() => setShowFinalize(false)}
        />
      )}

      {/* ── Lunch break overlay ─────────────────────────── */}
      {isLunch && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'var(--bg-overlay)',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="animate-fade-in glass-card" style={{
            borderRadius: '16px', padding: '48px 56px', textAlign: 'center',
            background: 'linear-gradient(135deg, var(--bg-card), var(--bg-surface))',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
          }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
              On Break
            </div>
            <div style={{ fontSize: '44px', fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', letterSpacing: '0.04em', marginBottom: '8px', lineHeight: 1 }}>
              {formatTime(lunchElapsed)}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '36px' }}>
              Your tasks are paused.
            </div>
            <button
              onClick={resumeWork}
              className="ghost-btn"
              style={{ padding: '11px 36px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Resume Work
            </button>
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: 'var(--page-bg-gradient)',
      }}>

        {/* ── Centered Greeting ───────────────────────────── */}
        <div style={{ padding: '40px 40px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {getGreeting()}
          </div>
          <div style={{ fontSize: '34px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', lineHeight: 1, marginBottom: '14px' }}>
            <span className="gold-text">{user?.name?.toUpperCase()}</span>
          </div>
          {/* Split PHT / EST capsule */}
          <div style={{ display: 'inline-flex', borderRadius: '24px', border: '1px solid var(--border-gold)', overflow: 'hidden' }}>
            {(['PHT', 'EST'] as const).map((tz, i) => {
              const isActive = userTz === tz;
              const time     = tz === 'PHT' ? pht : est;
              return (
                <div key={tz} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 20px',
                  background: isActive ? 'rgba(232,201,141,0.10)' : 'rgba(255,255,255,0.015)',
                  borderRight: i === 0 ? '1px solid var(--border-gold)' : 'none',
                  transition: 'background 0.3s ease',
                }}>
                  {isActive && (
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 5px rgba(201,169,110,0.5)', flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: isActive ? 'var(--gold)' : 'var(--text-muted)', opacity: isActive ? 1 : 0.45 }}>
                    {tz}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', opacity: isActive ? 1 : 0.35 }}>
                    {time}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 40px 32px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Active task banner */}
            {inProgressTask && (
              <div className="animate-fade-in" style={{
                padding: '13px 18px', borderRadius: '12px',
                background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--status-working)', boxShadow: '0 0 8px var(--status-working)', flexShrink: 0 }} className="animate-pulse-glow" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--status-working)', fontWeight: 600 }}>
                    {inProgressTask.task || 'Unnamed task'}
                  </div>
                  {(inProgressTask.timeLog?.length ?? 0) > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--status-working)', opacity: 0.65, marginTop: '1px' }}>
                      Started {[...(inProgressTask.timeLog ?? [])].reverse().find(l => l.action === 'start')?.time}
                    </div>
                  )}
                </div>
                <Clock size={13} style={{ color: 'var(--status-working)', opacity: 0.7 }} />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--status-working)', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(inProgressTask.elapsedTime)}
                </span>
              </div>
            )}

            {/* EOD due reminder */}
            {reminderVisible && (
              <div className="animate-fade-in" style={{
                padding: '13px 18px', borderRadius: '12px',
                background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.22)',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--status-lunch)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--status-lunch)', fontWeight: 600 }}>
                    EOD reminder — it's past 5:00 PM
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--status-lunch)', opacity: 0.65, marginTop: '1px' }}>
                    Don't forget to submit your End-of-Day report before logging off.
                  </div>
                </div>
                <button
                  onClick={handleFinalizeClick}
                  style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '11px', fontWeight: 700, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.35)', color: 'var(--status-lunch)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Finalize Now
                </button>
              </div>
            )}

            {/* Quick-start task shortcuts */}
            <div className="glass-card" style={{ borderRadius: '12px', padding: '16px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: routines.length || showAddRoutine ? '12px' : '0' }}>
                <Zap size={13} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase', flex: 1 }}>
                  Quick Start
                </span>
                <button
                  onClick={() => setShowAddRoutine(s => !s)}
                  title="Add shortcut"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: 'rgba(232,201,141,0.07)', border: '1px solid var(--border-gold)', color: 'var(--gold)', transition: 'all 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,201,141,0.14)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(232,201,141,0.07)')}
                >
                  <Plus size={11} /> Add Shortcut
                </button>
              </div>

              {(routines.length > 0 || showAddRoutine) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                  {routines.map(name => (
                    <div key={name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0', borderRadius: '20px', overflow: 'hidden', border: '1px solid var(--border-gold)', background: 'rgba(232,201,141,0.05)' }}>
                      <button
                        onClick={() => startRoutineTask(name)}
                        style={{ padding: '5px 12px', fontSize: '12px', fontWeight: 600, color: 'var(--gold)', background: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.03em', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,201,141,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        title={`Start: ${name}`}
                      >
                        {name}
                      </button>
                      <button
                        onClick={() => removeRoutine(name)}
                        title="Remove shortcut"
                        style={{ padding: '5px 8px 5px 4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}

                  {showAddRoutine && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderRadius: '20px', border: '1px solid var(--border-gold)', background: 'rgba(232,201,141,0.07)', padding: '3px 6px 3px 12px' }}>
                      <input
                        ref={routineInputRef}
                        type="text"
                        value={newRoutine}
                        onChange={e => setNewRoutine(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addRoutine(); if (e.key === 'Escape') { setShowAddRoutine(false); setNewRoutine(''); } }}
                        placeholder="Task name…"
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '12px', fontFamily: 'var(--font)', width: '130px' }}
                      />
                      <button
                        onClick={addRoutine}
                        style={{ padding: '3px 8px', borderRadius: '14px', fontSize: '11px', fontWeight: 700, background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dark))', border: 'none', color: '#090B0E', cursor: 'pointer' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setShowAddRoutine(false); setNewRoutine(''); }}
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '2px' }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}

                  {routines.length === 0 && !showAddRoutine && (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No shortcuts yet. Add one above.</span>
                  )}
                </div>
              )}

              {routines.length === 0 && !showAddRoutine && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                  Save recurring task names as shortcuts. Click to instantly start them.
                </p>
              )}
            </div>

            {/* Loom link */}
            <div className="glass-card" style={{ borderRadius: '12px', padding: '18px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '10px' }}>
                <Video size={14} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Today's Loom Recording
                </span>
                {loomLink && <span style={{ fontSize: '11px', color: 'var(--status-working)', marginLeft: 'auto' }}>● Linked</span>}
              </div>
              <input
                type="url" value={loomLink} onChange={e => setLoomLink(e.target.value)}
                placeholder="Paste your Loom share URL, e.g. https://www.loom.com/share/..."
                className="field-input"
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', fontSize: '13px' }}
              />
            </div>

            {/* Task table */}
            <div className="glass-card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '15px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Task Tracker
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Status', 'Prio', 'Task', 'Related Links', 'Time', 'Notes', ''].map(h => (
                      <th key={h} style={{ padding: '9px 14px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                        No tasks yet. Click <strong style={{ color: 'var(--gold)' }}>Add Task</strong> to begin.
                      </td>
                    </tr>
                  )}
                  {tasks.map(task => (
                    <tr key={task.id} className="table-row" style={{ borderBottom: '1px solid var(--border)', background: task.status === 'In Progress' ? 'rgba(74,222,128,0.025)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px', minWidth: '120px' }}>
                        <button onClick={() => toggleStatus(task.id)} style={{
                          display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: 'none',
                          ...(task.status === 'In Progress' ? { background: 'rgba(74,222,128,0.14)', color: 'var(--status-working)' } : { background: 'rgba(100,116,139,0.14)', color: 'var(--text-muted)' }),
                        }}>
                          {task.status === 'In Progress' ? <><Pause size={10} /> In Progress</> : <><Play size={10} /> Done</>}
                        </button>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <select
                          value={task.priority || ''}
                          onChange={e => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority: (e.target.value as Task['priority']) || undefined } : t))}
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: task.priority ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font)', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', outline: 'none', width: '100%' }}
                        >
                          <option value="">—</option>
                          <option value="Urgent Today">Urgent Today</option>
                          <option value="High">High</option>
                          <option value="Normal">Normal</option>
                        </select>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="text" value={task.task} onChange={e => updateField(task.id, 'task', e.target.value)} placeholder="Task description…"
                          style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font)', width: '100%', padding: '4px 8px', borderRadius: '6px', outline: 'none', transition: 'border-color 0.15s' }}
                          onFocus={e => (e.target.style.borderColor = 'var(--border-gold)')} onBlur={e => (e.target.style.borderColor = 'transparent')} />
                        {(task.timeLog?.length ?? 0) > 0 && (
                          <div style={{ paddingLeft: '8px', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {task.timeLog!.map((l, i) => (
                              <span key={i} style={{ fontSize: '10px', color: l.action === 'start' ? 'var(--status-working)' : 'var(--gold)', opacity: 0.75, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                {i > 0 && <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>·</span>}
                                {l.action === 'start' ? '▶' : '⏸'} {l.time}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="text" value={task.relatedLinks} onChange={e => updateField(task.id, 'relatedLinks', e.target.value)} placeholder="N/A"
                          style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font)', width: '100%', padding: '4px 8px', borderRadius: '6px', outline: 'none', transition: 'border-color 0.15s' }}
                          onFocus={e => (e.target.style.borderColor = 'var(--border-gold)')} onBlur={e => (e.target.style.borderColor = 'transparent')} />
                      </td>
                      <td style={{ padding: '10px 14px', fontVariantNumeric: 'tabular-nums', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatTime(task.elapsedTime)}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="text" value={task.notes} onChange={e => updateField(task.id, 'notes', e.target.value)} placeholder="Notes…"
                          style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: 'var(--font)', width: '100%', padding: '4px 8px', borderRadius: '6px', outline: 'none', transition: 'border-color 0.15s' }}
                          onFocus={e => (e.target.style.borderColor = 'var(--border-gold)')} onBlur={e => (e.target.style.borderColor = 'transparent')} />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => removeTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '6px', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <button onClick={addTask} className="ghost-btn" style={{ padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', letterSpacing: '0.04em' }}>
                <Plus size={14} /> Add Task
              </button>
              <button onClick={pauseAll} style={{ padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.18)', color: 'var(--status-lunch)', cursor: 'pointer', transition: 'all 0.15s ease', letterSpacing: '0.04em' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.13)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(251,191,36,0.07)')}>
                Lunch Break
              </button>
              <button onClick={handleFinalizeClick} style={{ padding: '13px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#EF4444', cursor: 'pointer', transition: 'all 0.15s ease', letterSpacing: '0.04em' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.13)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.07)')}>
                Finalize EOD
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
