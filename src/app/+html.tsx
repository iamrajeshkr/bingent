import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Custom HTML document for the web build. Injects global styles that make the
// browser behave like a native app shell — no text selection, no pull-to-refresh,
// no pinch zoom, no tap-highlight, no context menus on long-press, no scrollbars.

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        {/* PWA / home-screen app hints */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Bingent" />
        <meta name="theme-color" content="#F8F4EB" />

        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const GLOBAL_CSS = `
/* ── App-like shell ────────────────────────────────────────────────────── */
html, body, #root {
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;          /* the app manages its own scroll */
  background-color: #F8F4EB; /* matches colors.bg */
}

/* Kill browser text selection everywhere (app text isn't selectable) */
* {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;
}

/* Re-enable selection only for actual text inputs */
input, textarea, [contenteditable="true"] {
  -webkit-user-select: text;
  -moz-user-select: text;
  -ms-user-select: text;
  user-select: text;
}

/* Prevent pull-to-refresh & overscroll bounce */
body {
  overscroll-behavior: none;
  -webkit-overflow-scrolling: touch;
}

/* Suppress the blue/grey tap highlight on mobile browsers */
* {
  -webkit-tap-highlight-color: transparent;
}

/* Suppress long-press context menu (image save, copy, etc.) */
* {
  -webkit-touch-callout: none;
}

/* Hide scrollbars everywhere (native apps don't show them) */
::-webkit-scrollbar {
  display: none;
}
* {
  scrollbar-width: none;       /* Firefox */
  -ms-overflow-style: none;    /* IE/Edge */
}

/* Prevent iOS Safari from auto-resizing text on rotation */
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

/* Smooth momentum scrolling for all scrollable containers */
[data-testid] {
  -webkit-overflow-scrolling: touch;
}

/* Disable double-tap zoom on interactive elements */
button, a, [role="button"] {
  touch-action: manipulation;
}
`;
