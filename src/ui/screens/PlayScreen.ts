import { CAMPAIGN, TIERS, TRAINING, trackOfTheDay } from '../../data/campaign';
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

/**
 * Solo play hub, tile style: the campaign (big tile with progress per tier), training, the track of the
 * day and records.
 */
export class PlayScreen implements Screen {
  readonly el = h('div', { class: 'screen play' });
  readonly backdropShift = 0.32;

  constructor(private readonly app: AppApi) {}

  onShow(): void {
    const c = this.app.campaign();
    const tile = (cls: string, title: string, sub: string, art: string, img: string | null, onClick: () => void, extra?: HTMLElement): HTMLElement => {
      const pic = h('img', { class: 'pt-map', alt: '' });
      if (img) this.app.thumbnail(img, (url) => { if (url) pic.src = url; }, () => pic.isConnected);
      return h('button', { class: `play-tile ${cls}`, type: 'button', onclick: onClick, style: `--art:${art}` },
        h('div', { class: 'pt-art' }, img ? pic : null),
        extra ?? null,
        h('div', { class: 'pt-text' }, h('div', { class: 'pt-title' }, title), h('div', { class: 'pt-sub' }, sub)),
      );
    };
    const tiers = h('div', { class: 'pt-tiers' }, ...c.tiers.map((t) => h('div', { class: `pt-tier${t.unlocked ? '' : ' locked'}`, style: `--tier:${t.def.color}` },
      h('b', {}, t.def.name), h('small', {}, `${t.done}/${t.count}`))));
    const totd = trackOfTheDay();
    const totdLv = totd ? this.app.level(totd.levelId) : undefined;
    const pb = totdLv ? Records.get(totdLv.id) : undefined;
    const daySub = totdLv ? `${totdLv.name} · ${levelCars(this.app, totdLv.id).map((x) => this.app.car(x).label).join(' › ')}${pb ? ` · best ${formatTime(pb.best)}` : ''}` : '';
    const grid = h('div', { class: 'play-grid' },
      tile('big', 'Campaign', `${CAMPAIGN.length} tracks · ${TIERS.length} tiers · ${c.totalPoints}/${c.maxPoints} pts`, ART.forest!, null,
        () => this.app.screens.push(new LevelSelectScreen(this.app, 'campaign')), tiers),
      tile('', 'Training', `${TRAINING.length} short tracks · one skill each`, ART.sunset!, null,
        () => this.app.screens.push(new LevelSelectScreen(this.app, 'training'))),
      tile('', 'Track of the day', daySub, ART[totdLv?.theme ?? 'forest'] ?? ART.forest!, totdLv?.id ?? null,
        () => { if (totdLv) this.app.playLevel(totdLv.id); }),
      tile('', 'Records', 'Your times, medals and replays', ART.night!, null,
        () => this.app.screens.push(new LeaderboardScreen(this.app))),
    );
    this.el.replaceChildren(header('Play', () => this.app.screens.back()), grid);
    (grid.firstElementChild as HTMLElement).setAttribute('data-autofocus', '');
  }

  onBack(): boolean {
    return false;
  }
}
