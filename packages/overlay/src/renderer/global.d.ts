import type { PartyView } from '@banwars/shared';
type Sub<T> = (cb: (d: T) => void) => () => void;
declare global {
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
      displays: () => Promise<{ id: number; label: string; selected: boolean }[]>;
      setDisplay: (id: number) => Promise<void>;
    };
  }
}
