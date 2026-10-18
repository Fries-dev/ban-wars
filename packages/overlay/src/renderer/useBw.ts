import { useEffect, useState } from 'react';
import type { PartyView } from '@banwars/shared';

export const readPrefs = () => ({
  scale: Number(localStorage.getItem('bw.scale') ?? 1),
  colorblind: localStorage.getItem('bw.cb') === '1',
  mute: localStorage.getItem('bw.mute') === '1',
});

export function useBw() {
  const [party, setParty] = useState<PartyView | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);            // serverNow - localNow, keeps countdowns fair
  const [interactive, setInteractive] = useState(false);
  const [online, setOnline] = useState(false);
  const [prefs, setPrefs] = useState(readPrefs);

  useEffect(() => {
    const apply = (s: PartyView | null) => { setParty(s); if (s) setOffset(s.serverNow - Date.now()); };
    window.bw.getState().then(apply);
    window.bw.getConn().then(setOnline);
    window.bw.getSession().then((s) => setMe(s?.playerId ?? null));
    const offs = [
      window.bw.onState(apply),
      window.bw.onSession((s) => { setMe(s?.playerId ?? null); if (!s) setParty(null); }),
      window.bw.onInteractive(setInteractive),
      window.bw.onConn(setOnline),
    ];
    const onStorage = () => setPrefs(readPrefs());
    window.addEventListener('storage', onStorage);
    return () => { offs.forEach((f) => f()); window.removeEventListener('storage', onStorage); };
  }, []);

  return { party, me, offset, interactive, prefs, setPrefs, online };
}

export function useNow(ms = 250) {
  const [n, setN] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setN(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return n;
}
