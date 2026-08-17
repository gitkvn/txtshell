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
