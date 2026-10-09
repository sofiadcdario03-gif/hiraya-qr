import { useState, useEffect } from 'react';
import Header from './components/Header';
import URLInput from './components/URLInput';
import ViewToggle from './components/ViewToggle';
import DesignGallery from './components/DesignGallery';
import WorldCanvas from './scenes/WorldCanvas';
import { useQRCode } from './hooks/useQRCode';
import { themes } from './utils/themes';
import { copyToClipboard, downloadQR, shareContent } from './utils/sharing';
import './styles.css';

function App() {
  const [showOptions, setShowOptions] = useState(false);
  const [view, setView] = useState('world'); // 'world' or 'qr'
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [selectedTheme, setSelectedTheme] = useState('balete');
  const [notification, setNotification] = useState(null);
  const { qrDataUrl, qrTexture, isLoading, error, generateQR, resetQR } = useQRCode();

  const handleURLSubmit = async (url) => {
    setCurrentUrl(url);
    const theme = themes[selectedTheme];
    const success = await generateQR(url, theme.colors);
    if (success) {
      setView('world');
    }
  };

  const handleThemeChange = async (themeId) => {
    setSelectedTheme(themeId);
    if (currentUrl) {
      const theme = themes[themeId];
      await generateQR(currentUrl, theme.colors);
    }
  };

  const handleWorldClick = () => {
    if (qrDataUrl && !isTransitioning) {
      setIsTransitioning(true);
      const newView = view === 'world' ? 'qr' : 'world';
      setView(newView);
    }
  };

  const handleTransitionComplete = () => {
    setIsTransitioning(false);
  };

  const handleOptionsClick = () => {
    setShowOptions(!showOptions);
  };

  const handleCopyLink = async () => {
    const result = await copyToClipboard(currentUrl);
    showNotification(result.message, result.success);
    setShowOptions(false);
  };

  const handleDownloadQR = async () => {
    const result = await downloadQR(qrDataUrl);
    showNotification(result.message, result.success);
    setShowOptions(false);
  };

  const handleShare = async () => {
    const result = await shareContent(currentUrl);
    if (!result.success && result.message === 'Sharing not supported') {
      // Fallback to copy link
      await handleCopyLink();
    } else {
      showNotification(result.message, result.success);
      setShowOptions(false);
    }
  };

  const showNotification = (message, isSuccess) => {
    setNotification({ message, isSuccess });
    setTimeout(() => setNotification(null), 3000);
  };

  // Close options on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && showOptions) {
        setShowOptions(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showOptions]);

  const theme = themes[selectedTheme];

  return (
    <div className="app">
      <Header onOptionsClick={handleOptionsClick} hasQR={!!qrDataUrl} />

      <main className="main-content">
        <URLInput onSubmit={handleURLSubmit} isLoading={isLoading} />

        {error && <div className="error-message" role="alert">{error}</div>}

        {notification && (
          <div className={`notification ${notification.isSuccess ? 'success' : 'error'}`}>
            {notification.message}
          </div>
        )}

        {isLoading ? (
          <div className="loading-scene">
            <div className="loading-spinner-large" aria-hidden="true" />
            <p>Generating your world...</p>
          </div>
        ) : qrDataUrl ? (
  <div
    className="scene-container"
    onClick={handleWorldClick}
    role="button"
    tabIndex={0}
    aria-label={view === 'world' ? 'Show QR code' : 'Return to 3D world'}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleWorldClick();
      }
    }}
  >
    <WorldCanvas
      view={view}
      qrTexture={qrTexture}
      isTransitioning={isTransitioning}
      onTransitionComplete={handleTransitionComplete}
      selectedTheme={selectedTheme}
    />
    <ViewToggle view={view} isTransitioning={isTransitioning} />
  </div>
        ) : (
          <div className="placeholder-scene">
            <p>Enter a link above to begin</p>
          </div>
        )}

        <DesignGallery
          selectedTheme={selectedTheme}
          onSelectTheme={handleThemeChange}
        />
      </main>

      {showOptions && (
        <div className="options-overlay" onClick={() => setShowOptions(false)}>
          <div className="options-menu" onClick={(e) => e.stopPropagation()}>
            <button className="option-item" onClick={handleCopyLink}>
              Copy Link
            </button>
            <button className="option-item" onClick={handleDownloadQR}>
              Download QR Code
            </button>
            <button className="option-item" onClick={handleShare}>
              Share
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
