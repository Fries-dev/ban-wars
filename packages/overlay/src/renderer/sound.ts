let ctx: AudioContext | undefined;
/** Tiny synthesized cues so we ship no audio assets. */
export function cue(kind: 'ban' | 'unban') {
  if (localStorage.getItem('bw.mute') === '1') return;
  ctx ??= new AudioContext();
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(kind === 'ban' ? 180 : 520, t);
  o.frequency.exponentialRampToValueAtTime(kind === 'ban' ? 90 : 880, t + 0.25);
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.3);
}
