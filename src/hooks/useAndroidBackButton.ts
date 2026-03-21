import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Handles the Android hardware/gesture back button via Capacitor's App plugin.
 * Navigates back within the app instead of exiting.
 * Only exits the app when already on the home screen.
 */
export const useAndroidBackButton = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setup = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const listener = await App.addListener('backButton', ({ canGoBack }) => {
          const isHome = location.pathname === '/' || location.pathname === '';
          if (isHome) {
            App.exitApp();
          } else if (canGoBack) {
            navigate(-1);
          } else {
            navigate('/');
          }
        });
        cleanup = () => listener.remove();
      } catch {
        // Not running in Capacitor (web browser) — no-op
      }
    };

    setup();
    return () => cleanup?.();
  }, [navigate, location.pathname]);
};
