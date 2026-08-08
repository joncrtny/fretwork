/* ============================================================
   AUDIO: Karplus-Strong plucked string, metronome clicks, quiz blips.
   A single shared AudioContext, created lazily and resumed on demand so it
   only starts after a user gesture.
   ============================================================ */

let audioCtx = null;
export function ctx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

export function pluck(midi, when = 0, gain = 0.5) {
  if (!Number.isFinite(midi)) return;
  const ac = ctx();
  if (!ac) return;
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const sr = ac.sampleRate;
  const N = Math.max(2, Math.round(sr / freq));
  const len = Math.floor(sr * 2.2);
  const buf = ac.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
  const damp = 0.996 - Math.min(0.004, freq / 200000);
  for (let i = N; i < len; i++) d[i] = damp * 0.5 * (d[i - N] + d[i - N + 1]);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const lp = ac.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = Math.min(7000, freq * 12);
  const g = ac.createGain();
  const t = ac.currentTime + when;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.setTargetAtTime(0.0001, t + 1.0, 0.45);
  src.connect(lp).connect(g).connect(ac.destination);
  src.start(t);
  src.stop(t + 2.2);
}

let noiseBuf = null;
function noise() {
  const ac = ctx();
  if (!ac) return null;
  if (!noiseBuf || noiseBuf.sampleRate !== ac.sampleRate) {
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.2), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

export function playClick(kind, at, accent, level = 0.7, dest = null) {
  const ac = ctx();
  if (!ac) return;
  const t = Math.max(at, ac.currentTime);
  const g = ac.createGain();
  g.connect(dest || ac.destination);
  const amp = level * (accent ? 1 : 0.55);

  if (kind === "beep" || kind === "woodblock") {
    const o = ac.createOscillator();
    o.type = kind === "beep" ? "sine" : "triangle";
    const f = kind === "beep" ? (accent ? 1600 : 1000) : accent ? 1250 : 900;
    o.frequency.setValueAtTime(f, t);
    if (kind === "woodblock") o.frequency.exponentialRampToValueAtTime(f * 0.72, t + 0.03);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "beep" ? 0.06 : 0.045));
    o.connect(g);
    o.start(t);
    o.stop(t + 0.1);
    return;
  }

  const buf = noise();
  if (!buf) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  if (kind === "rim") {
    f.type = "bandpass";
    f.frequency.value = accent ? 3200 : 2400;
    f.Q.value = 9;
  } else {
    f.type = "highpass";
    f.frequency.value = accent ? 3000 : 2000;
  }
  const dur = kind === "rim" ? 0.02 : 0.028;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(amp * 0.9, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g);
  src.start(t);
  src.stop(t + 0.12);
}

export function blip(ok) {
  const ac = ctx();
  if (!ac) return;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = ok ? "triangle" : "sawtooth";
  o.frequency.value = ok ? 880 : 150;
  const t = ac.currentTime;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.09, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.18 : 0.26));
  o.connect(g).connect(ac.destination);
  o.start(t);
  o.stop(t + 0.3);
}
