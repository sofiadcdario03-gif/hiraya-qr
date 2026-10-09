import { useState } from 'react';

export default function URLInput({ onSubmit, isLoading }) {
  const [url, setUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="url-input-form">
      <div className="url-input-wrapper">
        <input
          type="url"
          placeholder="Enter a link to bring your world to life..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="url-input"
          disabled={isLoading}
          aria-label="URL input"
          aria-describedby="url-hint"
          aria-busy={isLoading}
        />
        <button
          type="submit"
          className="send-button"
          disabled={isLoading || !url.trim()}
          aria-label="Generate QR code"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <span className="loading-spinner" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>
      <span id="url-hint" className="sr-only">
        Enter a valid URL starting with http:// or https://
      </span>
    </form>
  );
}
