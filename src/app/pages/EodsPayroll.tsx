import { useState } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';
import { useEOD, type EmployeeEOD } from '../contexts/EODContext';
import { TEAM_MEMBERS } from '../auth/AuthContext';
import { ExternalLink, Download, ClipboardList, Video, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { exportEODEntry, exportPayrollAll } from '../../lib/exportXlsx';
import { formatTime } from '../lib/time';

function parseLoomEmbed(url: string): string | null {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (!u.hostname.includes('loom.com')) return null;
    const id = u.pathname.split('/').filter(Boolean).pop();
    if (!id || id.length < 10) return null;
    return `https://www.loom.com/embed/${id}`;
  } catch { return null; }
}

function LoomPlayer({ url }: { url: string }) {
  const embedUrl = parseLoomEmbed(url);
  if (!embedUrl) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '20px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', textAlign: 'center' }}>
        <AlertCircle size={20} style={{ color: 'var(--status-lunch)', margin: '0 auto' }} />
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Could not parse Loom URL</span>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--gold)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', justifyContent: 'center' }}>
          <ExternalLink size={12} /> Watch on Loom
        </a>
      </div>
    );
  }
  return (
    <div style={{ borderRadius: '12px', overflow: 'hidden', position: 'relative', paddingBottom: '56.25%', height: 0, border: '1px solid var(--border)', background: '#000' }}>
      <iframe
        src={embedUrl}
        title="Loom recording"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      />
    </div>
  );
}

