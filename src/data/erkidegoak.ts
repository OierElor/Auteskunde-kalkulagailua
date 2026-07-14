import type { Scenario } from '../core/types';

/**
 * PROBINTZIA → AUTONOMIA ERKIDEGOA (Espainiako Kongresua).
 *
 * Datu publikoa, ez asmatua. Gakoak Kongresuko CSVko izen ZEHATZAK dira (BOEtik datozenak):
 * `Coruña (A)`, `Palmas (Las)`, `Rioja (La)`, `Alicante/Alacant`… ez dira "garbitzen".
 *
 * 52 barruti → **19 talde**: 17 autonomia erkidego + Ceuta eta Melilla (hiri autonomoak).
 * Proba batek egiaztatzen du 52ak mapatuta daudela eta eserlekuen batura 350 dela.
 *
 * Zertarako: Kongresua erkidegoka berrantolatzeak ERDIBIDEKO eszenatoki bat ematen du — ez 52
 * barruti, ez bakarra. Barrutiaren tamainak zenbat aldatzen duen ikusteko modurik zuzenena.
 */
export const PROVINCE_TO_REGION: Record<string, string> = {
  // Andaluzia (8)
  Almería: 'Andaluzia',
  Cádiz: 'Andaluzia',
  Córdoba: 'Andaluzia',
  Granada: 'Andaluzia',
  Huelva: 'Andaluzia',
  Jaén: 'Andaluzia',
  Málaga: 'Andaluzia',
  Sevilla: 'Andaluzia',

  // Aragoi (3)
  Huesca: 'Aragoi',
  Teruel: 'Aragoi',
  Zaragoza: 'Aragoi',

  // Asturias (1)
  Asturias: 'Asturias',

  // Balearrak (1)
  'Balears (Illes)': 'Balearrak',

  // Kanariak (2)
  'Palmas (Las)': 'Kanariak',
  'Santa Cruz de Tenerife': 'Kanariak',

  // Kantabria (1)
  Cantabria: 'Kantabria',

  // Gaztela-Mantxa (5)
  Albacete: 'Gaztela-Mantxa',
  'Ciudad Real': 'Gaztela-Mantxa',
  Cuenca: 'Gaztela-Mantxa',
  Guadalajara: 'Gaztela-Mantxa',
  Toledo: 'Gaztela-Mantxa',

  // Gaztela eta Leon (9)
  Ávila: 'Gaztela eta Leon',
  Burgos: 'Gaztela eta Leon',
  León: 'Gaztela eta Leon',
  Palencia: 'Gaztela eta Leon',
  Salamanca: 'Gaztela eta Leon',
  Segovia: 'Gaztela eta Leon',
  Soria: 'Gaztela eta Leon',
  Valladolid: 'Gaztela eta Leon',
  Zamora: 'Gaztela eta Leon',

  // Katalunia (4)
  Barcelona: 'Katalunia',
  Girona: 'Katalunia',
  Lleida: 'Katalunia',
  Tarragona: 'Katalunia',

  // Extremadura (2)
  Badajoz: 'Extremadura',
  Cáceres: 'Extremadura',

  // Galizia (4)
  'Coruña (A)': 'Galizia',
  Lugo: 'Galizia',
  Ourense: 'Galizia',
  Pontevedra: 'Galizia',

  // Madril (1)
  Madrid: 'Madril',

  // Murtzia (1)
  Murcia: 'Murtzia',

  // Nafarroa (1)
  Navarra: 'Nafarroa',

  // Euskadi (3)
  'Araba/Álava': 'Euskadi',
  Bizkaia: 'Euskadi',
  Gipuzkoa: 'Euskadi',

  // Errioxa (1)
  'Rioja (La)': 'Errioxa',

  // Valentziako Erkidegoa (3)
  'Alicante/Alacant': 'Valentziako Erkidegoa',
  'Castellón/Castelló': 'Valentziako Erkidegoa',
  'Valencia/València': 'Valentziako Erkidegoa',

  // Hiri autonomoak (2)
  Ceuta: 'Ceuta',
  Melilla: 'Melilla',
};

export const PROVINCE_COUNT = 52;

/**
 * Eszenatokia Espainiako Kongresua den (52 probintziak, izen berberekin).
 *
 * Zorrotza da nahita: erkidegoka bateratzeko botoia eszenatoki horretan BAKARRIK erakusten da.
 * Barruti bat berrizendatu edo ezabatu baduzu, botoia desagertzen da — eta hori zuzena da, mapak
 * ez baitu jada eszenatokia deskribatzen.
 */
export function matchesSpanishProvinces(scenario: Scenario): boolean {
  return (
    scenario.districts.length === PROVINCE_COUNT &&
    scenario.districts.every((d) => PROVINCE_TO_REGION[d.name] !== undefined)
  );
}

export const regionOf = (name: string): string | null => PROVINCE_TO_REGION[name] ?? null;
