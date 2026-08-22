// Loaded synchronously in <head> so the first-visit decision is made before
// first paint: first-timers never flash the editor, returning users never
// flash the intro. Inline scripts are blocked by CSP (script-src 'self'),
// which is why this lives in its own file. The key must match INTRO_KEY in
// app.js, which owns dismissal and the /about replay path.
(() => {
  try {
    if (!window.localStorage.getItem("txtshell-intro-seen-v1")) {
      document.documentElement.classList.add("show-intro");
    }
  } catch {
    // Storage unavailable -> skip the intro rather than trap the user in it.
  }
})();

// iOS Safari zooms the page when a field under 16px is focused (the 14px
// composer, the find/modal/vault inputs) and keeps that zoom after blur, which
// pushes the layout off the right edge and breaks the keyboard-float math.
// maximum-scale=1 stops the focus-zoom; since iOS 10 Safari ignores it for
// pinch-zoom, so accessibility zoom is unaffected. Applied on iOS only because
// Android Chrome would honour it and lose pinch-zoom. iPadOS reports as
// MacIntel, hence the touch-points check; desktop Macs report 0 and skip.
(() => {
  try {
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.platform) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const viewport = document.querySelector('meta[name="viewport"]');
    if (isIOS && viewport && !/maximum-scale/.test(viewport.content)) {
      viewport.content += ", maximum-scale=1";
    }
  } catch {
    // Never let a platform quirk block the page.
  }
})();
