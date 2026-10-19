export type Category = 'operator' | 'sights' | 'movement' | 'weapon' | 'utility' | 'comms';
export type TeamId = 'A' | 'B';
export type Tier = 'free' | 'premium';
export type Phase = 'lobby' | 'inMatch' | 'voting';

export interface BanDef {
  id: string;
  category: Category;      // the "folder" the ban lives in
  label: string;
  operatorImages?: string[];
  premium?: boolean;       // premium-only catalog entry
}

export interface Settings {
  mercyMargin: number;     // winner score - loser score needed for mercy (7-0 => 7)
  voteSeconds: number;
}

export interface PlayerView {
  id: string; nick: string; team: TeamId | null;
  role: 'player' | 'spectator'; connected: boolean; ready: boolean;
}

export interface VoteView {
  winner: TeamId;
  catalog: BanDef[];                 // all bans, including locked entries
  availableBanIds: string[];         // bans unlocked for this party and match
  tally: Record<string, number>;     // live vote counts per ban id
  deadline: number;                  // server epoch ms; clients correct with serverNow offset
  votesIn: number; votesNeeded: number;
}

export interface MatchHistoryEntry {
  matchNo: number;
  winner: TeamId;
  score: [number, number];
  mercy: boolean;
  bannedTeam: TeamId;
  ban: BanDef;
  completedAt: number;
}

export interface PartyView {
  code: string; hostId: string; tier: Tier; settings: Settings;
  players: PlayerView[]; phase: Phase; matchNo: number;
  bans: Record<TeamId, BanDef[]>;       // accumulated restrictions for each team
  mercyTeam: TeamId | null;             // team holding an unused mercy unban
  lastResult: { winner: TeamId; score: [number, number]; mercy: boolean } | null;
  history: MatchHistoryEntry[];
  vote: VoteView | null;
  serverNow: number;
}

export type Ack<T = object> = (r: ({ ok: true } & T) | { ok: false; error: string }) => void;

/** Client -> server event payloads */
export interface ClientEvents {
  'party:create': { nick: string; accountToken?: string };
  'party:join': { code: string; nick: string; token?: string };
  'party:setTeam': { team: TeamId };
  'party:setReady': { ready: boolean };
  'party:kick': { playerId: string };
  'party:settings': Partial<Settings>;
  'party:reset': object;
  'match:start': object;
  'match:result': { winner: TeamId; score: [number, number] };
  'vote:cast': { banId: string };
  'mercy:unban': { banId: string };
}

/** Server -> client push events (besides party:state) */
export interface ServerEvents {
  'ban:applied': { team: TeamId; bans: BanDef[] };
  'ban:removed': { team: TeamId; ban: BanDef };
  'toast': { message: string };
  'party:kicked': object;
}
