import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Provider } from '@supabase/supabase-js';
import type { TeamId } from '@banwars/shared';
import { cue } from './sound';
import { readPrefs, useBw } from './useBw';
import { supabase } from './auth';

type Screen = 'home' | 'create' | 'code' | 'join' | 'signin' | 'profile' | 'settings';

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
input[type=text],input[type=email],input[type=password],input:not([type]),input[type=number],select{width:100%;background:rgba(255,255,255,.92);color:#222;border:3px solid #636363;border-radius:10px;padding:10px 12px;font:inherit;font-size:17px;font-weight:600;outline:none}
.codein{text-align:center;letter-spacing:.2em;font-size:26px;font-weight:800;text-transform:uppercase}
.label{font-size:12px;font-weight:700;letter-spacing:.1em;color:#ececec}
.teams{display:flex;gap:10px}
.team{flex:1;padding:12px 0;border-radius:10px;border:3px solid #636363;background:rgba(255,255,255,.18);color:#fff;font:inherit;font-size:17px;font-weight:800;cursor:pointer}
.team.on.A{background:#e0a23b;border-color:#f7dc92} .team.on.B{background:#4a8fd8;border-color:#a8d0ff}
.err{width:100%;background:rgba(192,57,43,.9);border-radius:8px;padding:8px 10px;font-size:13px;font-weight:600;margin-top:10px}
.row{display:flex;gap:8px;align-items:center} .row>*{flex:1}
.code{font-size:34px;font-weight:900;letter-spacing:.18em;text-align:center}
.code-copy{width:100%;padding:4px 8px;background:none;border:0;color:inherit;font:inherit;cursor:pointer}
.code-copy:hover{color:#ffe0a3}
.copy-hint{font-size:12px;font-weight:600;text-align:center;color:#e3e3e3}
.invite-share{width:100%}
.history-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.15);font-size:13px}
.history-row:last-child{border-bottom:0}
.history-result{font-weight:800}
.ready-state{font-size:11px;font-weight:800;letter-spacing:.04em}
.ready-state.yes{color:#a8f0a8}
.ready-state.no{color:#ffd37a}
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
      <div className="logo-monogram" aria-hidden="true">BW
      </div>
    </div>
  );
}

function Shell({ children, online, everConnected, onProfile }: { children: ReactNode; online: boolean; everConnected: boolean; onProfile?: () => void }) {
  return (
    <div className="app"><style>{css}</style>
      {['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'].map((c) => <div key={c} className={`c ${c}`} />)}
      {onProfile && <button className="profile" onClick={onProfile} title="Profile & settings"><Profile /></button>}
      <div className="content">{children}</div>
      {!online && <div className="offline">{everConnected ? 'Connection lost. Reconnecting to your party…' : 'Connecting to the Ban Wars server…'}</div>}
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
  const { party, me, prefs, setPrefs, online, everConnected } = useBw();
  const [screen, setScreen] = useState<Screen>('home');
  const [nick, setNick] = useState(localStorage.getItem('bw.nick') ?? '');
  const [team, setTeam] = useState<TeamId>('A');
  const [code, setCode] = useState('');
  const [inviteCopied, setInviteCopied] = useState<string | false>(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [authLoaded, setAuthLoaded] = useState(!supabase);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const processedAuthCallbacks = useRef(new Set<string>());
  const score: [number, number] = [0, 0];
  const [displays, setDisplays] = useState<Awaited<ReturnType<typeof window.bw.displays>>>([]);
  useEffect(() => { window.bw.displays().then(setDisplays); }, []);
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const finishAuth = async (url: string) => {
      if (processedAuthCallbacks.current.has(url)) return;
      processedAuthCallbacks.current.add(url);
      const callback = new URL(url);
      const code = callback.searchParams.get('code');
      if (!code) {
        setErr(callback.searchParams.get('error_description') ?? callback.searchParams.get('error') ?? 'The sign-in link did not include an authorization code.');
        await window.bw.clearAuthCallback(url);
        return;
      }
      try {
        const { error } = await client.auth.exchangeCodeForSession(code);
        setErr(error ? error.message : 'Signed in successfully.');
      } catch (error) {
        setErr(error instanceof Error ? error.message : 'Could not complete sign-in.');
      } finally {
        await window.bw.clearAuthCallback(url);
      }
    };
    const unsubscribe = window.bw.onAuthCallback((url) => { void finishAuth(url); });
    void window.bw.getAuthCallback().then((url) => { if (url) void finishAuth(url); });
    void client.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error('Could not load account session:', error);
        setErr(error.message);
      }
      setAuthEmail(data.session?.user.email ?? null);
      setAuthLoaded(true);
    }).catch((error: unknown) => {
      console.error('Could not load account session:', error);
      setErr(error instanceof Error ? error.message : 'Could not load account session.');
      setAuthLoaded(true);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      setAuthEmail(session?.user.email ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setScreen('signin');
        setErr('Choose a new password for your account.');
      }
      setAuthLoaded(true);
    });
    return () => { unsubscribe(); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    const openInvite = (inviteCode: string) => {
      setCode(inviteCode);
      setErr('');
      setScreen('join');
      void window.bw.clearPendingPartyCode(inviteCode);
    };
    const unsubscribe = window.bw.onPartyInvite(openInvite);
    void window.bw.getPendingPartyCode().then((inviteCode) => {
      if (inviteCode) openInvite(inviteCode);
    }).catch((error: unknown) => {
      console.error('Could not load party invite:', error);
      setErr(error instanceof Error ? error.message : 'Could not load party invite.');
    });
    return unsubscribe;
  }, []);

  const saveNick = (v: string) => { setNick(v); localStorage.setItem('bw.nick', v); };
  const go = (s: Screen) => { setErr(''); setScreen(s); };
  const call = async (ev: string, payload: object = {}) => {
    const r = await window.bw.emit(ev, payload);
    setErr(r.ok ? '' : r.error ?? 'Something went wrong');
    return r;
  };
  const pref = (k: string, v: string) => {
    localStorage.setItem(k, v);
    setPrefs(readPrefs());
  };
  const copyInvite = async (text: string, feedback: string) => {
    try {
      await window.bw.copyText(text);
      setInviteCopied(feedback);
      window.setTimeout(() => setInviteCopied(false), 1800);
    } catch (error) {
      setErr(error instanceof Error ? `Could not copy text to clipboard: ${error.message}` : 'Could not copy text to clipboard.');
    }
  };
  const signInWithProvider = async (provider: Provider) => {
    if (!supabase) return setErr('Sign-in is not configured. Add the Supabase URL and anon key to packages/overlay/.env.');
    setBusy(true);
    setErr('');
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: 'banwars://auth/callback', skipBrowserRedirect: true },
      });
      if (error) setErr(error.message);
      else if (data.url) {
        const result = await window.bw.openAuthUrl(data.url);
        if (!result.ok) setErr(result.error ?? 'Could not open the sign-in page.');
      } else setErr('The sign-in provider did not return a URL.');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not start sign-in.');
    } finally {
      setBusy(false);
    }
  };
  const signInWithEmail = async () => {
    if (!supabase) return setErr('Sign-in is not configured. Add the Supabase URL and anon key to packages/overlay/.env.');
    setBusy(true);
    setErr('');
    try {
      const result = authMode === 'signUp'
        ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: 'banwars://auth/callback' } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) setErr(result.error.message);
      else if (authMode === 'signUp' && !result.data.session) setErr('Account created. Check your email to confirm your account.');
      else setErr(authMode === 'signUp' ? 'Account created and signed in.' : 'Signed in successfully.');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };
  const resendConfirmation = async () => {
    if (!supabase) return setErr('Sign-in is not configured.');
    if (!email.trim()) return setErr('Enter your email address first.');
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: 'banwars://auth/callback' } });
      setErr(error ? error.message : 'If this account still needs confirmation, a new email has been requested. Check your inbox and spam folder.');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not resend confirmation email.');
    } finally {
      setBusy(false);
    }
  };
  const requestPasswordReset = async () => {
    if (!supabase) return setErr('Sign-in is not configured.');
    if (!email.trim()) return setErr('Enter your email address first.');
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'banwars://auth/callback' });
      setErr(error ? error.message : 'If an account exists for that email, a password-reset link has been requested. Check your inbox and spam folder.');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not request a password reset.');
    } finally {
      setBusy(false);
    }
  };
  const updatePassword = async () => {
    if (!supabase) return setErr('Sign-in is not configured.');
    if (password.length < 8) return setErr('Use a password with at least 8 characters.');
    setBusy(true);
    setErr('');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) setErr(error.message);
      else {
        setPassword('');
        setPasswordRecovery(false);
        setErr('Password updated successfully.');
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not update password.');
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      setErr(error ? error.message : 'Signed out.');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Could not sign out.');
    } finally {
      setBusy(false);
    }
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
  const copyInviteLink = (inviteCode: string) => {
    const inviteUrl = new URL('/join', import.meta.env.VITE_BW_SERVER);
    inviteUrl.searchParams.set('code', inviteCode);
    return copyInvite(inviteUrl.toString(), 'Invite link copied!');
  };
  const copyMatchSummary = () => {
    const winsA = party?.history.filter((match) => match.winner === 'A').length ?? 0;
    const winsB = party?.history.filter((match) => match.winner === 'B').length ?? 0;
    const rows = party?.history.map((match) =>
      `Match ${match.matchNo}: Team ${match.winner} won ${match.score.join('-')}; Team ${match.bannedTeam} banned ${match.ban.label}${match.mercy ? ' (mercy)' : ''}`,
    ) ?? [];
    return copyInvite(
      [`Ban Wars party ${party?.code ?? ''} results`, `Team A ${winsA} - ${winsB} Team B`, ...rows].join('\n'),
      'Results copied!',
    );
  };
  const resetOverlayPosition = () => {
    void window.bw.resetOverlayPosition();
  };

  if (screen === 'profile')
    return (
      <Shell online={online} everConnected={everConnected}>
        <button className="back" onClick={() => go('home')}>‹ Back</button>
        <h2>Profile</h2>
        <div className="panel">
          <div className="label">ACCOUNT</div>
          {!supabase ? <div className="muted">Set up Supabase to enable accounts.</div>
            : !authLoaded ? <div className="muted">Loading account…</div>
              : authEmail ? (
                <>
                  <div className="muted">Signed in as {authEmail}</div>
                  <button className="btn grey small" disabled={busy} onClick={() => void signOut()}>{busy ? '...' : 'Sign Out'}</button>
                </>
              ) : (
                <>
                  <div className="muted">Not signed in</div>
                  <button className="btn gold small" onClick={() => go('signin')}>Sign In or Create Account</button>
                </>
              )}
          <div className="label">PLAYER NAME</div>
          <input type="text" placeholder="Name" maxLength={16} value={nick} onChange={(e) => saveNick(e.target.value)} />
          <div className="muted">This name appears to other players in your party.</div>
          <button className="btn grey small" onClick={() => go('settings')}>Settings</button>
        </div>
        {err && <div className="err">{err}</div>}
      </Shell>
    );

  // ---------- settings (reachable from the profile icon) ----------
  if (screen === 'settings')
    return (
      <Shell online={online} everConnected={everConnected}>
        <button className="back" onClick={() => go('profile')}>‹ Profile</button>
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
          <div className="label">SOUND VOLUME {Math.round(prefs.volume * 100)}%</div>
          <input type="range" min={0} max={1} step={0.05} value={prefs.volume} onChange={(e) => pref('bw.volume', e.target.value)} />
          <button className="btn grey small" onClick={() => cue('vote')}>Test sound</button>
          <button className="btn grey small" onClick={resetOverlayPosition}>Reset overlay position</button>
          <div className="muted">Run Siege in borderless windowed mode or the overlay can't draw on top. F10 toggles click-through.</div>
        </div>
      </Shell>
    );

  // ---------- in a party: lobby ----------
  if (party)
    return (
      <Shell online={online} everConnected={everConnected} onProfile={() => go('profile')}>
        <h2 style={{ marginTop: 34 }}>{party.tier === 'premium' ? 'Premium Party' : 'Party'}</h2>
        <div className="panel" style={{ marginTop: 4 }}>
          <button className="code-copy" onClick={() => void copyInvite(party.code, 'Code copied!')} title="Copy invite code to clipboard" aria-label={`Copy invite code ${party.code}`}>
            <span className="code">{party.code}</span>
            <div className="copy-hint">{inviteCopied || 'Click to copy invite code'}</div>
          </button>
          <button className="btn gold small invite-share" onClick={() => void copyInviteLink(party.code)}>
            {inviteCopied === 'Invite link copied!' ? 'Invite link copied!' : 'Copy invite link'}
          </button>
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
          {self?.role === 'player' && self.team && party.phase === 'lobby' && (
            <button className={`btn ${self.ready ? 'green' : 'grey'} small`} onClick={() => call('party:setReady', { ready: !self.ready })}>
              {self.ready ? 'Ready ✓ · Click to unready' : 'Mark Ready'}
            </button>
          )}
          {self?.role === 'spectator' && <div className="muted">Party is full. You are spectating.</div>}
        </div>
        {err && <div className="err">{err}</div>}

        <div className="panel">
          <div className="label">PLAYERS ({party.players.length})</div>
          {party.players.map((p) => (
            <div className="pl" key={p.id} style={{ opacity: p.connected ? 1 : 0.5 }}>
              <span>{p.nick}{p.id === party.hostId && ' ★'}{p.role === 'spectator' && ' (spec)'}</span>
              <span><span className={`tm ${p.team}`}>{p.team ?? '–'}</span>
                {p.role === 'player' && <span className={`ready-state ${p.ready ? 'yes' : 'no'}`}>{p.ready ? 'READY' : 'NOT READY'}</span>}
                {isHost && p.id !== me && <button className="btn gold small" onClick={() => call('party:kick', { playerId: p.id })}>Kick</button>}</span>
            </div>
          ))}
        </div>

        {party.history.length > 0 && (
          <div className="panel">
            <div className="label">RECENT MATCH HISTORY</div>
            <div className="muted">
              Team A wins: {party.history.filter((match) => match.winner === 'A').length}
              {' · '}
              Team B wins: {party.history.filter((match) => match.winner === 'B').length}
            </div>
            <button className="btn grey small" disabled={!party.history.length} onClick={() => void copyMatchSummary()}>
              {inviteCopied === 'Results copied!' ? 'Results copied!' : 'Copy results'}
            </button>
            {party.history.slice(0, 10).map((match) => (
              <div className="history-row" key={`${match.matchNo}-${match.completedAt}`}>
                <span className="history-result">#{match.matchNo} · Team {match.winner} {match.score.join('-')}</span>
                <span className="muted">Team {match.bannedTeam}: {match.ban.label}{match.mercy ? ' · MERCY' : ''}</span>
              </div>
            ))}
          </div>
        )}

        {isHost && (
          <div className="panel">
            <div className="label">HOST CONTROLS</div>
            <div className="row">
              <button className="btn green small" disabled={party.phase === 'voting'} onClick={() => call('match:start')}>Start Match</button>
              <button className="btn gold small" onClick={() => call('party:reset')}>Reset</button>
            </div>
            {party.phase === 'inMatch' && (
              <div className="row">
                <button className="btn green small" onClick={() => call('match:result', { winner: 'A', score })}>Team A won</button>
                <button className="btn green small" onClick={() => call('match:result', { winner: 'B', score })}>Team B won</button>
              </div>
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
    <Shell online={online} everConnected={everConnected} onProfile={() => go('profile')}>
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
            {passwordRecovery ? (
              <>
                <div className="label">SET A NEW PASSWORD</div>
                <input type="password" placeholder="New password (8+ characters)" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="btn gold small" disabled={busy || password.length < 8} onClick={() => void updatePassword()}>{busy ? '...' : 'Update Password'}</button>
              </>
            ) : authEmail ? (
              <>
                <div className="label">SIGNED IN</div>
                <div className="muted">{authEmail}</div>
                <button className="btn grey small" disabled={busy} onClick={() => void signOut()}>{busy ? '...' : 'Sign Out'}</button>
              </>
            ) : (
              <>
                <div className="label">ACCOUNT</div>
                <div className="row">
                  <button className="btn grey small" disabled={busy} onClick={() => setAuthMode('signIn')}>Sign In</button>
                  <button className="btn grey small" disabled={busy} onClick={() => setAuthMode('signUp')}>Create Account</button>
                </div>
                <button className="btn grey small" disabled={busy} onClick={() => void signInWithProvider('google')}>Continue with Google</button>
                <button className="btn grey small" disabled={busy} onClick={() => void signInWithProvider('apple')}>Continue with Apple</button>
                <div className="label">EMAIL</div>
                <input type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input type="password" placeholder="Password" autoComplete={authMode === 'signUp' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="btn gold small" disabled={busy || !email.trim() || !password} onClick={() => void signInWithEmail()}>
                  {busy ? '...' : authMode === 'signUp' ? 'Create Account' : 'Sign In with Email'}
                </button>
                {authMode === 'signUp'
                  ? <button className="btn grey small" disabled={busy || !email.trim()} onClick={() => void resendConfirmation()}>Resend Confirmation Email</button>
                  : <button className="btn grey small" disabled={busy || !email.trim()} onClick={() => void requestPasswordReset()}>Forgot Password?</button>}
              </>
            )}
            <div className="label">PLAYER NAME</div>
            <input type="text" placeholder="Name" maxLength={16} value={nick} onChange={(e) => saveNick(e.target.value)} />
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn gold" style={{ marginTop: 18 }} onClick={() => go('home')}>Save</button>
        </>
      )}
    </Shell>
  );
}
