import { useState } from 'react';
import { type Task } from '../contexts/EODContext';
import { Video, Clock, CheckCircle, AlertCircle, X } from 'lucide-react';

function secToHHMM(s: number): string {
  const h = Math.floor(s / 3600).toString().padStart(2, '0');
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function hhmmToSec(v: string): number {
  const [hPart = '0', mPart = '0'] = v.trim().split(':');
  const h = Math.max(0, parseInt(hPart, 10) || 0);
  const m = Math.max(0, Math.min(59, parseInt(mPart, 10) || 0));
  return h * 3600 + m * 60;
}

function totalFromEditable(rows: EditableRow[]): string {
  const totalSec = rows.reduce((sum, r) => sum + hhmmToSec(r.timeHHMM), 0);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

interface EditableRow {
  id: string;
  status: 'In Progress' | 'Done';
  task: string;
  relatedLinks: string;
  timeHHMM: string;
  notes: string;
  startTime: number | null;
  timeLog: Task['timeLog'];
}

interface FinalizeEODModalProps {
  tasks: Task[];
  loomLink: string;
  loginTime: string;
  logoutTime: string;
  onConfirm: (tasks: Task[], loomLink: string) => void;
  onCancel: () => void;
}

export function FinalizeEODModal({ tasks, loomLink, loginTime, logoutTime, onConfirm, onCancel }: FinalizeEODModalProps) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    tasks.map(t => ({
      id: t.id,
      status: t.status,
      task: t.task,
      relatedLinks: t.relatedLinks,
      timeHHMM: secToHHMM(t.elapsedTime),
      notes: t.notes,
      startTime: t.startTime,
      timeLog: t.timeLog,
    }))
  );
  const [loom, setLoom] = useState(loomLink);

  const updateRow = (id: string, field: 'timeHHMM' | 'notes', value: string) =>
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const handleConfirm = () => {
    const finalTasks: Task[] = rows.map(r => ({
      id: r.id,
      status: r.status,
      task: r.task,
      relatedLinks: r.relatedLinks,
      elapsedTime: hhmmToSec(r.timeHHMM),
      notes: r.notes,
      startTime: r.startTime,
      timeLog: r.timeLog,
    }));
    onConfirm(finalTasks, loom);
  };

  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const totalHours = totalFromEditable(rows);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'var(--bg-overlay)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', overflowY: 'auto',
    }}>
      <div className="animate-fade-in" style={{
        width: '100%', maxWidth: '720px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-gold)',
        borderRadius: '18px',
        boxShadow: 'var(--shadow-elevated)',
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 48px)',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0,
        }}>
          <div>
            <div className="gold-text" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: '4px' }}>
              End of Day Review
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
              Finalize EOD
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{dateStr}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '2px' }}>Total Hours</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{totalHours}</div>
            </div>
            <button
              onClick={onCancel}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '6px', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

          {/* Login / Logout strip */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Login', value: loginTime },
              { label: 'Logout', value: logoutTime },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(232,201,141,0.06)', border: '1px solid var(--border-gold)' }}>
                <Clock size={12} style={{ color: 'var(--gold)' }} />
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Task list */}
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Tasks - adjust time or notes before submitting
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {rows.map((row, i) => (
              <div key={row.id} className="glass-card" style={{ borderRadius: '12px', padding: '16px 18px' }}>

                {/* Task name + status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700,
                    background: row.status === 'Done' ? 'rgba(74,222,128,0.12)' : 'rgba(232,201,141,0.12)',
                    color: row.status === 'Done' ? 'var(--status-working)' : 'var(--gold)',
                    flexShrink: 0,
                  }}>
                    {row.status}
                  </span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                    {row.task || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unnamed task {i + 1}</span>}
                  </span>
                  {row.relatedLinks && (
                    <a href={row.relatedLinks} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none', flexShrink: 0 }}>↗ Link</a>
                  )}
                </div>

                {/* Time log summary */}
                {(row.timeLog?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                    {row.timeLog!.map((l, li) => (
                      <span key={li} style={{ fontSize: '10px', color: l.action === 'start' ? 'var(--status-working)' : 'var(--gold)', opacity: 0.7, display: 'flex', alignItems: 'center', gap: '2px' }}>
                        {li > 0 && <span style={{ color: 'var(--text-muted)', opacity: 0.4 }}>·</span>}
                        {l.action === 'start' ? '▶' : '⏸'} {l.time}
                      </span>
                    ))}
                  </div>
                )}

                {/* Editable fields */}
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>
                      Time (HH:MM)
                    </div>
                    <input
                      type="text"
                      value={row.timeHHMM}
                      onChange={e => updateRow(row.id, 'timeHHMM', e.target.value)}
                      onBlur={e => {
                        const sec = hhmmToSec(e.target.value);
                        updateRow(row.id, 'timeHHMM', secToHHMM(sec));
                      }}
                      placeholder="00:00"
                      className="field-input"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textAlign: 'center' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '5px' }}>
                      Notes
                    </div>
                    <textarea
                      value={row.notes}
                      onChange={e => updateRow(row.id, 'notes', e.target.value)}
                      placeholder="Add any notes for this task…"
                      className="field-input"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', resize: 'none', height: '60px', lineHeight: '1.5' }}
                    />
                  </div>
                </div>

              </div>
            ))}

            {rows.length === 0 && (
              <div style={{ padding: '32px', textAlign: 'center', borderRadius: '12px', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <AlertCircle size={16} /> No tasks to review
              </div>
            )}
          </div>

          {/* Loom link */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Video size={12} style={{ color: 'var(--gold)' }} /> Loom Recording
            </div>
            <input
              type="url"
              value={loom}
              onChange={e => setLoom(e.target.value)}
              placeholder="Paste your Loom share URL, e.g. https://www.loom.com/share/..."
              className="field-input"
              style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', fontSize: '13px' }}
            />
            {loom && (
              <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--status-working)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <CheckCircle size={11} /> Loom link attached
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '16px 28px',
          borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end', gap: '10px', flexShrink: 0,
          background: 'var(--bg-card)',
        }}>
          <button
            onClick={onCancel}
            className="ghost-btn"
            style={{ padding: '11px 24px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, letterSpacing: '0.06em' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="gold-btn"
            style={{ padding: '11px 32px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Submit EOD →
          </button>
        </div>

      </div>
    </div>
  );
}
