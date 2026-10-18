import type { TeamId } from '@banwars/shared';

/**
 * Pluggable win detection. The host's manual "Report result" button is the baseline;
 * a stats-API poller can be added behind the same interface (and must stay a pure HTTP client:
 * no injection, no memory reading, no hooking of the game process).
 */
export interface MatchResult { winner: TeamId; score: [number, number] }
export interface MatchSource { start(onResult: (r: MatchResult) => void): void; stop(): void }

export class StatsApiSource implements MatchSource {
  start(_onResult: (r: MatchResult) => void) {
    // TODO: poll the stats provider for the host's most recent match, map players -> teams,
    // call onResult when a *new* match id appears. Verify that custom games are exposed at all.
  }
  stop() {}
}
