import { useState, useEffect, useMemo } from 'react';
import { User as UserIcon, Quote } from 'lucide-react';
import { TEAM_MEMBERS } from '../auth/AuthContext';
import { supabase } from '../../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';
import { getDailyDateKey } from '../lib/gratitudePrompts';

function Avatar({ email, name }: { email: string; name: string }) {
  const cached = localStorage.getItem(`pulse2_pic_${email}`);
  const [src, setSrc] = useState(cached || '');
  useEffect(() => {
    if (src) return;
    supabase.from('profiles').select('avatar').eq('email', email).single()
      .then(({ data }) => {
        if (data?.avatar) {
          setSrc(data.avatar);
          localStorage.setItem(`pulse2_pic_${email}`, data.avatar);
        }
      });
  }, [email, src]);
  if (src) return <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />;
  return <UserIcon size={21} style={{ color: '#090B0E' }} />;
}

type Status = 'Working' | 'Online' | 'Lunch' | 'Offline';

const STATUS_COLORS: Record<Status, string> = {
  Working: 'var(--status-working)',
  Online:  '#60A5FA',
  Lunch:   'var(--status-lunch)',
  Offline: 'var(--status-offline)',
};

const STATUS_BG: Record<Status, string> = {
  Working: 'rgba(74,222,128,0.12)',
  Online:  'rgba(96,165,250,0.10)',
  Lunch:   'rgba(251,191,36,0.12)',
  Offline: 'rgba(100,116,139,0.12)',
};

const TZ_ZONES: Record<'PHT' | 'EST', string> = {
  PHT: 'Asia/Manila',
  EST: 'America/New_York',
};

function getLiveStatus(email: string): Status {
  const s = localStorage.getItem(`pulse2_live_status_${email}`);
  if (s === 'Working' || s === 'Online' || s === 'Lunch' || s === 'Offline') return s;
  return 'Offline';
}

function getLiveTask(email: string): string {
  return localStorage.getItem(`pulse2_live_task_${email}`) ?? '';
}

function getMemberTime(tz: 'PHT' | 'EST', now: Date): string {
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: TZ_ZONES[tz],
  });
}

