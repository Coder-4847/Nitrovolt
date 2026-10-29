import { CAMPAIGN, WORLDS, trackOfTheDay } from '../../data/campaign';
import { Records } from '../../core/Records';
import { h } from '../dom';
import { formatTime } from '../Hud';
import { AppApi } from './AppApi';
import { header } from './common';
import { LeaderboardScreen } from './LeaderboardScreen';
import { LevelSelectScreen, levelCars } from './LevelSelectScreen';
import { Screen } from './ScreenManager';

/** Picture behind a tile: an in-race postcard of the environment (rendered by scripts/make-art.mjs). */
const ART: Record<string, string> = Object.fromEntries(['forest', 'snow', 'desert', 'sunset', 'night'].map((e) => [e, `url(${import.meta.env.BASE_URL}art/${e}.jpg)`]));

/** Solo play hub, tile style: the campaign (big tile with progress per world), the track of the day and records. */
export class PlayScreen implements Screen {
  readonly el = h('div', { class: 'screen play' });
  readonly backdropShift = 0.32;

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const tile = (cls: string, title: string, sub: string, art: string, img: string | null, onClick: () => void, extra?: HTMLElement): HTMLElement => {
      const pic = h('img', { class: 'pt-map', alt: '' });
      if (img) this.app.thumbnail(img, (url) => { if (url) pic.src = url; }, () => pic.isConnected);
      return h('button', { class: `play-tile ${cls}`, type: 'button', onclick: onClick, style: `--art:${art}` },
        h('div', { class: 'pt-art' }, img ? pic : null),
        extra ?? null,
        h('div', { class: 'pt-text' }, h('div', { class: 'pt-title' }, title), h('div', { class: 'pt-sub' }, sub)),
      );
    };
    const worlds = h('div', { class: 'pt-tiers' }, ...WORLDS.map((w) => {
      const levels = CAMPAIGN.filter((l) => l.world === w.id);
      const done = levels.filter((l) => Records.get(l.levelId)).length;
      return h('div', { class: 'pt-tier', style: `--tier:${w.color}` }, h('b', {}, w.name), h('small', {}, `${done}/${levels.length}`));
    }));
    const timed = CAMPAIGN.filter((l) => Records.get(l.levelId)).length;
    const totd = trackOfTheDay();
    const totdLv = totd ? this.app.level(totd.levelId) : undefined;
    const pb = totdLv ? Records.get(totdLv.id) : undefined;
    const daySub = totdLv ? `${totdLv.name} · ${levelCars(this.app, totdLv.id).map((x) => this.app.car(x).label).join(' › ')}${pb ? ` · best ${formatTime(pb.best)}` : ''}` : '';
    const grid = h('div', { class: 'play-grid' },
      tile('big', 'Campaign', `${CAMPAIGN.length} tracks · ${WORLDS.length} worlds · ${timed} timed`, ART.forest!, null,
        () => this.app.screens.push(new LevelSelectScreen(this.app)), worlds),
      tile('', 'Track of the day', daySub, ART[totdLv?.theme ?? 'forest'] ?? ART.forest!, totdLv?.id ?? null,
        () => { if (totdLv) this.app.playLevel(totdLv.id); }),
      tile('', 'Records', 'Your best times, replays and the target ghosts', ART.night!, null,
        () => this.app.screens.push(new LeaderboardScreen(this.app))),
    );
    this.el.replaceChildren(header('Play', () => this.app.screens.back()), grid);
    (grid.firstElementChild as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    return false;
  }
}
