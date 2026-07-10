// New-order / service-request alert sounds, synthesized with WebAudio
// (no audio asset needed). Browsers block audio until the user interacts
// once — call unlockAudio() from a pointerdown listener to satisfy the
// autoplay policy.

let ctx = null;

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    /* no audio support — alerts still show as toasts */
  }
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

// Food order: two quick ascending bell tones (A5 → E6), like a till opening
export function playOrderChime()   { playTones([[880, 0], [1318.5, 0.12]], 'triangle'); }

// Service request: doorbell "ding-dong" (E6 → C6)
export function playServiceChime() { playTones([[1318.5, 0], [1046.5, 0.18]], 'sine'); }
