import React, { StrictMode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, domAnimation } from 'motion/react';
import App from './App';
import './index.css';
import './styles/accessibility.css';
import './styles/readability.css';
import './motion/motion.css';
import { MotionPreferenceProvider } from './motion';

function initializeGoogleAnalytics() {
  if (typeof window === 'undefined') return;
  const measurementId = 'G-9CEEHSHNHJ';
  const dataLayer = (window as Window & { dataLayer?: unknown[] }).dataLayer ||= [];
  const gtag = (...args: unknown[]) => dataLayer.push(args);
  (window as Window & { gtag?: (...args: unknown[]) => void }).gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId, { send_page_view: false });

  if (document.querySelector('script[data-panda-google-analytics]')) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
  script.dataset.pandaGoogleAnalytics = 'true';
  document.head.appendChild(script);
}

initializeGoogleAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LazyMotion features={domAnimation}>
      <MotionPreferenceProvider>
        <App />
      </MotionPreferenceProvider>
    </LazyMotion>
    <Analytics />
    <SpeedInsights />
  </StrictMode>
);
