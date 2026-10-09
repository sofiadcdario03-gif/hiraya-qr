export default function DesignCard({ theme, isSelected, onClick }) {
  return (
    <button
      className={`design-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      aria-label={`Select ${theme.name} theme`}
      aria-pressed={isSelected}
    >
      <div
        className="design-preview"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.secondary} 100%)`,
        }}
      >
        <div className="design-accent" style={{ background: theme.colors.accent }} />
      </div>
      <span className="design-name">{theme.name}</span>
    </button>
  );
}
