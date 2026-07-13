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

- **Sistema elektorala** aldatu: zerrenda proportzionala, **FPTP**, **bi itzuli**, **MMM** (mistoa
  paraleloa), **MMP** (mistoa konpentsatzailea, overhang-arekin) edo **STV/IRV** (boto ordenatua).
- **Zerrenda-mota** aldatu: itxia, irekia edo malgua — nor sartzen den erabakitzen du.
- **Alderdiak** gehitu, kendu, berrizendatu, kolorez aldatu eta ezker-eskuin ardatzean kokatu.
- **Eserlekuak** igo eta jaitsi, guztira edo barrutika.
- **Barrera elektorala** mugitu (%0–15), barrutika edo estatu mailan, boto zuriak izendatzailean
  sartuta edo gabe.
- **Banaketa-metodoa** aldatu: D'Hondt, Sainte-Laguë (arrunta eta aldatua), Imperiali, Daniarra,
  Huntington-Hill, eta kuota-metodoak (Hare, Droop, Hagenbach-Bischoff, Imperiali) hondar
  handienarekin.
- **Barrutiak** gehitu eta kendu: sistema barruti anitzekoa da.
- **Boto-transferentziak** editatu bigarren itzulirako (ikus behean).
- **Koalizioak** eraiki eta gehiengo absolutua lortzen den ikusi; gutxieneko koalizio irabazleak
  automatikoki kalkulatzen dira.
- **Proportzionaltasuna** neurtu: Gallagher, Loosemore-Hanby, galdutako botoak, alderdi eraginkorrak.
- **Sistema eta metodo guztiak konparatu** datu berberekin, taula bakarrean.
- **CSV** inportatu eta esportatu.

## Bi itzuliaz: zer den hipotesi bat eta zer den datu bat

Bigarren itzuli baten emaitza kalkulatzeko, bigarren itzuliko botoak behar dira. **Ez dira
existitzen.** Alderdi bat kanporatzean bere hautesleak nora joango diren ez dago boto-kopuruetan.

Aplikazioak ez du asmatzen: **transferentzia-matrize bat eskatzen du**, erabiltzaileak editagarria
(`Transferentziak` fitxa). Lehenetsia hurbiltasun ideologikoan oinarritzen da (ezker-eskuin ardatza)
gehi abstentzio-tasa bat, baina hipotesi bat da eta hala aurkezten da. Aldatu eta ikusi emaitzak
zenbat mugitzen diren — hori da tresnaren balioa.

Matrize berbera erabiliko du STVk 4. fasean.

## Sistema mistoak: lotura da dena

Bi maila dituzte: barruti uninominalak + zerrenda-eserlekuen poltsa nazionala. Aldea **bien arteko
lotura** da, eta emaitza guztiz bestelakoa da:

| Sistema | GOR (botoen %16,4) | Ganbera | Gallagher |
|---|---|---|---|
| FPTP | **0** | 75 | 17,6 |
| MMM (paraleloa) | 4 | 100 | 13,6 |
| MMP (konpentsatzailea) | **17** | 105 | **3,0** |

**MMM**-k bi mailak bereiz kalkulatzen ditu eta batu: zerrenda-eserlekuak oinarri desproportzional
baten gainean botatzen ditu, eta ia ez du ezer zuzentzen. **MMP**-k alderdi bakoitzari *dagokion*
guztizkoa kalkulatzen du eta barrutietan irabazitakoa kentzen dio — konpentsazioa benetakoa da.

### Overhang

Alderdi batek dagokiona baino barruti **gehiago** irabaz ditzake. Eserlekuak ezin zaizkio kendu
(barrutian irabazi ditu), beraz zerbait hautsi behar da. Hiru irtenbide, hirurak benetakoak:

| Erregela | Zer egiten du | Prezioa |
|---|---|---|
| **Mantendu** | Ganbera hazi (Alemania 2013 arte) | Proportzionaltasuna ez da erabatekoa |
| **Orekatu** | Eserleku gehiago gehitu proportzionala izan arte (*Ausgleichsmandate*) | Ganbera asko hazten da (100 → 123) |
| **Finkoa** | Ganberak ez du hazten | Besteek konpentsazio gutxiago dute |

Zerrenda-poltsa txikitu eta overhang-a agertzen ikusiko duzu.

## STV: proportzionaltasuna NONDIK datorren

STVn hautagaiak lehiatzen dira, ez alderdiak, eta hautesleak ordenatu egiten ditu. Droop kuota da
langa; ez dago beste bat. Boto-txartel ordenatuak ez daudenez, **bi itzuliko matrize berberetik**
sortzen dira.

Emaitzak gauza bat argi uzten du, sarritan gaizki ulertzen dena:

