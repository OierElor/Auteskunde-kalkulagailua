/**
 * Alderdi berrientzako kolore lehenetsiak.
 *
 * Zortzi ñabardura, ordena finkoan — EZ dira ziklatzen. Ordena hau ez da apaingarria: itsutasun
 * kromatikoarekin bereizgarritasuna maximizatzeko aukeratua dago (paleta baliozkotua, ΔE 24,2
 * okerreneko bikote alboko argian). 9. alderditik aurrera errepikatu egiten dira, eta orduan
 * erabiltzaileak berak aldatu beharko du kolorea — hori onargarria da, aplikazioan alderdi
 * bakoitzak bere etiketa (laburdura) beti erakusten baitu koloreaz gain.
 */
export const DEFAULT_PARTY_COLORS = [
  '#2a78d6', // urdina
  '#1baf7a', // akuamarina
  '#eda100', // horia
  '#008300', // berdea
  '#4a3aa7', // bioleta
  '#e34948', // gorria
  '#e87ba4', // magenta
  '#eb6834', // laranja
];

export function defaultColorForIndex(index: number): string {
  return DEFAULT_PARTY_COLORS[index % DEFAULT_PARTY_COLORS.length];
}
