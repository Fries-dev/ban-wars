import { desktopCapturer } from 'electron';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import Tesseract from 'tesseract.js';
import type { TeamId } from '@banwars/shared';

export interface MatchResult { winner: TeamId }
export interface MatchDetectionOptions {
  enabled: boolean;
  active: boolean;
  displayId: number;
  team: TeamId | null;
}

export function winnerFromResultText(text: string, localTeam: TeamId): TeamId | null {
  const normalized = text.toUpperCase().replace(/\s+/g, ' ');
  const victory = /\b(VICTORY|MATCH WON|YOU WIN)\b/.test(normalized);
  const defeat = /\b(DEFEAT|MATCH LOST|YOU LOSE)\b/.test(normalized);
  if (victory === defeat) return null;
  return victory ? localTeam : localTeam === 'A' ? 'B' : 'A';
}

export class ScreenshotMatchSource {
  private readonly require = createRequire(join(__dirname, 'match-source.js'));
  private readonly timer: ReturnType<typeof setInterval>;
  private options: MatchDetectionOptions = { enabled: false, active: false, displayId: 0, team: null };
  private worker: Tesseract.Worker | null = null;
  private polling = false;
  private reported = false;
  private lastError: string | null = null;

  constructor(
    private readonly onResult: (result: MatchResult) => Promise<boolean>,
    private readonly onError: (message: string | null) => void,
  ) {
    this.timer = setInterval(() => { void this.poll(); }, 3000);
  }

  update(options: MatchDetectionOptions) {
    if (!options.active || !options.enabled) this.reported = false;
    this.options = options;
  }

  setError(message: string | null) {
    if (message === this.lastError) return;
    this.lastError = message;
    this.onError(message);
    if (message) console.error(`Automatic win detection failed: ${message}`);
  }

  async stop() {
    clearInterval(this.timer);
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }

  private async getWorker() {
    if (this.worker) return this.worker;
    const model = this.require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean };
    this.worker = await Tesseract.createWorker('eng', undefined, {
      langPath: model.langPath,
      gzip: model.gzip,
      cacheMethod: 'none',
    });
    return this.worker;
  }

  private async poll() {
    const options = this.options;
    if (this.polling || this.reported || !options.enabled || !options.active || !options.team) return;
    this.polling = true;
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 },
      });
      const source = sources.find((item) => item.display_id === String(options.displayId));
      if (!source) throw new Error('Could not capture the selected game monitor. Check the Game Monitor setting.');
      const worker = await this.getWorker();
      const { data: { text } } = await worker.recognize(source.thumbnail.toPNG());
      this.setError(null);
      const winner = winnerFromResultText(text, options.team);
      if (!winner) return;
      if (await this.onResult({ winner })) {
        this.reported = true;
      }
    } catch (error) {
      this.setError(error instanceof Error ? error.message : 'Could not read the match result from the game screen.');
    } finally {
      this.polling = false;
    }
  }
}
