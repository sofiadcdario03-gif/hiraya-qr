export default function Header({ onOptionsClick, hasQR }) {
  return (
    <header className="header">
      <div className="header-content">
        <div className="logo">
          <svg className="logo-icon" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 2L2 8v16l14 6 14-6V8L16 2zm0 2.5L28 9.5 16 14.5 4 9.5 16 4.5zM4 11.5l11 5v12l-11-5v-12zm13 17v-12l11-5v12l-11 5z" />
          </svg>
          <h1 className="logo-text">Hiraya QR</h1>
        </div>
        <p className="subtitle">Every link tells a story.</p>
      </div>
      <button
        className="options-button"
        onClick={onOptionsClick}
        disabled={!hasQR}
        aria-label="Options"
        title={hasQR ? 'Options' : 'Generate a QR code first'}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>
    </header>
  );
}
