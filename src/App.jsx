import { useState, useEffect, useRef } from 'react';
import WorldCanvas from './scenes/WorldCanvas';
import { useQRCode } from './hooks/useQRCode';
import { themes } from './utils/themes';
import { copyToClipboard, downloadQR, shareContent } from './utils/sharing';

// view is simply "world" or "qr".
// The topdown camera sweep is internal to WorldCanvas – no state needed here.

const VIEW_HINT = {
  world: { icon: '▲', label: 'Tap to reveal QR' },
  qr:    { icon: '◀', label: 'Tap to return' },
};

export default function App() {
  const [view, setView]                       = useState('world');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentUrl, setCurrentUrl]           = useState('');
  const [selectedTheme, setSelectedTheme]     = useState('diwata');
  const [notification, setNotification]       = useState(null);
  const [showMenu, setShowMenu]               = useState(false);
  const [urlDraft, setUrlDraft]               = useState('');

  const { qrDataUrl, qrTexture, isLoading, error, generateQR } = useQRCode();

  // ── URL submit ─────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e?.preventDefault();
    const url = urlDraft.trim();
    if (!url) return;
    setCurrentUrl(url);
    const ok = await generateQR(url, themes[selectedTheme].colors);
    if (ok) setView('world');
  };

  // ── theme change ───────────────────────────────────────────────
  const handleThemeChange = async (id) => {
    setSelectedTheme(id);
    if (currentUrl) await generateQR(currentUrl, themes[id].colors);
  };

  // ── single tap toggles world ↔ qr ─────────────────────────────
  // The WorldCanvas rig handles the topdown waypoint automatically.
  const handleTap = () => {
    if (!qrDataUrl || isTransitioning) return;
    setIsTransitioning(true);
    setView(v => v === 'world' ? 'qr' : 'world');
  };

  const handleTransitionComplete = () => setIsTransitioning(false);

  // ── share actions ──────────────────────────────────────────────
  const toast = (msg, ok) => {
    setNotification({ message: msg, isSuccess: ok });
    setTimeout(() => setNotification(null), 3000);
  };
  const handleCopy     = async () => { const r = await copyToClipboard(currentUrl); toast(r.message, r.success); setShowMenu(false); };
  const handleDownload = async () => { const r = await downloadQR(qrDataUrl);       toast(r.message, r.success); setShowMenu(false); };
  const handleShare    = async () => {
    const r = await shareContent(currentUrl);
    if (!r.success && r.message === 'Sharing not supported') await handleCopy();
    else { toast(r.message, r.success); setShowMenu(false); }
  };

  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') setShowMenu(false); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  const theme = themes[selectedTheme];
  const hint  = VIEW_HINT[view];

  return (
    <div className="app">

      {/* ── header ──────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="brand">
          <svg className="brand-icon" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 2L2 8v16l14 6 14-6V8L16 2zm0 2.5L28 9.5 16 14.5 4 9.5 16 4.5zM4 11.5l11 5v12l-11-5v-12zm13 17v-12l11-5v12l-11 5z" />
          </svg>
          <span className="brand-name">Hiraya QR</span>
        </div>

        <span
          className="theme-badge"
          style={{
            background:   theme.colors.primary + '2a',
            color:        theme.colors.accent,
            borderColor:  theme.colors.primary + '55',
          }}
        >
          {theme.name}
        </span>

        <button
          className="icon-btn"
          onClick={() => setShowMenu(v => !v)}
          disabled={!qrDataUrl}
          aria-label="Options"
          title={qrDataUrl ? 'Options' : 'Generate a QR first'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="5"  r="1.2" fill="currentColor" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" />
            <circle cx="12" cy="19" r="1.2" fill="currentColor" />
          </svg>
        </button>
      </header>

      {/* ── scene (primary area) ────────────────────────────────── */}
      <main className="scene-area">
        {isLoading ? (
          <div className="scene-loading">
            <div className="spinner-lg" />
            <p>Weaving your world…</p>
          </div>
        ) : qrDataUrl ? (
          <div
            className="scene-wrap"
            role="button"
            tabIndex={0}
            aria-label={hint.label}
            onClick={handleTap}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(); }
            }}
          >
            <WorldCanvas
              view={view}
              qrTexture={qrTexture}
              isTransitioning={isTransitioning}
              onTransitionComplete={handleTransitionComplete}
              selectedTheme={selectedTheme}
            />

            {/* hint badge – stays visible throughout the transition */}
            <div className={`view-badge ${isTransitioning ? 'fading' : ''}`}>
              <span className="view-badge-icon">{hint.icon}</span>
              <span>{hint.label}</span>
            </div>
          </div>
        ) : (
          <div className="scene-empty">
            <div className="scene-empty-glyph">🌿</div>
            <p>Paste a link below to grow your world</p>
          </div>
        )}

        {error && <div className="error-bar" role="alert">{error}</div>}
      </main>

      {/* ── bottom control panel ──────────────────────────────── */}
      <div className="control-panel">
        {/* theme colour dots */}
        <div className="theme-strip" role="group" aria-label="Choose world theme">
          {Object.values(themes).map((t) => (
            <button
              key={t.id}
              className={`theme-dot ${selectedTheme === t.id ? 'active' : ''}`}
              onClick={() => handleThemeChange(t.id)}
              title={t.name}
              aria-label={`Select ${t.name} theme`}
              aria-pressed={selectedTheme === t.id}
              style={{ '--dot-bg': t.colors.primary, '--dot-acc': t.colors.accent }}
            />
          ))}
        </div>

        {/* URL row */}
        <form className="url-row" onSubmit={handleSubmit}>
          <input
            type="url"
            className="url-field"
            placeholder="Paste a link to begin…"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            disabled={isLoading}
            aria-label="URL"
          />
          <button
            type="submit"
            className="send-btn"
            disabled={isLoading || !urlDraft.trim()}
            aria-label="Generate QR"
            style={{ background: theme.colors.accent, color: '#0f172a' }}
          >
            {isLoading ? (
              <span className="spinner-sm" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            )}
          </button>
        </form>
      </div>

      {/* ── options menu ──────────────────────────────────────── */}
      {showMenu && (
        <div className="overlay" onClick={() => setShowMenu(false)}>
          <div className="menu" onClick={(e) => e.stopPropagation()}>
            <button className="menu-item" onClick={handleCopy}>Copy Link</button>
            <button className="menu-item" onClick={handleDownload}>Download QR</button>
            <button className="menu-item" onClick={handleShare}>Share</button>
          </div>
        </div>
      )}

      {/* ── toast ─────────────────────────────────────────────── */}
      {notification && (
        <div className={`toast ${notification.isSuccess ? 'toast-ok' : 'toast-err'}`}>
          {notification.message}
        </div>
      )}
    </div>
  );
}
