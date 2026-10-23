import { Medal } from '../core/Medals';

export interface MedalMeta {
  label: string;
  /** A distinct shape per medal so tiers read without colour. */
  symbol: string;
}

export const MEDAL_META: Record<Medal, MedalMeta> = {
  author: { label: 'Author', symbol: '◆' },
  gold: { label: 'Gold', symbol: '★' },
  silver: { label: 'Silver', symbol: '●' },
  bronze: { label: 'Bronze', symbol: '■' },
  none: { label: 'No medal', symbol: '–' },
};

/** Round badge; colours come from CSS (`.m-gold` ...), switched to a colour-blind-safe palette by `body.cb`. */
export function medalBadge(m: Medal, size: 'sm' | 'lg' = 'sm'): string {
  const meta = MEDAL_META[m];
  return `<span class="medal m-${m} ${size}" title="${meta.label}" aria-label="${meta.label}"><i>${meta.symbol}</i></span>`;
}
