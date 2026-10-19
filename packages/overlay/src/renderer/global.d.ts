import type { PartyView } from '@banwars/shared';
type Sub<T> = (cb: (d: T) => void) => () => void;
declare global {
  interface ImportMetaEnv {
    readonly VITE_BW_SERVER: string;
    readonly VITE_SUPABASE_URL?: string;
    readonly VITE_SUPABASE_ANON_KEY?: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  interface Window {
    bw: {
      emit: (event: string, payload?: object) => Promise<{ ok: boolean; error?: string; [k: string]: any }>;
      getState: () => Promise<PartyView | null>;
      getSession: () => Promise<{ code: string; playerId: string } | null>;
      onState: Sub<PartyView>;
      onEvent: Sub<{ name: string; payload: any }>;
      getConn: () => Promise<boolean>;
      onConn: Sub<boolean>;
      onSession: Sub<{ code: string; playerId: string } | null>;
      onInteractive: Sub<boolean>;
      openAuthUrl: (url: string) => Promise<{ ok: boolean; error?: string }>;
      getAuthCallback: () => Promise<string | null>;
      clearAuthCallback: (url: string) => Promise<void>;
      onAuthCallback: Sub<string>;
      getPendingPartyCode: () => Promise<string | null>;
      clearPendingPartyCode: (code: string) => Promise<void>;
      onPartyInvite: Sub<string>;
      copyText: (text: string) => Promise<void>;
      onResetOverlayPosition: Sub<void>;
      resetOverlayPosition: () => Promise<void>;
      displays: () => Promise<{ id: number; label: string; selected: boolean }[]>;
      setDisplay: (id: number) => Promise<void>;
    };
  }
}
