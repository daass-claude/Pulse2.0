import React from 'react';

interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '20px', background: 'var(--bg-base)', padding: '40px',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '480px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', color: '#EF4444', textTransform: 'uppercase', marginBottom: '10px' }}>
              Something went wrong
            </div>
            <div style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Unexpected Error
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '28px', lineHeight: '1.7', wordBreak: 'break-word' }}>
              {this.state.error?.message ?? 'An unknown error occurred.'}
            </div>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '11px 32px', borderRadius: '10px', fontSize: '12px', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
                background: 'linear-gradient(135deg, #F0D8A0, #E8C98D)',
                color: '#090B0E', border: 'none', boxShadow: '0 4px 20px rgba(232,201,141,0.25)',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
