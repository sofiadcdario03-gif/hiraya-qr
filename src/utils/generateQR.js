import QRCode from 'qrcode';

/**
 * Generate a QR code data URL.
 *
 * colorPalette should contain { dark, light } – the module and background
 * colors for the QR image.  We also accept { primary, secondary, accent }
 * from theme definitions and map them to dark/light automatically.
 *
 * Contrast is enforced: if the computed luminance ratio is below 3:1 we
 * fall back to near-black / near-white so the code stays scannable.
 */
export async function generateQRCode(url, colorPalette = {}, options = {}) {
  const { dark: darkIn, light: lightIn, primary, accent } = colorPalette;

  // Resolve colours --------------------------------------------------
  // Use explicit dark/light if supplied, otherwise derive from primary/accent.
  let darkColor  = darkIn  || primary  || '#000000';
  let lightColor = lightIn || accent   || '#FFFFFF';

  // Ensure adequate contrast (WCAG relative luminance).
  if (!hasAdequateContrast(darkColor, lightColor)) {
    // Fall back to a tinted-but-readable pair: very dark primary on ivory.
    darkColor  = darkenToTarget(darkColor, 0.06);   // luminance ≤ 0.06
    lightColor = '#fef3c7';                          // warm ivory
    // If still not sufficient just go monochrome.
    if (!hasAdequateContrast(darkColor, lightColor)) {
      darkColor  = '#111111';
      lightColor = '#FFFDF5';
    }
  }

  const defaultOptions = {
    width: 512,
    margin: 2,
    color: { dark: darkColor, light: lightColor },
    errorCorrectionLevel: 'M',
    ...options,
  };

  try {
    return await QRCode.toDataURL(url, defaultOptions);
  } catch (err) {
    console.error('QR generation failed:', err);
    throw new Error('Failed to generate QR code');
  }
}

// ── URL validation ────────────────────────────────────────────────
export function validateURL(url) {
  if (!url || url.trim() === '')
    return { valid: false, error: 'Please enter a URL' };
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:')
      return { valid: false, error: 'URL must start with http:// or https://' };
    return { valid: true, error: null };
  } catch {
    return { valid: false, error: 'Please enter a valid URL' };
  }
}

// ── contrast helpers ──────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0,2), 16),
    parseInt(h.slice(2,4), 16),
    parseInt(h.slice(4,6), 16),
  ];
}

function relativeLuminance([r, g, b]) {
  const s = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}

function contrastRatio(a, b) {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

function hasAdequateContrast(dark, light) {
  try { return contrastRatio(dark, light) >= 3.0; }
  catch { return false; }
}

/** Darken a hex color until its relative luminance ≤ target. */
function darkenToTarget(hex, target) {
  let [r, g, b] = hexToRgb(hex);
  while (relativeLuminance([r, g, b]) > target && (r > 0 || g > 0 || b > 0)) {
    r = Math.max(0, r - 8);
    g = Math.max(0, g - 8);
    b = Math.max(0, b - 8);
  }
  return `#${[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}`;
}
