import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import { TrendingUp, Users, Clock, Award } from 'lucide-react';
import { useEOD } from '../contexts/EODContext';
import { useIsMobile } from '../hooks/useIsMobile';

// ── Helpers ────────────────────────────────────────────────

function hhmmToHours(s: string): number {
  const [h = 0, m = 0] = s.split(':').map(Number);
  return h + m / 60;
}

function formatDecimalHours(h: number): string {
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function parseEntryDate(dateStr: string): Date {
  try { return new Date(dateStr + ' ' + new Date().getFullYear()); } catch { return new Date(0); }
}

// ── Custom Tooltip ─────────────────────────────────────────

interface TooltipPayload { value: number }
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(12,14,16,0.96)',
      border: '1px solid var(--border-gold)',
      borderRadius: '10px',
      padding: '10px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      fontSize: '12px',
      fontFamily: 'var(--font)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '15px' }}>
        {formatDecimalHours(payload[0].value)}
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 40px', textAlign: 'center', gap: '16px',
    }}>
      <div style={{
        width: '64px', height: '64px', borderRadius: '50%',
        background: 'rgba(232,201,141,0.08)',
        border: '1px solid var(--border-gold)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <TrendingUp size={28} style={{ color: 'var(--gold)', opacity: 0.6 }} />
      </div>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
          No EOD Data Yet
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.6 }}>
          Analytics will appear here once team members start submitting End-of-Day reports.
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export function Analytics() {
  const { employeeEODs, eodLoading } = useEOD();
  const isMobile = useIsMobile();

  // ── Derived stats ──────────────────────────────────────

  const stats = useMemo(() => {
    if (!employeeEODs.length) return null;

    let totalHoursDecimal = 0;
    let totalDaysWorked   = 0;
    let totalTasksDone    = 0;
    let mostActiveName    = '';
    let mostActiveHours   = 0;

    const perEmployee: { name: string; hours: number }[] = [];

    for (const emp of employeeEODs) {
      let empHours = 0;

      for (const entry of emp.entries) {
        const h = hhmmToHours(entry.totalHours);
        empHours          += h;
        totalHoursDecimal += h;
        totalDaysWorked   += 1;
        totalTasksDone    += entry.tasks.filter(t => t.status === 'Done').length;
      }

      perEmployee.push({ name: emp.employeeName, hours: empHours });

      if (empHours > mostActiveHours) {
        mostActiveHours = empHours;
        mostActiveName  = emp.employeeName;
      }
    }

    const numEmployees = employeeEODs.length;
    const avgDailyHours = numEmployees > 0 && totalDaysWorked > 0
      ? totalHoursDecimal / totalDaysWorked
      : 0;

    // Sort by hours desc for the chart
    perEmployee.sort((a, b) => b.hours - a.hours);

    return {
      totalHours: totalHoursDecimal,
      avgDailyHours,
      totalTasksDone,
      mostActiveName,
      mostActiveHours,
      perEmployee,
    };
  }, [employeeEODs]);

  // ── Recent activity (last 7 EOD entries across all employees) ──

  const recentActivity = useMemo(() => {
    const rows: { name: string; date: string; hours: string; tasksDone: number; loom?: string }[] = [];
    for (const emp of employeeEODs) {
      for (const entry of emp.entries) {
        rows.push({
          name:      emp.employeeName,
          date:      entry.date,
          hours:     entry.totalHours,
          tasksDone: entry.tasks.filter(t => t.status === 'Done').length,
          loom:      entry.loomLink,
        });
      }
    }
    // Sort newest first using the date string heuristic
    rows.sort((a, b) => parseEntryDate(b.date).getTime() - parseEntryDate(a.date).getTime());
    return rows.slice(0, 7);
  }, [employeeEODs]);

  // ── Shared card style ──────────────────────────────────

  const cardPad: React.CSSProperties = { borderRadius: '14px', padding: '22px 26px' };
  const label: React.CSSProperties = {
    fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
    letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '8px',
  };
  const bigValue: React.CSSProperties = {
    fontSize: '32px', fontWeight: 800, color: 'var(--gold)', lineHeight: 1,
    marginBottom: '4px',
  };
  const subLabel: React.CSSProperties = {
    fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px',
  };

  // ── Render ─────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--page-bg-gradient)',
    }}>
      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '24px 16px' : '32px 40px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* ── Page header ──────────────────────────────── */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Admin View
            </div>
            <div style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <span className="gold-text">Analytics</span>
            </div>
          </div>

          {/* ── Loading skeleton ──────────────────────────── */}
          {eodLoading && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '14px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="glass-card" style={{ ...cardPad, minHeight: '100px' }}>
                  <div style={{ height: '10px', width: '80px', borderRadius: '6px', background: 'var(--bg-hover)', marginBottom: '14px' }} />
                  <div style={{ height: '32px', width: '60px', borderRadius: '8px', background: 'var(--bg-hover)' }} />
                </div>
              ))}
            </div>
          )}

          {/* ── No data ───────────────────────────────────── */}
          {!eodLoading && !stats && (
            <div className="glass-card" style={{ borderRadius: '14px' }}>
              <EmptyState />
            </div>
          )}

          {/* ── Stats + Charts ─────────────────────────────── */}
          {!eodLoading && stats && (
            <>
              {/* Stat cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                gap: '14px',
              }}>
                {/* Total Team Hours */}
                <div className="glass-card animate-fade-in" style={cardPad}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <Clock size={14} style={{ color: 'var(--gold)' }} />
                    <span style={label}>Total Hours</span>
                  </div>
                  <div style={bigValue}>{formatDecimalHours(Math.round(stats.totalHours * 10) / 10)}</div>
                  <div style={subLabel}>Across all team members</div>
                </div>

                {/* Avg Daily Hours */}
                <div className="glass-card animate-fade-in" style={cardPad}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <TrendingUp size={14} style={{ color: 'var(--gold)' }} />
                    <span style={label}>Avg Daily</span>
                  </div>
                  <div style={bigValue}>{formatDecimalHours(Math.round(stats.avgDailyHours * 10) / 10)}</div>
                  <div style={subLabel}>Hours per person per day</div>
                </div>

                {/* Total Tasks Done */}
                <div className="glass-card animate-fade-in" style={cardPad}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <Users size={14} style={{ color: 'var(--gold)' }} />
                    <span style={label}>Tasks Done</span>
                  </div>
                  <div style={bigValue}>{stats.totalTasksDone}</div>
                  <div style={subLabel}>Completed across all EODs</div>
                </div>

                {/* Most Active */}
                <div className="glass-card animate-fade-in" style={cardPad}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <Award size={14} style={{ color: 'var(--gold)' }} />
                    <span style={label}>Most Active</span>
                  </div>
                  <div style={{
                    fontSize: '18px', fontWeight: 800, color: 'var(--gold)',
                    lineHeight: 1.2, marginBottom: '4px',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {stats.mostActiveName || '—'}
                  </div>
                  <div style={subLabel}>{formatDecimalHours(Math.round(stats.mostActiveHours * 10) / 10)} worked</div>
                </div>
              </div>

              {/* Bar chart */}
              <div className="glass-card animate-fade-in" style={{ borderRadius: '14px', padding: '26px 28px' }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '2px' }}>
                    Team Hours Breakdown
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Total logged hours per employee (all time)
                  </div>
                </div>

                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={stats.perEmployee.map(e => ({ name: e.name.split(' ')[0], hours: Math.round(e.hours * 10) / 10, fullName: e.name }))}
                    margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                    barCategoryGap="30%"
                  >
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F0D8A0" />
                        <stop offset="100%" stopColor="#C9A96E" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-muted)', fontSize: 11, fontFamily: 'var(--font)' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v: number) => `${v}h`}
                      width={38}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(232,201,141,0.05)' }} />
                    <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                      {stats.perEmployee.map((_, idx) => (
                        <Cell key={idx} fill="url(#goldGrad)" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Recent Activity table */}
              {recentActivity.length > 0 && (
                <div className="glass-card animate-fade-in" style={{ borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{
                    padding: '18px 24px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1px' }}>
                        Recent Activity
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Last 7 EOD submissions across the team
                      </div>
                    </div>
                  </div>

                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Employee', 'Date', 'Hours', 'Tasks Done', 'Loom'].map(h => (
                            <th key={h} style={{
                              padding: '10px 20px', textAlign: 'left',
                              fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)',
                              letterSpacing: '0.08em', textTransform: 'uppercase',
                            }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {recentActivity.map((row, i) => (
                          <tr
                            key={i}
                            className="table-row"
                            style={{ borderBottom: i < recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}
                          >
                            <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {row.name}
                            </td>
                            <td style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                              {row.date}
                            </td>
                            <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 700, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>
                              {row.hours}
                            </td>
                            <td style={{ padding: '12px 20px' }}>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                minWidth: '28px', padding: '3px 10px',
                                borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                                background: row.tasksDone > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(100,116,139,0.1)',
                                color: row.tasksDone > 0 ? 'var(--status-working)' : 'var(--text-muted)',
                              }}>
                                {row.tasksDone}
                              </span>
                            </td>
                            <td style={{ padding: '12px 20px' }}>
                              {row.loom ? (
                                <a
                                  href={row.loom}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    fontSize: '12px', fontWeight: 600,
                                    color: 'var(--gold)', textDecoration: 'none',
                                    padding: '3px 10px', borderRadius: '6px',
                                    border: '1px solid var(--border-gold)',
                                    background: 'rgba(232,201,141,0.06)',
                                    transition: 'all 0.15s',
                                    display: 'inline-block',
                                  }}
                                  onMouseEnter={e => {
                                    e.currentTarget.style.background = 'rgba(232,201,141,0.14)';
                                    e.currentTarget.style.textDecoration = 'underline';
                                  }}
                                  onMouseLeave={e => {
                                    e.currentTarget.style.background = 'rgba(232,201,141,0.06)';
                                    e.currentTarget.style.textDecoration = 'none';
                                  }}
                                >
                                  Watch
                                </a>
                              ) : (
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
