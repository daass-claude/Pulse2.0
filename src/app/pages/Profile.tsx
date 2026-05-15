import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useEOD } from '../contexts/EODContext';
import { supabase } from '../../lib/supabase';
import { User, Upload, Sparkles, Lock, CheckCircle, AlertCircle, ClipboardList } from 'lucide-react';
import { getDailyGratitudePrompt, getDailyDateKey } from '../lib/gratitudePrompts';

function compressImage(dataUrl: string, maxPx = 200): Promise<string> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxPx / img.width, maxPx / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = dataUrl;
  });
}

export function Profile() {
  const { user, changePassword } = useAuth();
  const { employeeEODs } = useEOD();
  const myEOD = employeeEODs.find(e => e.employeeName === user?.name);
  const myEntries = [...(myEOD?.entries ?? [])].reverse();
  const gratitudePrompt = getDailyGratitudePrompt();
  const todayKey        = getDailyDateKey();

  const picKey = `pulse2_pic_${user?.email}`;
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem(picKey) || '');

  const [oldPw, setOldPw]         = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwResult, setPwResult]   = useState<{ ok: boolean; msg: string } | null>(null);

  // Read SOD data for today
  const sodData = (() => {
    try { return JSON.parse(localStorage.getItem(`pulse2_sod_${user?.email}_${todayKey}`) || '{}'); }
    catch { return {}; }
  })();
  const sodGratitude  = (sodData.gratitude  as string) || '';
  const sodPriorities = (sodData.priorities as string) || '';
  const sodQuote      = (sodData.quote      as string) || '';

  // Keep localStorage in sync for Layout header to pick up
  useEffect(() => { if (user?.email) localStorage.setItem(picKey, profilePic); }, [profilePic, picKey, user?.email]);

  // Load avatar from Supabase on mount (overrides localStorage if newer)
  useEffect(() => {
    if (!user?.email) return;
    supabase.from('profiles').select('avatar').eq('email', user.email).single()
      .then(({ data }) => {
        if (data?.avatar) {
          setProfilePic(data.avatar);
          localStorage.setItem(picKey, data.avatar);
        }
      });
  }, [user?.email, picKey]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) { setPwResult({ ok: false, msg: 'New passwords do not match.' }); return; }
    setPwLoading(true);
    setPwResult(null);
    const result = await changePassword(oldPw, newPw);
    setPwLoading(false);
    if (result.ok) {
      setPwResult({ ok: true, msg: 'Password changed successfully.' });
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } else {
      setPwResult({ ok: false, msg: result.error ?? 'Failed to change password.' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = async () => {
      const compressed = await compressImage(reader.result as string);
      setProfilePic(compressed);
      if (user?.email) {
        localStorage.setItem(picKey, compressed);
        supabase.from('profiles').upsert(
          { email: user.email, avatar: compressed, updated_at: new Date().toISOString() },
          { onConflict: 'email' }
        ).then(({ error }) => { if (error) console.error('Avatar save error:', error); });
      }
    };
    reader.readAsDataURL(file);
  };

  const sectionLabel = (text: string) => (
    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>{text}</div>
  );

  const readOnlyBlock = (content: string, placeholder: string) => content ? (
    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(232,201,141,0.04)', border: '1px solid var(--border-gold)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
      {content}
    </div>
  ) : (
    <div style={{ padding: '12px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
      {placeholder}
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: 'var(--page-bg-gradient)',
    }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '32px 40px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Profile card */}
          <div className="glass-card" style={{ borderRadius: '14px', padding: '28px', background: 'linear-gradient(135deg, var(--bg-card), rgba(232,201,141,0.04))' }}>
            {sectionLabel('Profile')}
            <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
              <div style={{ flexShrink: 0 }}>
                {profilePic ? (
                  <img src={profilePic} alt="Profile" style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border-gold)', boxShadow: 'var(--shadow-gold)' }} />
                ) : (
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dark))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--border-gold)', boxShadow: 'var(--shadow-gold)' }}>
                    <User size={34} style={{ color: '#090B0E' }} />
                  </div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '2px' }}>{user?.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--gold)', marginBottom: '4px', textTransform: 'capitalize', letterSpacing: '0.06em', opacity: 0.9 }}>{user?.role}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>{user?.email}</div>
                <label className="gold-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer' }}>
                  <Upload size={13} /> Upload Photo
                  <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                </label>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>JPG, PNG or GIF · max 5MB</div>
              </div>
            </div>
          </div>

          {/* Today's Priorities — read-only from SOD */}
          <div className="glass-card" style={{ borderRadius: '14px', padding: '28px' }}>
            {sectionLabel("Today's Priorities")}
            {readOnlyBlock(sodPriorities, "No priorities set yet. Fill in the Start of Day form when you log in.")}
          </div>

          {/* Gratitude — read-only from SOD */}
          <div className="glass-card" style={{ borderRadius: '14px', padding: '28px', background: 'linear-gradient(135deg, var(--bg-card), rgba(232,201,141,0.05))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Sparkles size={14} style={{ color: 'var(--gold)' }} />
              {sectionLabel("Today's Gratitude")}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--gold-text)', fontStyle: 'italic', marginBottom: '12px', lineHeight: 1.6, opacity: 0.9 }}>
              {gratitudePrompt}
            </p>
            {readOnlyBlock(sodGratitude, "No gratitude entry yet. Answer the prompt when you begin your day.")}
          </div>

          {/* Quote — read-only from SOD */}
          {sodQuote && (
            <div className="glass-card" style={{ borderRadius: '14px', padding: '28px', background: 'linear-gradient(135deg, var(--bg-card), rgba(232,201,141,0.03))' }}>
              {sectionLabel("Today's Quote")}
              <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(232,201,141,0.04)', borderLeft: '3px solid var(--gold)', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.7', fontStyle: 'italic' }}>
                "{sodQuote}"
              </div>
            </div>
          )}

          {/* EOD History */}
          {myEntries.length > 0 && (
            <div className="glass-card" style={{ borderRadius: '14px', padding: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <ClipboardList size={14} style={{ color: 'var(--gold)' }} />
                {sectionLabel('EOD History')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myEntries.map((entry, i) => {
                  const tasksDone = entry.tasks.filter(t => t.status === 'Done').length;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '10px', background: 'rgba(232,201,141,0.04)', border: '1px solid var(--border-gold)' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>{entry.date}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {entry.loginTime} – {entry.logoutTime}&nbsp;·&nbsp;{tasksDone} task{tasksDone !== 1 ? 's' : ''} done
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{entry.totalHours}</span>
                        {entry.loomLink && (
                          <a
                            href={entry.loomLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: '11px', color: 'var(--gold)', textDecoration: 'none', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-gold)', background: 'rgba(232,201,141,0.06)', transition: 'all 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(232,201,141,0.14)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(232,201,141,0.06)')}
                          >
                            Watch
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Change Password */}
          <div className="glass-card" style={{ borderRadius: '14px', padding: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '18px' }}>
              <Lock size={14} style={{ color: 'var(--gold)' }} />
              {sectionLabel('Change Password')}
            </div>
            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'Current Password', value: oldPw, set: setOldPw },
                { label: 'New Password',     value: newPw, set: setNewPw },
                { label: 'Confirm New',      value: confirmPw, set: setConfirmPw },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</label>
                  <input
                    type="password"
                    value={value}
                    onChange={e => set(e.target.value)}
                    required
                    className="field-input"
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '9px', fontSize: '13px' }}
                  />
                </div>
              ))}

              {pwResult && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', background: pwResult.ok ? 'rgba(74,222,128,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${pwResult.ok ? 'rgba(74,222,128,0.25)' : 'rgba(239,68,68,0.25)'}`, color: pwResult.ok ? 'var(--status-working)' : '#EF4444' }}>
                  {pwResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  {pwResult.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={pwLoading}
                className="gold-btn"
                style={{ padding: '11px 28px', borderRadius: '9px', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'flex-start', opacity: pwLoading ? 0.6 : 1 }}
              >
                {pwLoading ? 'Saving...' : 'Update Password'}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
