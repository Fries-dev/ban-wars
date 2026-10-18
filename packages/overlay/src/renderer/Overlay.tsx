import { useEffect, useRef, useState } from 'react';
import { useBw, useNow } from './useBw';
import { cue } from './sound';
import BanPicker from './BanPicker';
import './overlay.css';

type Toast = { id: number; text: string; kind: 'ban' | 'unban' };

export default function Overlay() {
  const { party, me, offset, interactive, prefs } = useBw();
  const now = useNow();
  const [toast, setToast] = useState<Toast | null>(null);
  const toastId = useRef(0);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => JSON.parse(localStorage.getItem('bw.pos') ?? '{"x":0,"y":0}'));
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const myTeam = party?.players.find((p) => p.id === me)?.team ?? null;
  const teamRef = useRef(myTeam);
  teamRef.current = myTeam;

  const show = (text: string, kind: Toast['kind']) => setToast({ id: ++toastId.current, text, kind });

  // Only YOUR team's ban changes are announced.
  useEffect(() => window.bw.onEvent(({ name, payload }) => {
    if (name === 'toast') return show(payload.message, 'unban');
    if (payload?.team !== teamRef.current) return;
    if (name === 'ban:applied') { show(`NEW BAN: ${payload.bans[0]?.label ?? ''}`.toUpperCase(), 'ban'); cue('ban'); }
    else if (name === 'ban:removed') { show(`UNBANNED: ${payload.ban.label}`, 'unban'); cue('unban'); }
  }), []);

  // Keyed on the toast id (not the clock), so it shows once and fades out.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast?.id]);

  useEffect(() => { if (!party?.vote) setMyVote(null); }, [!!party?.vote]);

  if (!party || !me) return null;

  const mine = myTeam ? party.bans[myTeam] : [];
  const vote = party.vote;
  const iVote = !!vote && myTeam === vote.winner && party.players.find((p) => p.id === me)?.role === 'player';
  const secs = vote ? Math.max(0, Math.ceil((vote.deadline - (now + offset)) / 1000)) : 0;
  const pick = async (banId: string) => { const r = await window.bw.emit('vote:cast', { banId }); if (r.ok) setMyVote(banId); };
  const canMercy = interactive && party.mercyTeam === myTeam && mine.length > 0;

  const onDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    setPos({ x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) });
  };
  const onUp = () => { drag.current = null; localStorage.setItem('bw.pos', JSON.stringify(pos)); };

  return (
    <div className="stage" data-cb={prefs.colorblind ? '1' : '0'} style={{ ['--ui' as any]: prefs.scale }}>
      <div className="wrap" style={{ transform: `translate(calc(-50% + ${pos.x}px), ${pos.y}px) scale(var(--ui))` }}>
        <div className={`hud ${interactive ? 'interactive' : ''}`}>
          <div className="grip" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
            <span className="tag">{party.phase === 'inMatch' ? 'ACTIVE' : 'NEXT MATCH'}</span>
            <span className="title">{myTeam ? 'YOU CANNOT' : 'PICK A TEAM'}</span>
            {interactive && <span className="hint">DRAG · F10 TO LOCK</span>}
          </div>

          {myTeam && (
            <div className="chips">
              {mine.length === 0 && <span className="empty">No restrictions</span>}
              {mine.map((b) => (
                <button key={b.id} className="chip" disabled={!canMercy}
                  onClick={() => canMercy && window.bw.emit('mercy:unban', { banId: b.id })}
                  title={canMercy ? 'Mercy: click to remove this ban' : b.label}>
                  {b.label}{canMercy && <em>UNBAN</em>}
                </button>
              ))}
            </div>
          )}
          {party.mercyTeam === myTeam && mine.length > 0 && (
            <div className="mercy">MERCY RULE: {interactive ? 'click a ban to remove it' : 'press F10, then pick one ban to remove'}</div>
          )}

          {vote && (
            <div className="vote">
              <div className="vhead">
                <span>{iVote ? 'Pick ONE ban for the losers' : 'Winners are choosing your ban…'}</span>
                <b>{secs}s</b>
              </div>
              {iVote && (
                <>
                  <BanPicker catalog={vote.catalog} availableBanIds={vote.availableBanIds} tally={vote.tally} myVote={myVote}
                    disabled={!interactive} onPick={pick} />
                  {!interactive && <div className="hint" style={{ marginTop: 6, textAlign: 'center' }}>Press F10 to pick here, or pick in the Ban Wars window</div>}
                </>
              )}
              <div className="bar"><div style={{ width: `${(secs / party.settings.voteSeconds) * 100}%` }} /></div>
            </div>
          )}
        </div>

        {toast && <div className={`toast ${toast.kind}`} key={toast.id}>{toast.text}</div>}
      </div>
    </div>
  );
}
