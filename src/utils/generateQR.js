import QRCode from 'qrcode';

export async function generateQRCode(url, colorPalette = {}, options = {}) {
  const defaultOptions = {
    width: 512,
    margin: 2,
    color: {
      dark: colorPalette.dark || '#000000',
      light: colorPalette.light || '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
    ...options,
  };

  try {
    const dataUrl = await QRCode.toDataURL(url, defaultOptions);
    return dataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code');
  }
}

export function validateURL(url) {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'Please enter a URL' };
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return { valid: false, error: 'URL must start with http:// or https://' };
    }
    return { valid: true, error: null };
  } catch {
    return { valid: false, error: 'Please enter a valid URL' };
  }
}
