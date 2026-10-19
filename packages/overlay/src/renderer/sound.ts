let ctx: AudioContext | undefined;
/** Tiny synthesized cues so we ship no audio assets. */
export function cue(kind: 'ban' | 'unban' | 'vote') {
  if (localStorage.getItem('bw.mute') === '1') return;
  ctx ??= new AudioContext();
  const audio = ctx;
  if (audio.state === 'suspended') void audio.resume().catch((error: unknown) => console.error('Could not resume sound cues:', error));
  const t = ctx.currentTime;
  const storedVolume = Number(localStorage.getItem('bw.volume') ?? 0.6);
  const volume = Number.isFinite(storedVolume) ? Math.min(1, Math.max(0, storedVolume)) : 0.6;
  const tones = kind === 'vote' ? [660, 880] : [kind === 'ban' ? 180 : 520];
  tones.forEach((frequency, index) => {
    const start = t + index * 0.11;
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(frequency, start);
    o.frequency.exponentialRampToValueAtTime(kind === 'ban' ? 90 : frequency * 1.4, start + 0.2);
    g.gain.setValueAtTime(0.05 * volume, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.25);
    o.connect(g).connect(audio.destination);
    o.start(start); o.stop(start + 0.25);
  });
}
