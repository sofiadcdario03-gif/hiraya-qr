import { useState, useCallback, useEffect } from 'react';
import { generateQRCode, validateURL } from '../utils/generateQR';
import * as THREE from 'three';

export function useQRCode() {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrTexture, setQrTexture] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateQR = useCallback(async (url, colorPalette = {}) => {
    const validation = validateURL(url);
    if (!validation.valid) {
      setError(validation.error);
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dataUrl = await generateQRCode(url, colorPalette);
      setQrDataUrl(dataUrl);

      // Create Three.js texture
      const textureLoader = new THREE.TextureLoader();
      const texture = await new Promise((resolve, reject) => {
        textureLoader.load(dataUrl, resolve, undefined, reject);
      });
      setQrTexture(texture);

      return true;
    } catch (err) {
      setError('Failed to generate QR code. Please try again.');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetQR = useCallback(() => {
    setQrDataUrl(null);
    setQrTexture(null);
    setError(null);
  }, []);

  return {
    qrDataUrl,
    qrTexture,
    isLoading,
    error,
    generateQR,
    resetQR,
  };
}
