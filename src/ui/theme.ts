import { useEffect, useMemo, useState } from 'react';
import { adaptForDark, adaptForLight, readableInkOn } from '../core/color';
import type { Party, PartyId } from '../core/types';

export type Theme = 'light' | 'dark';

const KEY = 'hauteskunde.theme';

function initialTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(KEY, theme);
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'light' ? 'dark' : 'light'))];
}

export interface PartyPaint {
  /** Uneko gairako egokitutako kolorea. */
  fill: string;
  /** Kolore horren gainean irakurgarria den tinta. */
  ink: string;
}

/**
 * Alderdien koloreak uneko gaira egokituta.
 *
 * Alderdi baten kolorea bere identitatea da eta erabiltzaileak aukeratzen du, baina kolore bera
 * ezin da bi gaietan erabili: gorri ilun batek ez du ezer balio gai ilunean. Argitasuna gaiaren
 * bandara eramaten dugu, ñabardura mantenduz.
 */
export function usePartyPaint(parties: Party[], theme: Theme): Record<PartyId, PartyPaint> {
  return useMemo(() => {
    const adapt = theme === 'dark' ? adaptForDark : adaptForLight;
    const out: Record<PartyId, PartyPaint> = {};
    for (const p of parties) {
      const fill = adapt(p.color);
      out[p.id] = { fill, ink: readableInkOn(fill) };
    }
    return out;
  }, [parties, theme]);
}

export const formatInt = (n: number) => n.toLocaleString('eu-ES');
export const formatPercent = (n: number, digits = 1) =>
  `%${n.toLocaleString('eu-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
export const formatDecimal = (n: number, digits = 2) =>
  n.toLocaleString('eu-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits });
