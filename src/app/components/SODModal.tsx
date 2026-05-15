import { useState } from 'react';
import { Sparkles, Quote, Target, Clock } from 'lucide-react';
import { getDailyGratitudePrompt, getDailyDateKey } from '../lib/gratitudePrompts';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../../lib/supabase';

interface SODData {
  priorities: string;
  gratitude: string;
  quote: string;
  tz: 'PHT' | 'EST';
  date: string;
}

interface SODModalProps {
  onComplete: (data: SODData) => void;
}

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '22px 24px',
};

const iconBox = (bg: string, border: string) => ({
  width: '32px', height: '32px', borderRadius: '9px',
  background: bg, border: `1px solid ${border}`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
});

export function SODModal({ onComplete }: SODModalProps) {
  const { user } = useAuth();
  const gratitudePrompt = getDailyGratitudePrompt();
  const _storedTz = localStorage.getItem(`pulse2_tz_${user?.email}`);
  const savedTz: 'PHT' | 'EST' = (_storedTz === 'PHT' || _storedTz === 'EST') ? _storedTz : (user?.tz === 'EST' ? 'EST' : 'PHT');

  const [step, setStep]             = useState<0 | 1>(0);
  const [tz, setTz]                 = useState<'PHT' | 'EST'>(savedTz);
  const [priorities, setPriorities] = useState('');
  const [gratitude, setGratitude]   = useState('');
  const [quote, setQuote]           = useState('');

  const isAdmin   = user?.role === 'admin';
  const canSubmit = priorities.trim().length > 0;

  const handleSkip = () => {
    if (user?.email) {
      localStorage.setItem(`pulse2_tz_${user.email}`, tz);
      sessionStorage.setItem(`pulse2_sod_session_${user.email}`, '1');
    }
    onComplete({ priorities: '', gratitude: '', quote: '', tz, date: getDailyDateKey() });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const dateKey = getDailyDateKey();
    const data: SODData = {
      priorities: priorities.trim(),
      gratitude:  gratitude.trim(),
      quote:      quote.trim(),
      tz,
      date: dateKey,
    };

    localStorage.setItem(`pulse2_tz_${user?.email}`, tz);
    localStorage.setItem(`pulse2_sod_${user?.email}_${dateKey}`, JSON.stringify(data));
    sessionStorage.setItem(`pulse2_sod_session_${user?.email}`, '1');

    if (user?.email) {
      supabase.from('sod_entries').upsert({
        email:      user.email,
        date:       dateKey,
        priorities: data.priorities,
        gratitude:  data.gratitude,
        quote:      data.quote,
      }, { onConflict: 'email,date' }).then(({ error }) => {
        if (error) console.error('SOD save error:', error);
      });
    }

    onComplete(data);
  };

  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: tz === 'PHT' ? 'Asia/Manila' : 'America/New_York',
  });
  const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
  const dateStr  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // ── Welcome screen ────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(232,201,141,0.06) 0%, transparent 60%), linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(16px)',
      }}>
        <div className="animate-fade-in" style={{ textAlign: 'center', maxWidth: '400px', padding: '0 24px' }}>
          <img
            src="/daass-logo.png" alt="DAASS"
            className="daass-logo"
            style={{ display: 'block', margin: '0 auto 32px', height: '52px', objectFit: 'contain', opacity: 0.9 }}
          />
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: '10px' }}>
            {greeting}
          </div>
          <div style={{ fontSize: '36px', fontWeight: 800, letterSpacing: '0.06em', lineHeight: 1, marginBottom: '16px' }}>
            <span className="gold-text">{user?.name?.toUpperCase()}</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 16px', borderRadius: '20px', background: 'rgba(232,201,141,0.07)', border: '1px solid var(--border-gold)', marginBottom: '10px' }}>
            <Clock size={12} style={{ color: 'var(--gold)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gold)', fontVariantNumeric: 'tabular-nums' }}>{tz} · {timeStr}</span>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '40px' }}>{dateStr}</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setStep(1)}
              className="gold-btn"
              style={{ padding: '13px 44px', borderRadius: '12px', fontSize: '12px', letterSpacing: '0.12em', textTransform: 'uppercase' }}
            >
              Begin Day →
            </button>
            {isAdmin && (
              <button
                onClick={handleSkip}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'radial-gradient(ellipse at 50% 0%, rgba(232,201,141,0.05) 0%, transparent 50%), linear-gradient(180deg, var(--bg-base) 0%, var(--bg-surface) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(16px)',
      padding: '24px',
      overflowY: 'auto',
    }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '580px', paddingBottom: '16px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="gold-text" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.22em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Start of Day · {dateStr}
          </div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>
            Set your intention, {user?.name}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Timezone */}
          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={iconBox('linear-gradient(135deg, rgba(232,201,141,0.18), rgba(201,169,110,0.08))', 'var(--border-gold)')}>
                <Clock size={14} style={{ color: 'var(--gold)' }} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Your working timezone</div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['PHT', 'EST'] as const).map(option => (
                <button
                  key={option}
                  onClick={() => setTz(option)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                    letterSpacing: '0.08em', cursor: 'pointer', transition: 'all 0.15s',
                    ...(tz === option
                      ? { background: 'linear-gradient(135deg, var(--gold-light), var(--gold))', color: '#090A0C', border: 'none', boxShadow: 'var(--shadow-gold)' }
                      : { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-muted)' }),
                  }}
                >
                  {option}
                  <span style={{ fontSize: '10px', fontWeight: 500, marginLeft: '6px', opacity: 0.7 }}>
                    {option === 'PHT' ? '(Manila)' : '(New York)'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Priorities */}
          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={iconBox('linear-gradient(135deg, rgba(232,201,141,0.18), rgba(201,169,110,0.08))', 'var(--border-gold)')}>
                <Target size={14} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>My top priorities today</div>
                {!priorities.trim() && <div style={{ fontSize: '10px', color: 'var(--danger)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Required</div>}
              </div>
            </div>
            <textarea
              value={priorities}
              onChange={e => setPriorities(e.target.value)}
              placeholder="List your 2-3 most important tasks for today…"
              className="field-input"
              style={{ width: '100%', height: '86px', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', resize: 'none', lineHeight: '1.6' }}
            />
          </div>

          {/* Gratitude */}
          <div style={{ ...cardStyle, borderColor: 'var(--border-gold)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={iconBox('linear-gradient(135deg, rgba(232,201,141,0.18), rgba(201,169,110,0.08))', 'var(--border-gold)')}>
                <Sparkles size={13} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>Gratitude Prompt</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Optional</div>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--gold-text)', fontStyle: 'italic', marginBottom: '10px', lineHeight: 1.6, opacity: 0.9 }}>
              {gratitudePrompt}
            </p>
            <textarea
              value={gratitude}
              onChange={e => setGratitude(e.target.value)}
              placeholder="Your answer (optional)…"
              className="field-input"
              style={{ width: '100%', height: '76px', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', resize: 'none', lineHeight: '1.6' }}
            />
          </div>

          {/* Quote of the Day — shown to all users, optional */}
          <div style={{ ...cardStyle, borderColor: 'rgba(232,201,141,0.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={iconBox('linear-gradient(135deg, rgba(232,201,141,0.22), rgba(201,169,110,0.1))', 'var(--border-gold)')}>
                <Quote size={13} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--gold)' }}>Quote of the Day</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Optional · Shared with team</div>
              </div>
            </div>
            <textarea
              value={quote}
              onChange={e => setQuote(e.target.value)}
              placeholder="Share an inspiring quote for the team… (optional)"
              className="field-input"
              style={{ width: '100%', height: '70px', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', resize: 'none', lineHeight: '1.6' }}
            />
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
            {!canSubmit && (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Fill in Priorities to continue
              </p>
            )}
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="gold-btn"
              style={{
                padding: '13px 52px', borderRadius: '12px', fontSize: '12px',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                opacity: canSubmit ? 1 : 0.35,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
            >
              Let's Begin →
            </button>
            {isAdmin && (
              <button
                onClick={handleSkip}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '0.06em', textDecoration: 'underline', textUnderlineOffset: '3px' }}
              >
                Skip for now
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
