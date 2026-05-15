import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase, SUPABASE_URL_CONFIGURED } from '../../lib/supabase';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, ClipboardList, Archive, UserCircle, LogOut, Sun, Moon, Menu, X as XIcon, BarChart2,
} from 'lucide-react';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard',      icon: LayoutDashboard, adminOnly: false },
  { to: '/team',      label: 'Team',           icon: Users,           adminOnly: false },
  { to: '/eods',      label: 'EODs / Payroll', icon: ClipboardList,   adminOnly: true  },
  { to: '/archive',   label: 'Archive Files',  icon: Archive,         adminOnly: true  },
  { to: '/analytics', label: 'Analytics',     icon: BarChart2,       adminOnly: true  },
  { to: '/profile',   label: 'Profile',        icon: UserCircle,      adminOnly: false },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/team':      'Team',
  '/eods':      'EODs / Payroll',
  '/archive':   'Archive Files',
  '/analytics': 'Analytics',
  '/profile':   'Profile',
};

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate   = useNavigate();
  const location   = useLocation();
  const isDark     = theme === 'dark';
  const pageTitle  = PAGE_TITLES[location.pathname] ?? '';

  const picKey = user?.email ? `pulse2_pic_${user.email}` : 'pulse2_pic';
  const [profilePic, setProfilePic] = useState(() => localStorage.getItem(user?.email ? `pulse2_pic_${user.email}` : 'pulse2_pic') || '');
  const [isMobile, setIsMobile]     = useState(() => window.innerWidth < 768);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dbOk, setDbOk] = useState<boolean | null>(null);

  // Runtime Supabase connectivity test — runs once on mount
  useEffect(() => {
    if (!SUPABASE_URL_CONFIGURED) { setDbOk(false); return; }
    supabase.from('users').select('email').limit(1)
      .then(({ error }) => setDbOk(!error));
  }, []);

  // Load avatar from Supabase once on mount
  useEffect(() => {
    if (!user?.email) return;
    supabase.from('profiles').select('avatar').eq('email', user.email).single()
      .then(({ data }) => {
        if (data?.avatar) setProfilePic(data.avatar);
      });
  }, [user?.email]);

  useEffect(() => {
    const sync = () => setProfilePic(localStorage.getItem(picKey) || '');
    const interval = setInterval(sync, 2000);
    window.addEventListener('storage', sync);
    return () => { clearInterval(interval); window.removeEventListener('storage', sync); };
  }, [picKey]);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Close sidebar when route changes on mobile
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: 'var(--bg-base)' }}>

      {/* ── Supabase connection warning ──────────────────── */}
      {dbOk === false && (
        <div style={{
          background: '#EF4444', color: '#fff', padding: '7px 16px',
          fontSize: '11px', fontWeight: 600, textAlign: 'center', letterSpacing: '0.04em',
          flexShrink: 0, zIndex: 100,
        }}>
          ⚠ Database not connected — data is saving locally only.
          {!SUPABASE_URL_CONFIGURED
            ? ' Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables, then redeploy.'
            : ' Check Supabase project is active and GRANT permissions are applied.'}
        </div>
      )}

      {/* ── Top bar ─────────────────────────────────────── */}
      <header style={{
        height: '60px', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid var(--border-gold)',
        background: isDark ? 'rgba(9,11,14,0.94)' : 'rgba(240,234,218,0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        zIndex: 40, position: 'relative',
      }}>
        {/* Left – hamburger (mobile) + DAASS logo */}
        <div style={{ width: '160px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(o => !o)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: '4px', borderRadius: '6px' }}
            >
              {sidebarOpen ? <XIcon size={20} /> : <Menu size={20} />}
            </button>
          )}
          {!isMobile && <img src="/daass-logo.png" alt="DAASS" className="daass-logo" style={{ height: '34px', objectFit: 'contain', objectPosition: 'left' }} />}
        </div>

        {/* Center – page title */}
        <div style={{
          position: 'absolute', left: '50%', transform: 'translateX(-50%)',
          fontSize: '12px', fontWeight: 700, letterSpacing: '0.16em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          {pageTitle}
        </div>

        {/* Right – theme toggle + avatar */}
        <div style={{ width: '160px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            onClick={toggleTheme}
            title={isDark ? 'Light mode' : 'Dark mode'}
            style={{
              width: '48px', height: '26px', borderRadius: '13px',
              background: isDark ? 'rgba(232,201,141,0.1)' : 'rgba(201,169,110,0.22)',
              border: '1px solid var(--border-gold)',
              display: 'flex', alignItems: 'center', padding: '3px',
              cursor: 'pointer', transition: 'all 0.3s ease', flexShrink: 0,
            }}
          >
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--gold-light), var(--gold))',
              transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              transform: isDark ? 'translateX(0)' : 'translateX(22px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#090B0E',
            }}>
              {isDark ? <Moon size={10} /> : <Sun size={10} />}
            </div>
          </button>

          <button
            onClick={() => navigate('/profile')}
            title={`${user?.name} · ${user?.role}`}
            style={{
              width: '34px', height: '34px', borderRadius: '50%', overflow: 'hidden',
              border: '2px solid var(--border-gold)', boxShadow: 'var(--shadow-gold)',
              cursor: 'pointer', background: 'linear-gradient(135deg, var(--gold-light), var(--gold-dark))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, flexShrink: 0, transition: 'transform 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {profilePic
              ? <img src={profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <UserCircle size={18} style={{ color: '#090B0E' }} />
            }
          </button>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

        {/* Mobile overlay */}
        {isMobile && sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 45, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          />
        )}

        {/* Sidebar */}
        <aside style={{
          width: '200px', flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-sidebar)',
          borderRight: '1px solid var(--border-gold)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.2)',
          ...(isMobile ? {
            position: 'fixed', top: '60px', left: 0, bottom: 0, zIndex: 50,
            transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
            transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
          } : {}),
        }}>
          <nav style={{ flex: 1, padding: '16px 10px 8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {NAV_ITEMS.filter(item => !item.adminOnly || user?.role === 'admin').map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className="nav-item"
              >
                {({ isActive }) => (
                  <>
                    <Icon size={15} style={{ opacity: isActive ? 1 : 0.5, flexShrink: 0 }} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div style={{ padding: '8px 10px 14px' }}>
            <button
              onClick={async () => {
                if (user?.email) {
                  await supabase.from('live_status').upsert(
                    { email: user.email, status: 'Offline', current_task: '', updated_at: new Date().toISOString() },
                    { onConflict: 'email' }
                  );
                }
                logout();
                navigate('/login');
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                width: '100%', padding: '10px 12px', borderRadius: '9px',
                fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <LogOut size={15} /> Sign Out
            </button>
          </div>
        </aside>

        <main style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
