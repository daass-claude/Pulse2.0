import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const success = await login(email, password);
    setLoading(false);
    if (success) {
      navigate('/dashboard');
    } else {
      setError('Invalid email or password.');
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 30%, rgba(232,201,141,0.07) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(201,169,110,0.04) 0%, transparent 50%), linear-gradient(160deg, var(--bg-base) 0%, var(--bg-surface) 50%, var(--bg-base) 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle glow */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(232,201,141,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '0 24px' }}>
        {/* DAASS logo + tagline */}
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <img
            src="/daass-logo.png"
            alt="DAASS"
            className="daass-logo"
            style={{ display: 'block', margin: '0 auto 16px', height: '60px', maxWidth: '200px', objectFit: 'contain' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ height: '1px', width: '32px', background: 'var(--border-gold)' }} />
            <span className="gold-text" style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '0.22em' }}>PULSE 2.0</span>
            <div style={{ height: '1px', width: '32px', background: 'var(--border-gold)' }} />
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Work Execution Platform
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ borderRadius: '16px', padding: '36px' }}>
          <h2 style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: '28px',
          }}>
            Sign in to your portal
          </h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Email
              </label>
              <input
                type="text"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email or username"
                required
                className="field-input"
                style={{ width: '100%', padding: '12px 16px', borderRadius: '10px', fontSize: '13px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  className="field-input"
                  style={{ width: '100%', padding: '12px 44px 12px 16px', borderRadius: '10px', fontSize: '14px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#EF4444',
                fontSize: '13px',
              }}>
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="gold-btn"
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '10px',
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginTop: '4px',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
