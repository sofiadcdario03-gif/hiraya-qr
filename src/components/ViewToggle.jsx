export default function ViewToggle({ view, isTransitioning }) {
  return (
    <div className="view-toggle">
      {view === 'world' ? (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M7 7h10v10H7z" />
          </svg>
          <span>Show QR Code</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>Show 3D World</span>
        </>
      )}
    </div>
  );
}
