import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Provider } from '@supabase/supabase-js';
import type { TeamId } from '@banwars/shared';
import logoImage from '../../../../icons/logo/logo.png';
import { cue } from './sound';
import { readPrefs, useBw } from './useBw';
import { supabase } from './auth';

type Screen = 'home' | 'create' | 'code' | 'join' | 'signin' | 'profile' | 'settings' | 'privacy' | 'terms';
type PanelAction = 'minimize' | 'close';

const css = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:#4a4a4a;font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#fff;user-select:none}
.app{position:relative;display:flex;flex-direction:column;height:100vh;overflow:hidden;background:#5b5b5b}
.pattern{position:absolute;inset:0;width:100%;height:100%;filter:brightness(0);opacity:.07;pointer-events:none}
.titlebar{position:relative;z-index:5;display:flex;align-items:center;height:38px;min-height:38px;padding-left:10px;background:#494949;border:1px solid rgba(255,255,255,.16);-webkit-app-region:drag}
.titlebar-title{flex:1;font-size:13px;font-weight:700}
.window-controls{display:flex;height:100%;-webkit-app-region:no-drag}
.window-control{width:46px;border:0;background:transparent;color:#eee;font:inherit;font-size:15px;cursor:pointer}
.window-control:hover{background:rgba(255,255,255,.15)}
.window-control.close:hover{background:#c42b1c}
.content{position:relative;z-index:1;flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;padding:12px 24px;overflow-y:auto}
.profile{position:absolute;z-index:3;top:46px;right:14px;background:none;border:0;padding:0;cursor:pointer}
.offline{position:absolute;z-index:4;left:0;right:0;bottom:34px;background:#c0392b;color:#fff;font-size:13px;font-weight:600;text-align:center;padding:8px}
.footer{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;height:32px;min-height:32px;padding:0 9px;background:rgba(0,0,0,.12);border-top:1px solid rgba(255,255,255,.12);font-size:11px;font-weight:700;color:#aaa}
.footer-links{display:flex;gap:10px}
.footer button{padding:0;border:0;background:none;color:#c8c8c8;font:inherit;cursor:pointer}
.footer button:hover{color:#fff;text-decoration:underline}
.logo{width:min(280px,100%);height:126px;display:flex;align-items:center;justify-content:center;margin-top:18px;flex:none}
.logo img{display:block;width:100%;height:100%;object-fit:contain}
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
.legal{width:100%;max-width:600px}
.legal h2{margin-top:4px}
.legal .panel{line-height:1.5;user-select:text}
.legal .panel h3{margin:4px 0 0;font-size:15px}
.legal .panel p{margin:0}
.legal-notice{padding:9px 12px;border:1px solid #e8b45e;border-radius:9px;background:rgba(0,0,0,.2);color:#ffe0a3;font-size:12px;font-weight:700}
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
      <img src={logoImage} alt="Ban Wars" />
    </div>
  );
}

function Shell({ children, online, everConnected, version, onWindowControl, onLegal, onProfile }: {
  children: ReactNode;
  online: boolean;
  everConnected: boolean;
  version: string;
  onWindowControl: (action: PanelAction) => void;
  onLegal: (screen: 'privacy' | 'terms') => void;
  onProfile?: () => void;
}) {
  return (
    <div className="app"><style>{css}</style>
      <div className="titlebar">
        <span className="titlebar-title">Ban Wars{version && ` v.${version}`}</span>
        <div className="window-controls">
          <button className="window-control" aria-label="Minimize" title="Minimize" onClick={() => onWindowControl('minimize')}>−</button>
          <button className="window-control close" aria-label="Close" title="Close" onClick={() => onWindowControl('close')}>×</button>
        </div>
      </div>
      <svg className="pattern" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="bw-watermark" width="140" height="160" patternUnits="userSpaceOnUse">
            <image href={logoImage} x="5" y="3" width="76" height="34" />
            <image href={logoImage} x="55" y="43" width="76" height="34" />
            <image href={logoImage} x="5" y="83" width="76" height="34" />
            <image href={logoImage} x="55" y="123" width="76" height="34" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bw-watermark)" />
      </svg>
      {onProfile && <button className="profile" onClick={onProfile} title="Profile & settings"><Profile /></button>}
      <div className="content">{children}</div>
      {!online && <div className="offline">{everConnected ? 'Connection lost. Reconnecting to your party…' : 'Connecting to the Ban Wars server…'}</div>}
      <footer className="footer">
        <span>Made by Kevin Fries</span>
        <div className="footer-links">
          <button onClick={() => onLegal('privacy')}>Privacy Policy</button>
          <button onClick={() => onLegal('terms')}>Terms of Service</button>
        </div>
      </footer>
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
  const previousScreen = useRef<Screen>('home');
  const [version, setVersion] = useState('');
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
    void window.bw.panelVersion().then(setVersion).catch((error: unknown) => {
      console.error('Could not read app version:', error);
      setErr(error instanceof Error ? error.message : 'Could not read app version.');
    });
  }, []);
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
  const go = (s: Screen) => {
    setErr('');
    if (s !== 'privacy' && s !== 'terms') previousScreen.current = s;
    setScreen(s);
  };
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
  const onWindowControl = (action: PanelAction) => {
    void window.bw.panelControl(action).catch((error: unknown) => {
      console.error('Could not control panel window:', error);
      setErr(error instanceof Error ? error.message : 'Could not control panel window.');
    });
  };
  const shellProps = { online, everConnected, version, onWindowControl, onLegal: (target: 'privacy' | 'terms') => go(target) };

  if (screen === 'privacy' || screen === 'terms')
    return (
      <Shell {...shellProps}>
        <div className="legal">
          <button className="back" onClick={() => go(previousScreen.current)}>‹ Back</button>
          <h2>{screen === 'privacy' ? 'Privacy Policy' : 'Terms of Service'}</h2>
          <div className="panel">
            <div className="legal-notice">DRAFT FOR REVIEW — finalize the details below before publishing or accepting subscription payments.</div>
            {screen === 'privacy' ? (
              <>
                <h3>Information used by Ban Wars</h3>
                <p>Ban Wars uses the player name, team, party activity, and match results needed to run multiplayer parties. If account sign-in is enabled, Supabase Auth processes account information such as your email address.</p>
                <h3>Local storage and party sessions</h3>
                <p>App preferences are stored on your device. A party rejoin session is encrypted using your operating system's secure storage. Party state is held by the Ban Wars server in memory while the server is running.</p>
                <h3>Payments and Premium</h3>
                <p>This app build does not include subscription checkout or collect payment card details. Before enabling monthly Premium purchases, identify the payment provider and document what billing information it processes, how long it retains it, and how users can contact you about privacy.</p>
                <h3>Sharing and contact</h3>
                <p>Party members can see player names, teams, and activity in their party. Supabase and the Ban Wars server provide account and multiplayer services. Add a monitored privacy contact address and any applicable data-request process before release.</p>
              </>
            ) : (
              <>
                <h3>Using the service</h3>
                <p>Ban Wars provides tools for organizing multiplayer parties and match ban selections. Keep your account credentials private, use a player name you are permitted to use, and do not disrupt the service or other players.</p>
                <h3>Premium subscriptions — setup required</h3>
                <p>The current app build does not implement subscription checkout, renewal, or cancellation. Before selling Premium, specify the seller's legal name and contact, the plan price and currency, monthly renewal terms, when charges occur, how and when cancellation takes effect, refund rules, and any trial or tax terms. Show these details before purchase and use the actual payment provider's cancellation process.</p>
                <h3>Availability and account actions</h3>
                <p>The service may be updated or temporarily unavailable. Accounts or parties that abuse the service may be restricted. Explain any material limits on Premium features here before taking payment.</p>
                <h3>Legal review</h3>
                <p>This draft is general product text, not legal advice. Have the final terms reviewed for your location and the locations where you offer subscriptions, including applicable consumer and recurring-payment requirements.</p>
              </>
            )}
          </div>
        </div>
      </Shell>
    );

  if (screen === 'profile')
    return (
      <Shell {...shellProps}>
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
      <Shell {...shellProps}>
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
      <Shell {...shellProps} onProfile={() => go('profile')}>
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
    <Shell {...shellProps} onProfile={() => go('profile')}>
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
