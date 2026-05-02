/**
 * useDeviceOrientation — Hook zur Erkennung von Gerät-Ausrichtung und Video-Seitenverhältnis
 * 
 * Returns:
 *   - orientation: 'portrait' | 'landscape'
 *   - aspectRatio: Seitenverhältnis des Video-Streams (width/height)
 *   - isPortrait: boolean
 */
import { useState, useEffect } from 'react';

export default function useDeviceOrientation(videoRef) {
  const [orientation, setOrientation] = useState('portrait');
  const [aspectRatio, setAspectRatio] = useState(9 / 16); // Default portrait
  const [isPortrait, setIsPortrait] = useState(true);

  useEffect(() => {
    const checkOrientation = () => {
      // 1. Screen-API (preferred, am zuverlässigsten)
      if (screen?.orientation?.type) {
        const type = screen.orientation.type;
        const isPort = type.includes('portrait');
        setOrientation(isPort ? 'portrait' : 'landscape');
        setIsPortrait(isPort);
        setAspectRatio(isPort ? 9 / 16 : 16 / 9);
        return;
      }

      // 2. Fallback: window.innerWidth/Height
      const isPort = window.innerHeight > window.innerWidth;
      setOrientation(isPort ? 'portrait' : 'landscape');
      setIsPortrait(isPort);
      setAspectRatio(isPort ? 9 / 16 : 16 / 9);
    };

    // 3. Video-Stream Auflösung prüfen (wenn Video verfügbar)
    const checkVideoResolution = () => {
      if (!videoRef?.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) return; // Warte auf Metadaten

      const { videoWidth, videoHeight } = video;
      if (videoWidth && videoHeight) {
        const ratio = videoWidth / videoHeight;
        setAspectRatio(ratio);
        const isPort = ratio < 1;
        setOrientation(isPort ? 'portrait' : 'landscape');
        setIsPortrait(isPort);
      }
    };

    // Initial check
    checkOrientation();
    checkVideoResolution();

    // Event Listener
    if (screen?.orientation) {
      screen.orientation.addEventListener('change', checkOrientation);
    }
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', checkOrientation);
    
    if (videoRef?.current) {
      videoRef.current.addEventListener('loadedmetadata', checkVideoResolution);
    }

    // Cleanup
    return () => {
      if (screen?.orientation) {
        screen.orientation.removeEventListener('change', checkOrientation);
      }
      window.removeEventListener('orientationchange', checkOrientation);
      window.removeEventListener('resize', checkOrientation);
      if (videoRef?.current) {
        videoRef.current.removeEventListener('loadedmetadata', checkVideoResolution);
      }
    };
  }, []);

  return { orientation, aspectRatio, isPortrait };
}