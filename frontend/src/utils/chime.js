// New-order / service-request alert sounds, synthesized with WebAudio
// (no audio asset needed). Browsers block audio until the user interacts
// once — call unlockAudio() from a pointerdown listener to satisfy the
// autoplay policy.

let ctx = null;

// Custom notification sound — the same file the Android app uses, bundled as a
// web asset (frontend/public/stayxpulse_alert.mp3). Played for new orders and
// service requests so web + in-app foreground match the phone's push sound.
// Falls back to the synth tones below if it can't play.
let alertEl = null;
let alertPrimed = false;

function getAlertEl() {
  if (alertEl) return alertEl;
  try {
    alertEl = new Audio('/stayxpulse_alert.mp3');
    alertEl.preload = 'auto';
    alertEl.volume = 1.0;
  } catch { alertEl = null; }
  return alertEl;
}

// Play the custom sound. Returns true if playback was started (so callers can
// skip the synth fallback).
function playAlertSound() {
  const el = getAlertEl();
  if (!el) return false;
  try {
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    return true;
  } catch { return false; }
}

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    /* no audio support — alerts still show as toasts */
  }
  // Prime the custom sound on this user gesture so it can play later without
  // being blocked by the browser autoplay policy.
  try {
    const el = getAlertEl();
    if (el && !alertPrimed) {
      alertPrimed = true;
      el.muted = true;
      const p = el.play();
      const reset = () => { try { el.pause(); el.currentTime = 0; el.muted = false; } catch {} };
      if (p && typeof p.then === 'function') p.then(reset).catch(() => { el.muted = false; });
      else reset();
    }
  } catch { /* fall back to synth tones */ }
}

function playTones(tones, type) {
  try {
    if (!ctx) unlockAudio();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    tones.forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.35, now + delay + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.6);
    });
  } catch {
    /* never let a sound failure break the app */
  }
}

// Food order + service request: play the custom notification sound; if it
// can't play (autoplay blocked / not yet loaded), fall back to the synth tones.
export function playOrderChime()   { if (!playAlertSound()) playTones([[880, 0], [1318.5, 0.12]], 'triangle'); }

export function playServiceChime() { if (!playAlertSound()) playTones([[1318.5, 0], [1046.5, 0.18]], 'sine'); }

// Wake-up reminder: an urgent alarm-clock pattern — two bursts of three sharp
// high beeps (beep-beep-beep … beep-beep-beep). Louder, tighter and more
// insistent than the other alerts so staff can't miss it.
export function playWakeAlarm() {
  try {
    if (!ctx) unlockAudio();
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const beeps = [];
    // two bursts, 0.85s apart; each burst = 3 quick beeps at G6
    [0, 0.85].forEach((burst) => {
      [0, 0.16, 0.32].forEach((d) => beeps.push(burst + d));
    });
    beeps.forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';                 // piercing, alarm-like
      osc.frequency.value = 1568;          // G6
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.42, now + delay + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.13);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.15);
    });
  } catch {
    /* never let a sound failure break the app */
  }
}
