export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return { success: true, message: 'Link copied to clipboard!' };
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return { success: true, message: 'Link copied to clipboard!' };
    } catch (fallbackErr) {
      document.body.removeChild(textArea);
      return { success: false, message: 'Failed to copy link' };
    }
  }
}

export async function downloadQR(qrDataUrl, filename = 'hiraya-qr.png') {
  try {
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return { success: true, message: 'QR code downloaded!' };
  } catch (err) {
    return { success: false, message: 'Failed to download QR code' };
  }
}

export async function shareContent(url, title = 'Hiraya QR') {
  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: `Check out this QR code generated with Hiraya QR!`,
        url,
      });
      return { success: true, message: 'Shared successfully!' };
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, message: 'Share cancelled' };
      }
      return { success: false, message: 'Failed to share' };
    }
  }
  return { success: false, message: 'Sharing not supported' };
}

export function getSocialShareUrl(platform, url) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent('Check out this QR code!');

  switch (platform) {
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case 'twitter':
      return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedText}`;
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    default:
      return null;
  }
}