function EntryCard({ entry, employeeName, defaultOpen = false }: { entry: EmployeeEOD['entries'][0]; employeeName: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="glass-card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
      <div
        style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', borderBottom: open ? '1px solid var(--border)' : 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{entry.date}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {entry.loginTime} to {entry.logoutTime} &nbsp;·&nbsp;
            <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{entry.totalHours} hrs</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={e => { e.stopPropagation(); exportEODEntry(entry, employeeName); }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            <Download size={12} /> Export
          </button>
          {open ? <ChevronUp size={15} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {open && (
        <div style={{ padding: '20px 22px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '12px' }}>Tasks</div>
          <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
                  {['Status', 'Task', 'Time', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.tasks.map(task => (
                  <tr key={task.id} className="table-row" style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, background: task.status === 'Done' ? 'rgba(74,222,128,0.1)' : 'rgba(232,201,141,0.1)', color: task.status === 'Done' ? 'var(--status-working)' : 'var(--gold)' }}>
                        {task.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-primary)' }}>
                      {task.task || '-'}
                      {task.relatedLinks && (
                        <a href={task.relatedLinks} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '6px', color: 'var(--text-muted)', fontSize: '11px', textDecoration: 'none' }}>↗</a>
                      )}
                      {(task.timeLog?.length ?? 0) > 0 && (
                        <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {task.timeLog!.map((l, i) => (
                            <span key={i} style={{ fontSize: '10px', color: l.action === 'start' ? 'var(--status-working)' : 'var(--gold)', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '2px' }}>
                              {i > 0 && <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>·</span>}
                              {l.action === 'start' ? '▶' : '⏸'} {l.time}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{formatTime(task.elapsedTime)}</td>
                    <td style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>{task.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function PayrollSummary({ eod }: { eod: EmployeeEOD }) {
  const totalMinutes = eod.entries.reduce((sum, e) => {
    const [h = 0, m = 0] = e.totalHours.split(':').map(Number);
    return sum + h * 60 + m;
  }, 0);
  const th = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const tm = (totalMinutes % 60).toString().padStart(2, '0');

  return (
    <div className="glass-card" style={{ borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Weekly Payroll Summary</span>
        <button
          onClick={() => exportPayrollAll(eod)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '7px', fontSize: '11px', fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <Download size={12} /> Export All
        </button>
      </div>
      <div style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderRadius: '8px', background: 'rgba(232,201,141,0.07)', border: '1px solid var(--border-gold)', marginBottom: '14px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)' }}>Total Hours This Week</span>
          <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{th}:{tm}</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.015)' }}>
              {['Date', 'Login', 'Logout', 'Hours'].map(h => (
                <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eod.entries.length === 0
              ? <tr><td colSpan={4} style={{ padding: '20px 12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No entries yet.</td></tr>
              : eod.entries.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '9px 12px', fontSize: '13px', color: 'var(--text-primary)' }}>{e.date}</td>
                  <td style={{ padding: '9px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{e.loginTime}</td>
                  <td style={{ padding: '9px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{e.logoutTime}</td>
                  <td style={{ padding: '9px 12px', fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{e.totalHours}</td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkeletonBlock() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="glass-card" style={{ borderRadius: '12px', padding: '20px 22px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ width: '140px', height: '14px', borderRadius: '6px', background: 'var(--bg-hover)' }} />
              <div style={{ width: '200px', height: '11px', borderRadius: '6px', background: 'var(--bg-hover)' }} />
            </div>
            <div style={{ width: '72px', height: '28px', borderRadius: '7px', background: 'var(--bg-hover)' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EodsPayroll() {
  const { employeeEODs, eodLoading } = useEOD();
  const isMobile = useIsMobile();
  const [selected, setSelected] = useState<string>(TEAM_MEMBERS[0]?.name ?? '');

  const currentEOD = employeeEODs.find(e => e.employeeName === selected) ?? {
    employeeName: selected,
    entries: [],
  } as EmployeeEOD;

  const latestLoom = [...(currentEOD?.entries ?? [])].reverse().find(e => e.loomLink)?.loomLink ?? null;
  const playerUrl = latestLoom || '';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--page-bg-gradient)',
    }}>

      {/* Employee tabs */}
      <div style={{ padding: isMobile ? '16px 16px 0' : '20px 40px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {TEAM_MEMBERS.map(m => {
          const hasData = employeeEODs.some(e => e.employeeName === m.name);
          return (
            <button
              key={m.name}
              onClick={() => setSelected(m.name)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease', letterSpacing: '0.03em',
                position: 'relative',
                ...(selected === m.name
                  ? { background: 'linear-gradient(135deg, var(--gold-light), var(--gold))', color: '#090B0E', border: 'none', boxShadow: 'var(--shadow-gold)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
              }}
            >
              {m.name}
              {hasData && (
                <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--status-working)', border: '1px solid var(--bg-base)' }} />
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '16px 16px 24px' : '24px 40px 32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Video Player Section (always visible) ── */}
          <div className="glass-card" style={{ borderRadius: '14px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Video size={15} style={{ color: 'var(--gold)' }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Loom Recording · {currentEOD.employeeName}
              </span>
              {playerUrl && (
                <a href={playerUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 'auto', color: 'var(--gold)', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.7')}
                >
                  <ExternalLink size={12} /> Open in Loom
                </a>
              )}
            </div>
            <div style={{ padding: '20px 22px' }}>
              {playerUrl ? (
                <LoomPlayer url={playerUrl} />
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', borderRadius: '12px', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <Video size={32} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No Loom recording submitted yet for {currentEOD.employeeName}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, opacity: 0.6 }}>Recording will appear here once an EOD with a Loom link is submitted</p>
                </div>
              )}
            </div>
          </div>

          {/* ── EOD Reports + Payroll ── */}
          {eodLoading ? <SkeletonBlock /> : currentEOD.entries.length === 0 ? (
            <div className="glass-card" style={{ borderRadius: '12px', padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <ClipboardList size={44} style={{ color: 'var(--text-muted)', opacity: 0.35 }} />
              <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>No EOD reports for {selected} yet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Reports will appear here after an EOD is submitted from the Dashboard</p>
            </div>
          ) : (
            <>
              {[...currentEOD.entries].reverse().map((entry, i) => (
                <EntryCard key={i} entry={entry} employeeName={selected} defaultOpen={i === 0} />
              ))}
              <PayrollSummary eod={currentEOD} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