function SkeletonCard() {
  return (
    <div className="glass-card" style={{ borderRadius: '12px', padding: '22px' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-hover)', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '4px' }}>
          <div style={{ height: '14px', width: '120px', borderRadius: '6px', background: 'var(--bg-hover)' }} />
          <div style={{ height: '10px', width: '60px', borderRadius: '6px', background: 'var(--bg-hover)' }} />
          <div style={{ height: '11px', width: '180px', borderRadius: '6px', background: 'var(--bg-hover)' }} />
        </div>
      </div>
    </div>
  );
}

export function Team() {
  const isMobile = useIsMobile();
  const [now, setNow] = useState(new Date());
  const [filter, setFilter] = useState<'All' | Status>('All');
  const [loading, setLoading] = useState(true);
  // Supabase live_status cache: email → { status, current_task }
  const [liveData, setLiveData] = useState<Record<string, { status: Status; current_task: string; updated_at: string }>>({});
  const [todayQuotes, setTodayQuotes] = useState<Array<{ email: string; name: string; quote: string }>>([]);

  const fetchLiveData = () => {
    supabase.from('live_status').select('email, status, current_task, updated_at').then(({ data }) => {
      setLoading(false);
      if (!data) return;
      const map: Record<string, { status: Status; current_task: string; updated_at: string }> = {};
      for (const row of data) map[row.email] = { status: row.status as Status, current_task: row.current_task, updated_at: row.updated_at };
      setLiveData(map);
    });
  };

  // Initial load
  useEffect(() => { fetchLiveData(); }, []);

  // Fetch today's quotes from SOD entries
  useEffect(() => {
    const today = getDailyDateKey();
    supabase.from('sod_entries').select('email, quote').eq('date', today)
      .then(({ data }) => {
        if (!data) return;
        const quotes = data
          .filter(row => row.quote?.trim())
          .map(row => {
            const member = TEAM_MEMBERS.find(m => m.email === row.email);
            return member ? { email: row.email, name: member.name, quote: row.quote as string } : null;
          })
          .filter(Boolean) as Array<{ email: string; name: string; quote: string }>;
        setTodayQuotes(quotes);
      });
  }, []);

  // Polling fallback — re-fetches every 10s in case Realtime misses an event
  useEffect(() => {
    const poll = setInterval(fetchLiveData, 10_000);
    return () => clearInterval(poll);
  }, []);

  // Subscribe to realtime updates on live_status
  useEffect(() => {
    const channel = supabase
      .channel('live_status_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_status' }, payload => {
        const row = payload.new as { email: string; status: Status; current_task: string; updated_at: string };
        if (!row?.email) return;
        setLiveData(prev => ({ ...prev, [row.email]: { status: row.status, current_task: row.current_task, updated_at: row.updated_at } }));
      })
      .subscribe((status, err) => {
        if (err) console.warn('live_status realtime subscription error:', err.message);
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const STALE_MS = 10 * 60 * 60 * 1000;
  const getStatus = (email: string): Status => {
    const live = liveData[email];
    if (live) {
      if (live.updated_at && Date.now() - new Date(live.updated_at).getTime() > STALE_MS) return 'Offline';
      return live.status;
    }
    return getLiveStatus(email);
  };
  const getTask = (email: string): string =>
    liveData[email]?.current_task ?? getLiveTask(email);

  const stats = {
    total:   TEAM_MEMBERS.length,
    working: TEAM_MEMBERS.filter(m => getStatus(m.email) === 'Working').length,
    online:  TEAM_MEMBERS.filter(m => getStatus(m.email) === 'Online').length,
    lunch:   TEAM_MEMBERS.filter(m => getStatus(m.email) === 'Lunch').length,
    offline: TEAM_MEMBERS.filter(m => getStatus(m.email) === 'Offline').length,
  };

  const filtered = useMemo(
    () => filter === 'All' ? TEAM_MEMBERS : TEAM_MEMBERS.filter(m => getStatus(m.email) === filter),
    [filter, liveData] // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--page-bg-gradient)',
    }}>
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '24px 16px' : '32px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Today's Quotes */}
          {todayQuotes.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px' }}>
                <Quote size={12} style={{ color: 'var(--gold)', opacity: 0.7 }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Today's Quotes</span>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {todayQuotes.map(q => (
                  <div key={q.email} className="glass-card" style={{ borderRadius: '12px', padding: '14px 18px', flex: '1 1 200px', maxWidth: isMobile ? '100%' : '360px', border: '1px solid rgba(232,201,141,0.18)', background: 'linear-gradient(135deg, var(--bg-card), rgba(232,201,141,0.03))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '9px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-gold)' }}>
                        <Avatar email={q.email} name={q.name} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>{q.name}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--gold-text)', fontStyle: 'italic', lineHeight: 1.65, opacity: 0.9 }}>"{q.quote}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: '14px' }}>
            {[
              { label: 'Total',   value: stats.total,   color: 'var(--gold)',           bg: 'rgba(232,201,141,0.07)',  fv: null },
              { label: 'Working', value: stats.working, color: 'var(--status-working)', bg: 'rgba(74,222,128,0.07)',   fv: 'Working' as Status },
              { label: 'Online',  value: stats.online,  color: '#60A5FA',               bg: 'rgba(96,165,250,0.07)',   fv: 'Online' as Status },
              { label: 'Lunch',   value: stats.lunch,   color: 'var(--status-lunch)',   bg: 'rgba(251,191,36,0.07)',   fv: 'Lunch' as Status },
              { label: 'Offline', value: stats.offline, color: 'var(--status-offline)', bg: 'rgba(100,116,139,0.07)',  fv: 'Offline' as Status },
            ].map(({ label, value, color, bg, fv }) => (
              <div
                key={label}
                onClick={() => fv && setFilter(f => f === fv ? 'All' : fv)}
                className="glass-card"
                style={{
                  borderRadius: '12px', padding: '18px 22px', cursor: fv ? 'pointer' : 'default',
                  background: (filter === fv) ? bg : undefined,
                  transition: 'all 0.18s ease',
                }}
              >
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</div>
                <div style={{ fontSize: '34px', fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Team grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '14px' }}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
              : filtered.map(member => {
              const status = getStatus(member.email);
              const task   = getTask(member.email);
              const storedTz = localStorage.getItem(`pulse2_tz_${member.email}`) as 'PHT' | 'EST' | null;
              const tz       = storedTz ?? member.tz ?? 'PHT';
              const tzTime   = getMemberTime(tz, now);

              return (
                <div
                  key={member.email}
                  className="glass-card"
                  style={{
                    borderRadius: '12px', padding: '22px',
                    position: 'relative', transition: 'transform 0.15s ease',
                    background: `linear-gradient(135deg, var(--bg-card) 0%, ${STATUS_BG[status]} 100%)`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  {/* Status dot + label (top left of right side) */}
                  <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {/* Timezone + time chip — only when active */}
                    {(status === 'Working' || status === 'Online' || status === 'Lunch') && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>{tz}</span>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{tzTime}</span>
                      </div>
                    )}
                    {/* Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: STATUS_COLORS[status], boxShadow: `0 0 5px ${STATUS_COLORS[status]}` }} />
                      <span style={{ fontSize: '11px', color: STATUS_COLORS[status], fontWeight: 700, letterSpacing: '0.04em' }}>{status}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dark))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: 'var(--shadow-gold)', overflow: 'hidden',
                    }}>
                      <Avatar email={member.email} name={member.name} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, paddingRight: '100px' }}>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>{member.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--gold-text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.85 }}>{member.role}</div>
                      <div style={{ fontSize: '12px', color: task ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: task ? 'normal' : 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task || (status === 'Lunch' ? 'On lunch break' : status === 'Working' ? 'Working...' : status === 'Online' ? 'Available' : '')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