| | Barrutiak | Gallagher |
|---|---|---|
| FPTP | 75 × 1 eserleku | 17,6 |
| **IRV** | 75 × 1 eserleku | **17,5** |
| D'Hondt | 3 × 25 eserleku | 2,2 |
| **STV** | 3 × 25 eserleku | **2,3** |

**Boto ordenatuak berak ez dakar proportzionaltasunik.** Eserleku bakarreko barrutian IRV sistema
*maioritarioa* da, FPTP bezain desproportzionala — nor irabazten duen aldatzen du, ez zenbat.
STVren proportzionaltasuna **barrutiaren tamainatik** dator. Bi probak zaintzen dute hori.

## Zerrenda irekiak: nor, ez zenbat

Zerrenda-motak alderdiaren eserleku **kopurua ez du aldatzen** — hautagaien **ordena** baizik.
Geruza bat da, edozein sistema proportzionalen gainean doana.

| Modua | Nork erabakitzen du |
|---|---|
| **Itxia** | Alderdiak: zerrendako ordena |
| **Irekia** | Hautesleak: lehentasun-boto gehien dutenak (Finlandia, Brasil) |
| **Malgua** | Erdibidea: kuota gainditzen dutenak aurreratzen dira (Herbehereak) |

Hautagaiak eta lehentasun-botoak **eszenatokitik ondorioztatzen dira** modu deterministan (hazi
finkoarekin), ez dira gordetzen. Erabiltzaileak edita ditzake; gainidazketak bakarrik gordetzen dira.

## Arkitektura

`src/core/` **UI-rik gabeko TypeScript hutsa da**, funtzio puruz osatua eta guztiz probatua.
Hori ez da purismoa: D'Hondt edo MMP gaizki inplementatzeak emaitza *sinesgarri baina okerra* ematen
du, eta begiz ezin da antzeman. Probak dira sare bakarra.

| Fitxategia | Zer den |
|---|---|
| `core/allocate.ts` | Esleipenaren **sarrera-puntu bakarra**. Sistema proportzional guztiek hemendik pasatzen dute. |
| `core/divisors.ts` · `core/quotas.ts` | Metodoen definizioak. |
| `core/threshold.ts` | Langa: esparrua, barrutiko gainidazketa, boto zuriak. |
| `core/systems/listPR.ts` | Zerrenda proportzionala, barruti anitzekoa. |
| `core/systems/majoritarian.ts` | FPTP eta bi itzuli. `pluralityDistricts()` sistema mistoek berrerabiltzen dute. |
| `core/systems/mixed.ts` | MMM eta MMP, overhang-aren hiru erregelekin. |
| `core/systems/stv.ts` | STV eta IRV: Droop kuota, Gregory-ren transferentzia frakzionala. |
| `core/candidates.ts` | Hautagaiak eta zerrenda-motak (itxia/irekia/malgua). |
| `core/transfers.ts` | Boto-transferentzien matrizea. **Bi itzulik eta STVk berbera erabiltzen dute.** |
| `core/indices.ts` · `core/coalitions.ts` | Neurriak eta koalizioak. |
| `core/hemicycle.ts` | Hemizikloaren geometria (funtzio purua, probatua). |
| `core/color.ts` | OKLCH: alderdien koloreak gai argira eta ilunera egokitzen ditu. |

**Ideia gakoa:** barruti uninominal bat `seats: 1` duen barruti arrunta da. Horri esker FPTP-k eta
sistema mistoek datu-eredu **berbera** erabiltzen dute; ez da beste bat behar.

## Bi inbariante

1. **Esleitutako eserlekuak = barruti guztien eserlekuak.** Beti, sistema eta metodo guztietan.
   Hori hausten bada, dena dago hautsita.
2. **Barruti uninominaletan, D'Hondt eta FPTP emaitza berbera ematen dute.** Eserleku bakarrarekin,
   zatidurarik handiena boto gehien dituenarena da — hau da, D'Hondt *pluralitatea da*. Aurreko
   ideia gakoa egiaztatzen du: hori hausten bada, datu-eredua dago oker.

Bi inbarianteek proba bana dute.

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

Lau faseak osatuta. Sei sistema elektoral, hamar banaketa-metodo, hiru zerrenda-mota.

| Fasea | Zer |
|---|---|
| 1 | Barruti anitzeko zerrenda proportzionala, metodo guztiekin, hemizikloa, koalizioak, indizeak, CSV |
| 2 | Sistema maioritarioak: FPTP eta bi itzuli, transferentzia-matrizearekin |
| 3 | Sistema mistoak: MMM eta MMP, overhang-aren hiru erregelekin, boto banatua |
| 4 | Zerrenda irekiak eta boto ordenatua: STV eta IRV |

**188 proba**, motorraren zati bakoitza eta UI-aren muntaia estaltzen dituztenak.
