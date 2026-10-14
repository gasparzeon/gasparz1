'use client';

import Script from 'next/script';

interface PlausibleAnalyticsProps {
  domain?: string;
  // Endereço do script (Plausible próprio ou o plausible.io).
  src?: string;
}

export function PlausibleAnalytics({
  domain,
  src = 'https://plausible.io/js/script.js',
}: PlausibleAnalyticsProps) {
  // Skip if no domain is configured
  if (!domain) return null;

  return <Script defer data-domain={domain} src={src} strategy="afterInteractive" />;
}

// Helper function to track custom events
export function trackEvent(eventName: string, props?: Record<string, string | number | boolean>) {
  if (typeof window !== 'undefined' && 'plausible' in window) {
    const plausible = window.plausible as (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;

    plausible(eventName, { props });
  }
}

// Declare plausible on window for TypeScript
declare global {
  interface Window {
    plausible?: (
      event: string,
      options?: { props?: Record<string, string | number | boolean> },
    ) => void;
  }
}
