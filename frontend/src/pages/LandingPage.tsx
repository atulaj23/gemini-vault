import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useEffect } from 'react';

export function LandingPage() {
  const { user, loading, signInWithGoogle, error } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate('/dashboard');
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="landing">
      <div className="landing-bg" />

      <header className="landing-header">
        <div className="landing-logo">
          <span className="logo-icon-lg">🔐</span>
          <span className="logo-name">Gemini Vault</span>
        </div>
      </header>

      <main className="landing-main">
        <div className="landing-hero">
          <div className="hero-badge">Privacy-First · AI-Powered · Tamper-Evident</div>

          <h1 className="hero-title">
            Your thoughts.<br />
            Your AI.<br />
            <span className="hero-accent">Your integrity.</span>
          </h1>

          <p className="hero-subtitle">
            A personal AI journal powered by Gemini — with cryptographic proof that your entries
            haven't been tampered with. Every finalized entry is locked into a SHA-256 hash chain,
            server-controlled and independently verifiable.
          </p>

          <div className="hero-features">
            <div className="feature-chip">🤖 Reflective AI conversations</div>
            <div className="feature-chip">🔒 Firebase authentication</div>
            <div className="feature-chip">🔗 Tamper-evident hash chain</div>
            <div className="feature-chip">☁️ Cloud Run backend</div>
          </div>

          {error && (
            <div className="error-banner">{error}</div>
          )}

          <button className="btn-google-signin" onClick={signInWithGoogle}>
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.2 33.4 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.1 8.1 3l6-6C34.5 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5c11 0 20.5-7.9 20.5-20.5 0-1.3-.1-2.7-.5-4z" />
              <path fill="#34A853" d="M6.3 14.7l7 5.1C14.9 16 19.1 13 24 13c3.1 0 5.9 1.1 8.1 3l6-6C34.5 6.5 29.6 4.5 24 4.5c-7.7 0-14.3 4.3-17.7 10.2z" />
              <path fill="#FBBC05" d="M24 46c5.5 0 10.5-1.9 14.4-5.1l-6.6-5.4C29.7 37.3 27 38 24 38c-5.5 0-10.1-3.5-11.8-8.4l-7 5.4C8.5 41.6 15.7 46 24 46z" />
              <path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-.8 2.1-2.2 3.9-4.1 5.1l6.6 5.4c3.8-3.5 6.3-8.8 6.3-15.5 0-1.3-.1-2.7-.5-4z" />
            </svg>
            Sign in with Google
          </button>

          <p className="hero-disclaimer">
            Your journal data is private and user-isolated. Entries are cryptographically verified
            server-side. No journal content is stored in any logs.
          </p>
        </div>

        <div className="landing-visual">
          <div className="integrity-demo">
            <div className="demo-title">Integrity Chain Preview</div>
            <div className="chain-links">
              <div className="chain-link verified">
                <div className="link-num">Entry #1</div>
                <div className="link-hash">GENESIS → a3f8c2d1…</div>
                <div className="link-badge">✓ Verified</div>
              </div>
              <div className="chain-arrow">↓</div>
              <div className="chain-link verified">
                <div className="link-num">Entry #2</div>
                <div className="link-hash">a3f8c2d1 → 7b9e4f21…</div>
                <div className="link-badge">✓ Verified</div>
              </div>
              <div className="chain-arrow">↓</div>
              <div className="chain-link verified">
                <div className="link-num">Entry #3</div>
                <div className="link-hash">7b9e4f21 → c1a2b3d4…</div>
                <div className="link-badge">✓ Verified</div>
              </div>
            </div>
            <div className="demo-status">🔒 Chain Intact · All entries verified</div>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        Built with Google Cloud · Firebase · Gemini · Cloud Run ·{' '}
        <span className="footer-accent">dev-tutorial=cloud-run-ai-challenge</span>
      </footer>
    </div>
  );
}
