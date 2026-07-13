# Hauteskunde Kalkulagailua

Hauteskunde-emaitzak **bisualki** kalkulatzeko eta manipulatzeko tresna. Parametro bat ukitu —
langa, eserlekuak, banaketa-metodoa, barrutiak— eta hemizikloa berehala aldatzen ikusi.

```bash
npm install
npm run dev      # → http://localhost:5173
npm test         # motorraren eta UI-aren probak
npm run build    # dist/ karpeta estatikoa
```

## Zer egin dezakezu

- **Alderdiak** gehitu, kendu, berrizendatu, kolorez aldatu eta ezker-eskuin ardatzean kokatu.
- **Eserlekuak** igo eta jaitsi, guztira edo barrutika.
- **Barrera elektorala** mugitu (%0–15), barrutika edo estatu mailan, boto zuriak izendatzailean
  sartuta edo gabe.
- **Banaketa-metodoa** aldatu: D'Hondt, Sainte-Laguë (arrunta eta aldatua), Imperiali, Daniarra,
  Huntington-Hill, eta kuota-metodoak (Hare, Droop, Hagenbach-Bischoff, Imperiali) hondar
  handienarekin.
- **Barrutiak** gehitu eta kendu: sistema barruti anitzekoa da.
- **Koalizioak** eraiki eta gehiengo absolutua lortzen den ikusi; gutxieneko koalizio irabazleak
  automatikoki kalkulatzen dira.
- **Proportzionaltasuna** neurtu: Gallagher, Loosemore-Hanby, galdutako botoak, alderdi eraginkorrak.
- **Metodo guztiak konparatu** datu berberekin, taula bakarrean.
- **CSV** inportatu eta esportatu.

## Arkitektura

`src/core/` **UI-rik gabeko TypeScript hutsa da**, funtzio puruz osatua eta guztiz probatua.
Hori ez da purismoa: D'Hondt edo MMP gaizki inplementatzeak emaitza *sinesgarri baina okerra* ematen
du, eta begiz ezin da antzeman. Probak dira sare bakarra.

| Fitxategia | Zer den |
|---|---|
| `core/allocate.ts` | Esleipenaren **sarrera-puntu bakarra**. Sistema guztiek hemendik pasatzen dute. |
| `core/divisors.ts` · `core/quotas.ts` | Metodoen definizioak. |
| `core/threshold.ts` | Langa: esparrua, barrutiko gainidazketa, boto zuriak. |
| `core/systems/` | Sistema elektoralak. Bakoitza modulu bat, erregistro batean. |
| `core/indices.ts` · `core/coalitions.ts` | Neurriak eta koalizioak. |
| `core/hemicycle.ts` | Hemizikloaren geometria (funtzio purua, probatua). |
| `core/color.ts` | OKLCH: alderdien koloreak gai argira eta ilunera egokitzen ditu. |

**Ideia gakoa:** barruti uninominal bat `seats: 1` duen barruti arrunta da. Horri esker FPTP-k eta
sistema mistoek datu-eredu **berbera** erabiliko dute; ez da beste bat behar.

## Inbariante nagusia

Esleitutako eserlekuak beti dira barruti guztien eserlekuen batura. Metodo guztietan, datu
guztiekin. Proba bat dago hori zaintzen duena — hori hausten bada, dena dago hautsita.

## Datuak

Adibide-datuak **sintetikoak dira**: alderdiak asmatuak dira (koloreen izenak daramatzate) eta
botoak ez datoz benetako hauteskunde batetik. Egiturak bai, benetakoak dira (3 × 25 eserleku Eusko
Legebiltzarrarena da). Zure datuak CSV bidez kargatu:

```
Barrutia;Eserlekuak;EAJ;EH Bildu;PSE-EE;Zuriak
Araba;25;62.000;51.000;38.000;1.200
```

Bereizlea (`;` edo `,`) eta milakoen puntuak automatikoki antzematen dira. `Zuriak` zutabea boto
zuritzat hartzen da, ez alderdi gisa.

## Egoera

**1. fasea osatuta**: barruti anitzeko zerrenda proportzionala, metodo guztiekin.

Hurrengoak: sistema maioritarioak (FPTP, bi itzuli) → sistema mistoak (MMM, MMP overhang-arekin) →
zerrenda irekiak eta boto ordenatua (STV, IRV).
