# Benetako hauteskunde-datuak

Sei hauteskunderen emaitza **ofizialak**, aplikazioan inportatzeko prest.

**Ez dago zenbaki asmaturik.** Dena iturri ofizialetatik dator, eta script-ek berak jaisten dituzte:
ez dago eskuz idatzitako daturik. Fitxategiak birsortzeko:

```bash
node datuak/sortu/euskadi.mjs     # Eusko Legebiltzarra 2024, 2020, 2016
node datuak/sortu/kongresua.mjs   # Espainiako Kongresua 2023
node datuak/sortu/nafarroa.mjs    # Nafarroako Parlamentua 2023
node datuak/sortu/europakoa.mjs   # Europako Parlamentua 2024
```

## Nola inportatu

Aplikazioan → **CSV** fitxa → *Fitxategia kargatu* (edo edukia itsatsi). Gero, alboko panelean,
hauteskunde horren **arau legalak** jarri:

| Fitxategia | Barrutiak | Eserlekuak | Metodoa | Langa |
|---|---|---|---|---|
| `eusko-legebiltzarra-2024.csv` | 3 × 25 | 75 | D'Hondt | %3 **barrutika** |
| `eusko-legebiltzarra-2020.csv` | 3 × 25 | 75 | D'Hondt | %3 **barrutika** |
| `eusko-legebiltzarra-2016.csv` | 3 × 25 | 75 | D'Hondt | %3 **barrutika** |
| `espainiako-kongresua-2023.csv` | 52 | 350 | D'Hondt | %3 **probintziaka** |
| `nafarroako-parlamentua-2023.csv` | 1 | 50 | D'Hondt | %3 |
| `europako-parlamentua-2024.csv` | 1 | 61 | D'Hondt | **langarik EZ** |

Kasu guztietan **boto zuriak izendatzailean sartu** behar dira: Espainiako eta Euskadiko legean
boto zuriak baliodunak dira, eta langa altxatzen dute.

## Iturriak

| Hauteskundea | Iturria |
|---|---|
| **Eusko Legebiltzarra** 2024 / 2020 / 2016 | Eusko Jaurlaritza, Segurtasun Saila — [hauteskunde-emaitzen fitxategi ofizialak](https://www.euskadi.eus/informazioa/hauteskundeetako-emaitzen-fitxategien-deskargak/web01-a2haukon/eu/). Botoak `Cir*.csv`-tik; eserleku ofizialak `Elec*.csv`-tik (hautetsien zerrenda) edo 2024ko `Jarlekuak` zutabetik. |
| **Espainiako Kongresua** 2023 | [BOE-A-2023-18907](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2023-18907) — Junta Electoral Central, eskrutinio orokorraren akta (2023-08-30). Botoak eta eserlekuak XMLko taula ofizialetatik; boto zuriak PDFko CUADRO I-etik. |
| **Nafarroako Parlamentua** 2023 | [Nafarroako Gobernua, datu irekiak](https://datosabiertos.navarra.es/es/dataset/resultados-de-las-elecciones-al-parlamento-de-navarra-agrupados-por-municipios) (CC-BY 4.0). Udalerrika datoz; Nafarroak barruti bakarra duenez, batu egiten dira. |
| **Europako Parlamentua** 2024 | [BOE-A-2024-13092](https://www.boe.es/diario_boe/txt.php?id=BOE-A-2024-13092) — Junta Electoral Central (2024-06-27). Espainiak barruti bakarra du: "Total estatal" lerroa. |

`emaitza-ofizialak.json` fitxategiak eserleku **ofizialak** gordetzen ditu, barrutiz barruti eta
alderdiz alderdi. Ez da apaingarria: probak hortik hartzen du egia.

## Nola dakigu datuak zuzenak direla

`src/data/benetakoDatuak.test.ts` probak CSV bakoitza inportatzen du, hauteskundearen legezko
arauekin exekutatzen du motorra, eta emaitza **eserleku ofizialen kontra** konparatzen du —
barrutiz barruti eta alderdiz alderdi.

Sei hauteskundeetan bat dator. 2016tik 2024ra, 3 barrutitik 52ra, 50 eserlekutik 350era.

Horrek **bi gauza** egiaztatzen ditu aldi berean: datuak ondo atera direla, eta **motorra zuzena
dela**. D'Hondt-ek, langak edo boto zurien izendatzaileak akatsen bat balu, hemen agertuko
litzateke.

Gainera, script bakoitzak **gurutze-egiaztapenak** egiten ditu jaistean, eta huts eginez gero
gelditu egiten da:

- Kongresua: XMLko alderdi guztien botoen batura = PDFko *"votos a candidaturas"*, 52 probintzietan.
- Nafarroa eta Europakoa: hautagaitzei emandako botoak + boto zuriak = boto baliodunak.
- Eusko Legebiltzarra: barruti bakoitzak zehazki 25 eserleku ofizial.

## Datuei buruzko oharrak

**Hautagaitza GUZTIAK daude**, ez alderdi handiak bakarrik. Kongresuan 59 hautagaitza daude, eta
horietako 47k ez zuten eserleku bakar bat ere lortu. Nahita: langa 0ra jaitsi eta zer gertatuko
litzatekeen ikus dezakezu. "Besteak" motako zutabe batek alderdi fantasma bat sortuko luke, eta
D'Hondt-ek eserlekuak eman liezazkioke — datuak faltsutzea litzateke.

**Alderdien koloreak eta ezker-eskuin posizioa** ez datoz CSVtik (formatuak ez ditu garraiatzen):
`src/data/knownParties.ts`-tik aplikatzen dira inportatzean.

> ⚠ **Ezker-eskuin posizioa iritzi bat da, ez datu bat.** Ardatz ekonomiko-soziala erabiltzen du,
> eta alderdi abertzaleak ez dira hor ondo sartzen (EAJ-PNV eta Junts zentro-eskuinekoak dira
> ekonomian baina abertzaleak; ERC eta EH Bildu ezkerrekoak eta abertzaleak). Hemizikloaren
> **ordena** bakarrik erabakitzen du — emaitzan ez du inolako eraginik. Aplikazioan alda dezakezu:
> **Datuak** fitxa → ezker-eskuin graduatzailea.

**Koalizioak eta izen-aldaketak.** Alderdiak urtez urte izenez aldatzen dira (2020an `PP+Cs`,
2024an `PP`), eta batzuek koalizioetan aurkezten dira (Europakoan `Ahora Repúblicas` = ERC + EH
Bildu + BNG + Ara Més). Izen ofizialak errespetatzen ditugu: bateratzeak datuak aldatzea litzateke.

## Zer probatu

- **Barruti txikien eragina.** Kargatu Kongresua eta konparatu: 52 barrutirekin Vox-ek 33 eserleku
  ditu, Sumar-ek 31. Boto berberekin barruti bakar batean, **48 eta 48**. Bien botoak Espainia osoan
  barreiatuta daude eta probintzia txikietan ez dute inon nahikoa metatzen.
- **Langaren eragina.** Kargatu Europakoa (langarik ez, 9 hautagaitzak eserlekua) eta igo langa
  %3ra: ikusi zenbat desagertzen diren.
- **Boto zuriak.** Eusko Legebiltzarra kargatu eta "boto zuriak izendatzailean" etengailua itzali:
  langa jaitsi egiten da, eta alderdi txikiren bat sar daiteke.
- **Metodoa.** Kargatu edozein eta aldatu D'Hondt → Sainte-Laguë. Ikusi eserlekuak alderdi
  txikietara mugitzen.
