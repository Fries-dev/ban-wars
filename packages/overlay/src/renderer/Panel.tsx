import { useEffect, useState, type ReactNode } from 'react';
import type { TeamId } from '@banwars/shared';
import { useBw, useNow } from './useBw';
import BanPicker from './BanPicker';

type Screen = 'home' | 'create' | 'code' | 'join' | 'signin' | 'settings';

const css = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#4a4a4a;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#fff;user-select:none}
.app{position:relative;height:100vh;overflow:hidden;background:#7d7d7d}
.c{position:absolute;border-radius:50%}
.c1{width:190px;height:190px;left:-60px;top:-60px;background:#8e8c89}
.c2{width:260px;height:260px;left:-140px;top:120px;background:#4b4b4b}
.c3{width:230px;height:230px;right:-90px;top:-30px;background:#908e8b}
.c4{width:240px;height:240px;right:-140px;top:190px;background:#a09d9a}
.c5{width:300px;height:300px;right:-130px;top:330px;background:#3f3f3f}
.c6{width:220px;height:220px;left:-90px;bottom:-70px;background:#6a6a6a}
.c7{width:300px;height:300px;right:-60px;bottom:-190px;background:#5c5c5c}
.content{position:relative;z-index:1;height:100%;display:flex;flex-direction:column;align-items:center;padding:28px 24px;overflow-y:auto}
.profile{position:absolute;z-index:3;top:14px;right:14px;background:none;border:0;padding:0;cursor:pointer}
.offline{position:absolute;z-index:4;left:0;right:0;bottom:0;background:#c0392b;color:#fff;font-size:13px;font-weight:600;text-align:center;padding:8px}
.logo{position:relative;width:160px;height:160px;border-radius:26px;background:linear-gradient(135deg,#8a8a8a,#5a5a5a);border:7px solid #636363;display:flex;align-items:center;justify-content:center;overflow:hidden;margin-top:18px;flex:none;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),0 10px 20px rgba(0,0,0,.22)}
.logo::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 30% 25%,rgba(255,255,255,.35),transparent 35%),linear-gradient(135deg,rgba(255,255,255,.18),transparent 50%)}
.logo-monogram{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:112px;height:112px;border:4px solid rgba(255,255,255,.8);border-radius:50%;color:#fff;font-size:54px;font-weight:1000;letter-spacing:-.12em;text-indent:-.12em;text-shadow:0 4px 8px rgba(0,0,0,.35);box-shadow:0 0 0 8px rgba(0,0,0,.12),inset 0 0 0 2px rgba(0,0,0,.12)}
.stack{display:flex;flex-direction:column;align-items:center;gap:26px;margin-top:56px}
.btn{width:150px;padding:9px 0;border-radius:10px;border:3px solid;font:inherit;font-size:21px;font-weight:800;color:#fff;text-shadow:0 2px 2px rgba(0,0,0,.35);cursor:pointer;box-shadow:0 3px 6px rgba(0,0,0,.25)}
.btn:active{transform:translateY(1px)} .btn:disabled{opacity:.55;cursor:default}
.green{background:linear-gradient(#72d672,#45b245);border-color:#9cf09c #1e9a1e #1e9a1e #9cf09c}
.gold{background:linear-gradient(#e8b45e,#d6953a);border-color:#f7dc92 #c49a3e #c49a3e #f7dc92}
.grey{background:#8b8b8b;color:#c4c4c4;border-color:#9d9d9d;text-shadow:none}
.small{width:auto;padding:7px 14px;font-size:14px;border-radius:8px}
.back{align-self:flex-start;background:none;border:0;color:#fff;font:inherit;font-size:16px;font-weight:700;cursor:pointer;padding:4px 0;margin-bottom:6px}
h2{margin:12px 0 4px;font-size:26px;font-weight:800;text-shadow:0 2px 2px rgba(0,0,0,.3)}
.sub{color:#e3e3e3;font-size:13px;margin-bottom:10px;text-align:center}
.panel{width:100%;background:rgba(0,0,0,.28);border:2px solid rgba(255,255,255,.18);border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;margin-top:10px}
input[type=text],input:not([type]),input[type=number],select{width:100%;background:rgba(255,255,255,.92);color:#222;border:3px solid #636363;border-radius:10px;padding:10px 12px;font:inherit;font-size:17px;font-weight:600;outline:none}
.codein{text-align:center;letter-spacing:.2em;font-size:26px;font-weight:800;text-transform:uppercase}
.label{font-size:12px;font-weight:700;letter-spacing:.1em;color:#ececec}
.teams{display:flex;gap:10px}
.team{flex:1;padding:12px 0;border-radius:10px;border:3px solid #636363;background:rgba(255,255,255,.18);color:#fff;font:inherit;font-size:17px;font-weight:800;cursor:pointer}
.team.on.A{background:#e0a23b;border-color:#f7dc92} .team.on.B{background:#4a8fd8;border-color:#a8d0ff}
.err{width:100%;background:rgba(192,57,43,.9);border-radius:8px;padding:8px 10px;font-size:13px;font-weight:600;margin-top:10px}
.row{display:flex;gap:8px;align-items:center} .row>*{flex:1}
.code{font-size:34px;font-weight:900;letter-spacing:.18em;text-align:center}
.pl{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.15);font-size:15px;font-weight:600}
.tm{font-weight:900;padding:0 8px} .tm.A{color:#ffd37a} .tm.B{color:#9cc9ff}
.muted{color:#e3e3e3;font-size:12px}
.chk{display:flex;justify-content:space-between;align-items:center;font-size:14px;font-weight:600} .chk input{width:auto}
`;

const Profile = () => (
  <svg viewBox="0 0 48 48" width="40" height="40">
    <circle cx="24" cy="24" r="22" fill="#2b2b2b" />
    <circle cx="24" cy="19" r="7" fill="#7d7d7d" />
    <path d="M10 38c2-8 8-11 14-11s12 3 14 11a21 21 0 0 1-28 0z" fill="#7d7d7d" />
  </svg>
);

function Logo() {
  return (
    <div className="logo" aria-label="Ban Wars logo">
      <div className="logo-monogram" aria-hidden="true">BW</div>
    </div>
  );
}

function Shell({ children, online, onProfile }: { children: ReactNode; online: boolean; onProfile?: () => void }) {
  return (
    <div className="app"><style>{css}</style>
      {['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((c) => <div key={c} className={`c ${c}`} />)}
      {onProfile && <button className="profile" onClick={onProfile} title="Profile & settings"><Profile /></button>}
      <div className="content">{children}</div>
      {!online && <div className="offline">Server offline. Start it with: npm run dev:server</div>}
    </div>
  );
}

function TeamPicker({ team, setTeam }: { team: TeamId; setTeam: (t: TeamId) => void }) {
  return (
    <>
      <div className="label">YOUR TEAM</div>
      <div className="teams">
        {(['A', 'B'] as TeamId[]).map((t) => (
          <button key={t} className={`team ${t} ${team === t ? 'on' : ''}`} onClick={() => setTeam(t)}>TEAM {t}</button>
        ))}
      </div>
    </>
  );
}

export default function Panel() {
  const { party, me, prefs, setPrefs, online, offset } = useBw();
  const now = useNow();
  const [myVote, setMyVote] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [nick, setNick] = useState(localStorage.getItem('bw.nick') ?? '');
  const [team, setTeam] = useState<TeamId>('A');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [score, setScore] = useState<[number, number]>([7, 0]);
  const [displays, setDisplays] = useState<Awaited<ReturnType<typeof window.bw.displays>>>([]);
  useEffect(() => { window.bw.displays().then(setDisplays); }, []);

  const saveNick = (v: string) => { setNick(v); localStorage.setItem('bw.nick', v); };
  const go = (s: Screen) => { setErr(''); setScreen(s); };
  const call = async (ev: string, payload: object = {}) => {
    const r = await window.bw.emit(ev, payload);
    setErr(r.ok ? '' : r.error ?? 'Something went wrong');
    return r;
  };
  const pref = (k: string, v: string) => {
    localStorage.setItem(k, v);
    setPrefs({ scale: Number(localStorage.getItem('bw.scale') ?? 1), colorblind: localStorage.getItem('bw.cb') === '1', mute: localStorage.getItem('bw.mute') === '1' });
  };

  const doCreate = async () => {
    if (!nick.trim()) return setErr('Enter your name first');
    setBusy(true);
    const r = await call('party:create', { nick });
    if (r.ok && team === 'B') await call('party:setTeam', { team: 'B' });
    setBusy(false);
  };
  const doJoin = async () => {
    if (!nick.trim()) return setErr('Enter your name first');
    setBusy(true);
    const r = await call('party:join', { code, nick });
    if (r.ok && r.role !== 'spectator') await call('party:setTeam', { team });
    setBusy(false);
  };

  const self = party?.players.find((p) => p.id === me);
  const isHost = !!party && party.hostId === me;
  const vote = party?.vote ?? null;
  const iVote = !!vote && self?.role === 'player' && self.team === vote.winner;
  const secs = vote ? Math.max(0, Math.ceil((vote.deadline - (now + offset)) / 1000)) : 0;
  useEffect(() => { if (!vote) setMyVote(null); }, [!!vote]);
  const pick = async (banId: string) => { const r = await call('vote:cast', { banId }); if (r.ok) setMyVote(banId); };

  // ---------- settings (reachable from the profile icon) ----------
  if (screen === 'settings')
    return (
      <Shell online={online}>
        <button className="back" onClick={() => go('home')}>‹ Back</button>
        <h2>Settings</h2>
        <div className="panel">
          <div className="label">GAME MONITOR</div>
          <select defaultValue={displays.find((d) => d.selected)?.id} onChange={(e) => window.bw.setDisplay(+e.target.value)}>
            {displays.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <div className="label">UI SCALE {prefs.scale.toFixed(1)}×</div>
          <input type="range" min={0.7} max={1.8} step={0.1} value={prefs.scale} onChange={(e) => pref('bw.scale', e.target.value)} />
          <label className="chk">High-contrast colorblind mode<input type="checkbox" checked={prefs.colorblind} onChange={(e) => pref('bw.cb', e.target.checked ? '1' : '0')} /></label>
          <label className="chk">Mute sound cues<input type="checkbox" checked={prefs.mute} onChange={(e) => pref('bw.mute', e.target.checked ? '1' : '0')} /></label>
          <div className="muted">Run Siege in borderless windowed mode or the overlay can't draw on top. F10 toggles click-through.</div>
        </div>
      </Shell>
    );

  // ---------- in a party: lobby ----------
  if (party)
    return (
      <Shell online={online} onProfile={() => go('settings')}>
        <h2 style={{ marginTop: 34 }}>{party.tier === 'premium' ? 'Premium Party' : 'Party'}</h2>
        <div className="panel" style={{ marginTop: 4 }}>
          <div className="code">{party.code}</div>
          <div className="muted" style={{ textAlign: 'center' }}>
            {party.phase.toUpperCase()} · Match #{party.matchNo + 1}
            {party.lastResult && ` · Last: Team ${party.lastResult.winner} ${party.lastResult.score.join('-')}${party.lastResult.mercy ? ' (MERCY)' : ''}`}
          </div>
          {self?.role === 'player' && (
            <div className="teams">
              {(['A', 'B'] as TeamId[]).map((t) => (
                <button key={t} className={`team ${t} ${self.team === t ? 'on' : ''}`} onClick={() => call('party:setTeam', { team: t })}>TEAM {t}</button>
              ))}
            </div>
          )}
          {self?.role === 'spectator' && <div className="muted">Party is full. You are spectating.</div>}
        </div>
        {err && <div className="err">{err}</div>}

        {vote && (
          <div className="panel">
            <div className="label">{iVote ? `PICK ONE BAN FOR TEAM ${vote.winner === 'A' ? 'B' : 'A'} · ${secs}s` : `WINNERS ARE CHOOSING YOUR BAN · ${secs}s`}</div>
            {iVote
              ? <BanPicker catalog={vote.catalog} availableBanIds={vote.availableBanIds} tally={vote.tally} myVote={myVote} onPick={pick} />
              : <div className="muted">Votes in: {vote.votesIn}/{vote.votesNeeded}</div>}
          </div>
        )}

        <div className="panel">
          <div className="label">PLAYERS ({party.players.length})</div>
          {party.players.map((p) => (
            <div className="pl" key={p.id} style={{ opacity: p.connected ? 1 : 0.5 }}>
              <span>{p.nick}{p.id === party.hostId && ' ★'}{p.role === 'spectator' && ' (spec)'}</span>
              <span><span className={`tm ${p.team}`}>{p.team ?? '–'}</span>
                {isHost && p.id !== me && <button className="btn gold small" onClick={() => call('party:kick', { playerId: p.id })}>Kick</button>}</span>
            </div>
          ))}
        </div>

        {isHost && (
          <div className="panel">
            <div className="label">HOST CONTROLS</div>
            <div className="row">
              <button className="btn green small" disabled={party.phase === 'voting'} onClick={() => call('match:start')}>Start Match</button>
              <button className="btn gold small" onClick={() => call('party:reset')}>Reset</button>
            </div>
            {party.phase === 'inMatch' && (
              <>
                <div className="label">FINAL SCORE (TEAM A – TEAM B)</div>
                <div className="row">
                  <input type="number" min={0} value={score[0]} onChange={(e) => setScore([+e.target.value, score[1]])} />
                  <input type="number" min={0} value={score[1]} onChange={(e) => setScore([score[0], +e.target.value])} />
                </div>
                <div className="row">
                  <button className="btn green small" onClick={() => call('match:result', { winner: 'A', score })}>Team A won</button>
                  <button className="btn green small" onClick={() => call('match:result', { winner: 'B', score })}>Team B won</button>
                </div>
              </>
            )}
            <div className="row">
              <div><div className="label">MERCY MARGIN</div><input type="number" min={1} max={13} value={party.settings.mercyMargin} onChange={(e) => call('party:settings', { mercyMargin: +e.target.value })} /></div>
              <div><div className="label">VOTE SECONDS</div><input type="number" min={5} max={60} value={party.settings.voteSeconds} onChange={(e) => call('party:settings', { voteSeconds: +e.target.value })} /></div>
            </div>
            <button className="btn grey small" disabled>Custom Rules (Premium)</button>
          </div>
        )}
        <button className="btn gold small" style={{ margin: '14px 0 40px' }} onClick={async () => { await call('party:leave'); go('home'); }}>Leave Party</button>
      </Shell>
    );

  // ---------- not in a party ----------
  const logo = <Logo />;
  return (
    <Shell online={online} onProfile={() => go('settings')}>
      {screen === 'home' && (
        <>
          {logo}
          <div className="stack">
            <button className="btn green" onClick={() => go('create')}>Create Party</button>
            <button className="btn gold" onClick={() => go('signin')}>Sign-In</button>
            <button className="btn grey" onClick={() => go('code')}>Input-Code</button>
          </div>
        </>
      )}

      {screen === 'create' && (
        <>
          <button className="back" onClick={() => go('home')}>‹ Back</button>
          {logo}
          <div className="panel">
            <div className="label">YOUR NAME</div>
            <input type="text" placeholder="Name" maxLength={16} value={nick} onChange={(e) => saveNick(e.target.value)} />
            <TeamPicker team={team} setTeam={setTeam} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn green" style={{ marginTop: 18 }} disabled={busy} onClick={doCreate}>{busy ? '...' : 'Create'}</button>
        </>
      )}

      {screen === 'code' && (
        <>
          <button className="back" onClick={() => go('home')}>‹ Back</button>
          {logo}
          <h2>Input Code</h2>
          <div className="panel">
            <input className="codein" type="text" placeholder="BW-XXXX" maxLength={7} value={code} autoFocus
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && code.trim() && go('join')} />
          </div>
          <button className="btn gold" style={{ marginTop: 18 }} disabled={!code.trim()} onClick={() => go('join')}>Next</button>
        </>
      )}

      {screen === 'join' && (
        <>
          <button className="back" onClick={() => go('code')}>‹ Back</button>
          <h2>Join {code}</h2>
          <div className="sub">Enter your name and pick your team</div>
          <div className="panel">
            <div className="label">YOUR NAME</div>
            <input type="text" placeholder="Name" maxLength={16} value={nick} onChange={(e) => saveNick(e.target.value)} />
            <TeamPicker team={team} setTeam={setTeam} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn green" style={{ marginTop: 18 }} disabled={busy} onClick={doJoin}>{busy ? '...' : 'Join'}</button>
        </>
      )}

      {screen === 'signin' && (
        <>
          <button className="back" onClick={() => go('home')}>‹ Back</button>
          {logo}
          <div className="panel">
            <div className="label">NICKNAME</div>
            <input type="text" placeholder="Name" maxLength={16} value={nick} onChange={(e) => saveNick(e.target.value)} />
            <button className="btn grey small" disabled>Discord (soon)</button>
            <button className="btn grey small" disabled>Steam (soon)</button>
            <button className="btn grey small" disabled>Ubisoft (soon)</button>
          </div>
          <button className="btn gold" style={{ marginTop: 18 }} onClick={() => go('home')}>Save</button>
        </>
      )}
    </Shell>
  );
}
