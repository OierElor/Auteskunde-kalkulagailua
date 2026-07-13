/**
 * Kolore-tresnak (sRGB ↔ OKLab ↔ OKLCH).
 *
 * Zergatik behar den: alderdien koloreak ERABILTZAILEAK aukeratzen ditu (alderdi bakoitzak bere
 * marka-kolorea du), beraz ezin dugu paleta itxi batekin bermatu gai argian eta ilunean ondo
 * irakurriko direnik. Kolore bakoitzaren argitasuna gaiaren banda egokira eramaten dugu, ñabardura
 * eta krometa mantenduz — hori da paleta bat gai ilunerako "aukeratzea", ez alderantzikatzea.
 */

const LIGHT_BAND: [number, number] = [0.43, 0.77];
const DARK_BAND: [number, number] = [0.48, 0.67];

export const LIGHT_SURFACE = '#fcfcfb';
export const DARK_SURFACE = '#1a1a19';

/** Krometa honen azpitik kolore bat akromatikotzat jotzen dugu: ez du ñabardurarik. */
const CHROMA_FLOOR = 0.1;

/** Objektu grafikoen gutxieneko kontrastea (WCAG 1.4.11). */
const MIN_GRAPHIC_CONTRAST = 3;

/**
 * Paleta lehenetsiaren gai ilunerako urratsak, eskuz baliozkotuak. Algoritmoak ondo funtzionatzen
 * du edozein kolorerekin, baina gure zortzi ñabardurentzat balio egiaztatuak lehenesten ditugu.
 */
const VALIDATED_DARK: Record<string, string> = {
  '#2a78d6': '#3987e5',
  '#1baf7a': '#199e70',
  '#eda100': '#c98500',
  '#008300': '#008300',
  '#4a3aa7': '#9085e9',
  '#e34948': '#e66767',
  '#e87ba4': '#d55181',
  '#eb6834': '#d95926',
};

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = Number.parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

export function hexToOklch(hex: string): Oklch {
  const [r0, g0, b0] = hexToRgb(hex);
  const r = srgbToLinear(r0);
  const g = srgbToLinear(g0);
  const b = srgbToLinear(b0);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

function oklchToRgbRaw(o: Oklch): [number, number, number] {
  const a = o.c * Math.cos((o.h * Math.PI) / 180);
  const b = o.c * Math.sin((o.h * Math.PI) / 180);

  const l_ = o.l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = o.l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = o.l - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function inGamut([r, g, b]: [number, number, number]): boolean {
  const eps = 1e-4;
  return [r, g, b].every((v) => v >= -eps && v <= 1 + eps);
}

/**
 * OKLCH → hex, gamutik kanpo geratzen bada krometa jaitsiz (ez kanalak moztuz: mozketak
 * ñabardura desitxuratzen du, krometa jaisteak ez).
 */
export function oklchToHex(o: Oklch): string {
  if (inGamut(oklchToRgbRaw(o))) {
    const [r, g, b] = oklchToRgbRaw(o);
    return rgbToHex(r, g, b);
  }
  let lo = 0;
  let hi = o.c;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgbRaw({ ...o, c: mid }))) lo = mid;
    else hi = mid;
  }
  const [r, g, b] = oklchToRgbRaw({ ...o, c: lo });
  return rgbToHex(r, g, b);
}

export function normalizeHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r, g, b);
}

/**
 * Kolore bat gai baten argitasun-bandara eramaten du, ñabardura eta krometa mantenduz.
 *
 * Bandak nahikoa du kolore KROMATIKOENTZAT: ñabardurak berak bereizten ditu, eta horregatik
 * onartzen ditu paleta baliozkotuak 3:1etik beherako urdinberde eta hori batzuk ere (erliebe-arauak
 * estaltzen ditu: etiketa ikusgaiak eta taula beti daude).
 *
 * Kolore AKROMATIKOETAN (grisa, beltza, zuria) ez dago ñabardurarik: argitasuna da kanal bakarra,
 * eta orduan bandak EZ du 3:1 bermatzen — beltza gai ilunean 2,6:1ean geratzen da. Kasu horretan
 * argitasuna bultzatzen jarraitzen dugu kontrastea benetan lortu arte. Kontrastea kalkulatu egiten
 * dugu, ez dugu bandan fidatzen.
 */
function adaptToSurface(
  hex: string,
  band: [number, number],
  surface: string,
  direction: 1 | -1,
): string {
  const o = hexToOklch(hex);
  const targetL = Math.min(band[1], Math.max(band[0], o.l));
  let out = targetL === o.l ? normalizeHex(hex) : oklchToHex({ ...o, l: targetL });

  if (o.c >= CHROMA_FLOOR) return out;

  let l = targetL;
  while (contrastRatio(out, surface) < MIN_GRAPHIC_CONTRAST && l > 0 && l < 1) {
    l = Math.min(1, Math.max(0, l + direction * 0.01));
    out = oklchToHex({ ...o, l });
  }
  return out;
}

/** Kolorea gai argirako egokitzen du. */
export function adaptForLight(hex: string): string {
  return adaptToSurface(hex, LIGHT_BAND, LIGHT_SURFACE, -1);
}

/** Kolorea gai ilunerako egokitzen du (paleta lehenetsiak balio baliozkotuak ditu). */
export function adaptForDark(hex: string): string {
  const validated = VALIDATED_DARK[normalizeHex(hex)];
  if (validated) return validated;
  return adaptToSurface(hex, DARK_BAND, DARK_SURFACE, 1);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Kolore baten gainean idazteko tinta irakurgarria. Alderdi baten kolorea txartel baten atzealde
 * gisa erabiltzen dugunean beharrezkoa da: kolorea erabiltzaileak aukeratzen duenez, ezin dugu
 * beltza edo zuria finkatu.
 */
export function readableInkOn(background: string): string {
  return contrastRatio(background, '#0b0b0b') >= contrastRatio(background, '#ffffff')
    ? '#0b0b0b'
    : '#ffffff';
}
