import { useState, useEffect } from 'react';
import { useEOD, type EmployeeEOD } from '../contexts/EODContext';
import { TEAM_MEMBERS } from '../auth/AuthContext';
import { ChevronDown, ChevronUp, Download, FileText, Video, Clock, Upload, File, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { exportEODEntry, exportPayrollWeek } from '../../lib/exportXlsx';

function getMonday(dateStr: string): Date | null {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const day  = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon  = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getWeekKey(dateStr: string): string {
  const mon = getMonday(dateStr);
  return mon ? mon.toISOString().split('T')[0] : 'unknown';
}

function formatWeekLabel(weekKey: string): string {
  if (weekKey === 'unknown') return 'Unknown Week';
  const mon = new Date(weekKey + 'T00:00:00');
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Week of ${fmt(mon)} to ${fmt(sun)}, ${sun.getFullYear()}`;
}

function formatWeekExportTitle(weekKey: string): string {
  if (weekKey === 'unknown') return 'Unknown_Week';
  const mon = new Date(weekKey + 'T00:00:00');
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(mon)} to ${fmt(fri)}`;
}

function calcWeekHours(entries: EmployeeEOD['entries']): string {
  let totalMin = 0;
  for (const e of entries) {
    const [h = 0, m = 0] = e.totalHours.split(':').map(Number);
    totalMin += h * 60 + m;
  }
  const h = Math.floor(totalMin / 60).toString().padStart(2, '0');
  const m = (totalMin % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function groupByWeek(entries: EmployeeEOD['entries']): Map<string, EmployeeEOD['entries']> {
  const map = new Map<string, EmployeeEOD['entries']>();
  for (const entry of entries) {
    const key = getWeekKey(entry.date);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }
  return map;
}

// ── EOD Sub-tab ──────────────────────────────────────────────────────────────

function WeekBlockEOD({ weekKey, entries, employeeName }: { weekKey: string; entries: EmployeeEOD['entries']; employeeName: string }) {
  const [open, setOpen] = useState(true);
  const totalHrs = calcWeekHours(entries);

  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '10px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '13px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(232,201,141,0.07), rgba(201,169,110,0.02))',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: 'linear-gradient(180deg, var(--gold-light), var(--gold-dark))' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatWeekLabel(weekKey)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '16px', background: 'rgba(232,201,141,0.08)', border: '1px solid var(--border-gold)' }}>
            <Clock size={11} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{totalHrs} hrs</span>
          </div>
          {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {open && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.8fr 0.5fr 1fr auto', padding: '8px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}>
            {['Date', 'Login', 'Logout', 'Hours', 'Tasks', 'Loom', ''].map(h => (
              <div key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {entries.map((entry, i) => (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: '1.4fr 0.9fr 0.9fr 0.8fr 0.5fr 1fr auto',
                padding: '12px 18px', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{entry.date}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{entry.loginTime}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{entry.logoutTime}</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{entry.totalHours}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{entry.tasks.length}</div>
              <div>
                {entry.loomLink ? (
                  <a href={entry.loomLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: 'var(--gold)', textDecoration: 'none', opacity: 0.8 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.8')}
                  >
                    <Video size={12} /> View
                  </a>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
                )}
              </div>
              <button
                onClick={() => exportEODEntry(entry, employeeName)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '5px', fontSize: '10px', fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--border-gold)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <FileText size={10} /> EOD
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EODTab({ eod }: { eod: EmployeeEOD }) {
  const weekMap = groupByWeek(eod.entries);
  const sortedKeys = [...weekMap.keys()].sort((a, b) => b.localeCompare(a));

  if (eod.entries.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No archived EOD records yet for {eod.employeeName}.
      </div>
    );
  }

  return (
    <div>
      {sortedKeys.map(key => (
        <WeekBlockEOD key={key} weekKey={key} entries={weekMap.get(key)!} employeeName={eod.employeeName} />
      ))}
    </div>
  );
}

// ── Payroll Sub-tab ──────────────────────────────────────────────────────────

function WeekBlockPayroll({ weekKey, entries, employeeName }: { weekKey: string; entries: EmployeeEOD['entries']; employeeName: string }) {
  const [open, setOpen] = useState(true);
  const totalHrs = calcWeekHours(entries);

  return (
    <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '10px' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '13px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(232,201,141,0.07), rgba(201,169,110,0.02))',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: 'linear-gradient(180deg, var(--gold-light), var(--gold-dark))' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatWeekLabel(weekKey)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '16px', background: 'rgba(232,201,141,0.08)', border: '1px solid var(--border-gold)' }}>
            <Clock size={11} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{totalHrs} hrs</span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); exportPayrollWeek(formatWeekExportTitle(weekKey), entries, employeeName); }}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--border-gold)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            <Download size={11} /> Export
          </button>
          {open ? <ChevronUp size={14} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />}
        </div>
      </div>

      {open && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', padding: '8px 18px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}>
            {['Date', 'Login', 'Logout', 'Hours Worked'].map(h => (
              <div key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {entries.map((entry, i) => (
            <div
              key={i}
              style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
                padding: '12px 18px', borderBottom: i < entries.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center', transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 600 }}>{entry.date}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{entry.loginTime}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>{entry.logoutTime}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{entry.totalHours}</div>
            </div>
          ))}
          {/* Week total row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', padding: '10px 18px', background: 'rgba(232,201,141,0.05)', borderTop: '1px solid var(--border-gold)' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold)', letterSpacing: '0.06em', textTransform: 'uppercase', gridColumn: '1 / 4' }}>Week Total</div>
            <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{totalHrs}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function PayrollTab({ eod }: { eod: EmployeeEOD }) {
  const weekMap = groupByWeek(eod.entries);
  const sortedKeys = [...weekMap.keys()].sort((a, b) => b.localeCompare(a));
  const grandTotal = calcWeekHours(eod.entries);

  if (eod.entries.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No payroll records yet for {eod.employeeName}.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Grand total strip */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {[
          { label: 'Total Hours', value: grandTotal },
          { label: 'Weeks on Record', value: String(sortedKeys.length) },
          { label: 'Days on Record', value: String(eod.entries.length) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(232,201,141,0.07)', border: '1px solid var(--border-gold)' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gold)' }}>{value}</span>
          </div>
        ))}
      </div>
      {sortedKeys.map(key => (
        <WeekBlockPayroll key={key} weekKey={key} entries={weekMap.get(key)!} employeeName={eod.employeeName} />
      ))}
    </div>
  );
}

// ── Files Sub-tab ─────────────────────────────────────────────────────────────

const BUCKET = 'archive-files';

interface StoredFile {
  name: string;
  size: number;
  createdAt: string;
  url: string;
}

function FilesTab({ employeeName }: { employeeName: string }) {
  const folder = employeeName.replace(/\s+/g, '_');
  const [files, setFiles]       = useState<StoredFile[]>([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');

  const loadFiles = async () => {
    setLoading(true);
    setError('');
    const { data, error: listErr } = await supabase.storage.from(BUCKET).list(folder, { sortBy: { column: 'created_at', order: 'desc' } });
    if (listErr) { setError('Could not load files. Make sure the Supabase storage bucket "archive-files" exists.'); setLoading(false); return; }
    const mapped: StoredFile[] = (data ?? []).filter(f => f.name !== '.emptyFolderPlaceholder').map(f => {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(`${folder}/${f.name}`);
      return {
        name: f.name,
        size: f.metadata?.size ?? 0,
        createdAt: f.created_at ?? '',
        url: urlData.publicUrl,
      };
    });
    setFiles(mapped);
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, [employeeName]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(`${folder}/${safeName}`, file);
    setUploading(false);
    e.target.value = '';
    if (upErr) { setError(`Upload failed: ${upErr.message}`); return; }
    loadFiles();
  };

  const handleDelete = async (fileName: string) => {
    if (!window.confirm(`Delete "${fileName}"?`)) return;
    const { error: delErr } = await supabase.storage.from(BUCKET).remove([`${folder}/${fileName}`]);
    if (delErr) { setError(`Delete failed: ${delErr.message}`); return; }
    setFiles(prev => prev.filter(f => f.name !== fileName));
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fmtDate = (iso: string) => {
    if (!iso) return '';
    try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return iso; }
  };

  return (
    <div>
      {/* Upload bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          padding: '8px 18px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
          background: uploading ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, var(--gold-light), var(--gold))',
          color: uploading ? 'var(--text-muted)' : '#090B0E',
          border: uploading ? '1px solid var(--border)' : 'none',
          cursor: uploading ? 'not-allowed' : 'pointer',
          boxShadow: uploading ? 'none' : 'var(--shadow-gold)',
          transition: 'all 0.15s',
          letterSpacing: '0.06em',
        }}>
          <Upload size={13} />
          {uploading ? 'Uploading...' : 'Upload File'}
          <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: 'none' }} />
        </label>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Files for {employeeName}
        </span>
      </div>

      {error && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: '12px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Loading files...</div>
      ) : files.length === 0 ? (
        <div style={{ padding: '48px', textAlign: 'center', borderRadius: '12px', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <File size={36} style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>No files uploaded yet for {employeeName}</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, opacity: 0.6 }}>Upload PDFs, screenshots, or any documents</p>
        </div>
      ) : (
        <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 80px', padding: '8px 18px', background: 'rgba(255,255,255,0.012)', borderBottom: '1px solid var(--border)' }}>
            {['File Name', 'Size', 'Uploaded', ''].map(h => (
              <div key={h} style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{h}</div>
            ))}
          </div>
          {files.map((file, i) => (
            <div
              key={file.name}
              style={{ display: 'grid', gridTemplateColumns: '1fr 100px 120px 80px', padding: '11px 18px', borderBottom: i < files.length - 1 ? '1px solid var(--border)' : 'none', alignItems: 'center', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <File size={13} style={{ color: 'var(--gold)', flexShrink: 0, opacity: 0.7 }} />
                <a
                  href={file.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '12px', color: 'var(--text-primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--gold)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                >
                  {file.name.replace(/^\d+_/, '')}
                </a>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtSize(file.size)}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{fmtDate(file.createdAt)}</div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <a
                  href={file.url} download
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', borderRadius: '5px', fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--border-gold)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <Download size={10} />
                </a>
                <button
                  onClick={() => handleDelete(file.name)}
                  style={{ display: 'flex', alignItems: 'center', padding: '4px 7px', borderRadius: '5px', fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ArchiveFiles() {
  const { employeeEODs } = useEOD();
  const [selected, setSelected] = useState<string>(TEAM_MEMBERS[0]?.name ?? '');
  const [subTab, setSubTab] = useState<'eod' | 'payroll' | 'files'>('eod');

  const allEmployeeData: EmployeeEOD[] = TEAM_MEMBERS.map(m => {
    const found = employeeEODs.find(e => e.employeeName === m.name);
    return found ?? { employeeName: m.name, entries: [] };
  });

  const currentData = allEmployeeData.find(e => e.employeeName === selected) ?? allEmployeeData[0];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--page-bg-gradient)',
    }}>

      {/* Employee tabs */}
      <div style={{ padding: '20px 40px 0', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {TEAM_MEMBERS.map(m => {
          const empData = allEmployeeData.find(e => e.employeeName === m.name);
          const hasData = (empData?.entries.length ?? 0) > 0;
          return (
            <button
              key={m.name}
              onClick={() => setSelected(m.name)}
              style={{
                padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s ease', letterSpacing: '0.03em', position: 'relative',
                ...(selected === m.name
                  ? { background: 'linear-gradient(135deg, var(--gold-light), var(--gold))', color: '#090B0E', border: 'none', boxShadow: 'var(--shadow-gold)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
              }}
            >
              {m.name}
              {hasData && (
                <span style={{ position: 'absolute', top: '-3px', right: '-3px', width: '7px', height: '7px', borderRadius: '50%', background: 'var(--gold)', border: '1px solid var(--bg-base)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* EOD / Payroll / Files sub-tabs */}
      <div style={{ padding: '16px 40px 0', display: 'flex', gap: '4px' }}>
        {([['eod', 'EOD Reports'], ['payroll', 'Payroll'], ['files', 'Files']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            style={{
              padding: '7px 18px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
              letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s',
              ...(subTab === t
                ? { background: 'rgba(232,201,141,0.15)', border: '1px solid var(--border-gold)', color: 'var(--gold)' }
                : { background: 'transparent', border: '1px solid transparent', color: 'var(--text-muted)' }),
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px 40px 32px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          {subTab === 'eod' && <EODTab eod={currentData} />}
          {subTab === 'payroll' && <PayrollTab eod={currentData} />}
          {subTab === 'files' && <FilesTab employeeName={selected} />}
        </div>
      </div>
    </div>
  );
}
