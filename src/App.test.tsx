// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { useApp } from './state/scenario';
import { DEFAULT_SYSTEM_CONFIG } from './core/systems';
import {
  DEFAULT_SCENARIO,
  SINGLE_DISTRICT_SCENARIO,
  SINGLE_MEMBER_SCENARIO,
} from './data/examples';

/**
 * Muntatze-proba. Proba unitarioek motorra egiaztatzen dute, baina ez dute frogatzen APLIKAZIOA
 * marrazten denik: osagai batek exekuzioan huts egin dezake, kalkulua zuzena izanda ere.
 * Hemen benetan muntatzen dugu, kontrolak erabiltzen ditugu eta emaitza ikusten dugu.
 */

const seatCircles = (container: HTMLElement) => container.querySelectorAll('svg circle');

beforeEach(() => {
  useApp.setState({
    scenario: DEFAULT_SCENARIO,
    config: DEFAULT_SYSTEM_CONFIG,
    coalition: [],
    past: [],
    future: [],
  });
});

describe('aplikazioa muntatzea', () => {
  it('marrazten da eta 75 eserleku erakusten ditu hemizikloan', () => {
    const { container } = render(<App />);
    expect(screen.getByRole('heading', { name: 'Hauteskunde Kalkulagailua' })).toBeInTheDocument();
    expect(seatCircles(container)).toHaveLength(75);
  });

  it('alderdi guztiak agertzen dira emaitza-taulan', () => {
    render(<App />);
    for (const p of DEFAULT_SCENARIO.parties) {
      expect(screen.getAllByText(p.name).length).toBeGreaterThan(0);
    }
  });
});

describe('kontrolek emaitza aldatzen dute', () => {
  it("metodoa aldatzeak eserlekuak mugitzen ditu (D'Hondt → Sainte-Laguë)", () => {
    render(<App />);

    const seatsOf = (name: string) => {
      const row = screen.getAllByText(name)[0].closest('tr')!;
      return within(row).getAllByRole('cell')[3].textContent;
    };

    const before = DEFAULT_SCENARIO.parties.map((p) => seatsOf(p.name));

    fireEvent.change(screen.getByLabelText('Banaketa-metodoa'), {
      target: { value: 'sainte-lague' },
    });

    const after = DEFAULT_SCENARIO.parties.map((p) => seatsOf(p.name));
    expect(after).not.toEqual(before);
  });

  it('langa igotzeak alderdi txikiak kentzen ditu, baina eserleku guztiak banatuta jarraitzen dute', () => {
    const { container } = render(<App />);

    fireEvent.change(screen.getByLabelText('Langaren ehunekoa'), { target: { value: '15' } });

    // Inbariante nagusia: langak alderdiak kentzen ditu, ez eserlekuak.
    expect(seatCircles(container)).toHaveLength(75);

    const laranja = screen.getAllByText('Alderdi Laranja')[0].closest('tr')!;
    expect(within(laranja).getAllByRole('cell')[3]).toHaveTextContent('0');
  });

  it('boto zuriek langa altxatzen dute eta Alderdi Laranjak eserlekuak galtzen ditu', () => {
    // Barruti BAKARREKO eszenatokia: han legezko langak eragina du (berezko langa ~%1,3 baita).
    // Hiru barrutiko eszenatokian etengailuak Laranja langatik kanpo uzten du Araban, baina hori
    // ez da nabaritzen: 25 eserlekuko barrutian ez zuen eserlekurik lortuko hala ere.
    useApp.setState({ scenario: SINGLE_DISTRICT_SCENARIO });
    render(<App />);

    const laranjaSeats = () =>
      Number(
        within(screen.getAllByText('Alderdi Laranja')[0].closest('tr')!).getAllByRole('cell')[3]
          .textContent,
      );

    const toggle = screen.getByRole('checkbox', { name: /boto zuriak/i });
    expect(toggle).toBeChecked();

    // Zuriak barne: 27.000 / 911.000 = %2,96 → langatik kanpo.
    expect(laranjaSeats()).toBe(0);

    fireEvent.click(toggle);

    // Zuriak kanpo: 27.000 / 900.000 = %3,0 zehatz → langa gainditzen du eta eserlekuak hartzen ditu.
    expect(laranjaSeats()).toBeGreaterThan(0);
  });
});

describe('koalizioak', () => {
  it('alderdi bat klikatzeak koalizioan sartzen du eta eserlekuak batzen ditu', () => {
    render(<App />);

    const row = screen.getAllByText('Alderdi Urdina')[0].closest('tr')!;
    const seats = Number(within(row).getAllByRole('cell')[3].textContent);
    fireEvent.click(row);

    // Errenkadak "koalizioan" bereizgarria hartzen du.
    expect(within(row).getByText('koalizioan')).toBeInTheDocument();
    // Eta koalizioaren kontagailuak alderdiaren eserlekuak erakusten ditu.
    expect(screen.getByText(new RegExp(`^${seats} / \\d+ eserleku$`))).toBeInTheDocument();
  });
});

describe('sistema maioritarioak (2. fasea)', () => {
  const seatsOf = (name: string) =>
    Number(
      within(screen.getAllByText(name)[0].closest('tr')!).getAllByRole('cell')[3].textContent,
    );

  const selectSystem = (value: string) =>
    fireEvent.change(screen.getByLabelText('Sistema elektorala'), { target: { value } });

  it('FPTPra aldatzeak emaitza guztiz aldatzen du eserleku kopurua mantenduz', () => {
    // 3 barruti × 25 eserleku. Proportzionalean sei alderdik dute ordezkaritza.
    const { container } = render(<App />);
    expect(seatsOf('Alderdi Gorria')).toBeGreaterThan(0);

    selectSystem('fptp');

    // FPTPn barrutiko irabazleak DENAK hartzen ditu: Urdinak, botoen %30ekin, legebiltzarraren
    // bi heren. Beste guztiak zeroan. Baina 75 eserlekuak banatuta jarraitzen dute.
    expect(seatsOf('Alderdi Urdina')).toBe(50);
    expect(seatsOf('Alderdi Gorria')).toBe(0);
    expect(container.querySelectorAll('svg circle')).toHaveLength(75);
  });

  it('barruti uninominaletan FPTP eta D\'Hondt BERDINAK dira — eta hori UI-an ikusten da', () => {
    // Ez da akats bat: eserleku BAKARRA dagoenean, zatidurarik handiena boto gehien dituenarena da.
    // "Proportzionala" hitzak ez du esan nahi ezer barruti uninominal batean.
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);

    const prSeats = SINGLE_MEMBER_SCENARIO.parties.map((p) => seatsOf(p.name));
    selectSystem('fptp');
    const fptpSeats = SINGLE_MEMBER_SCENARIO.parties.map((p) => seatsOf(p.name));

    expect(fptpSeats).toEqual(prSeats);
  });

  it('sistema maioritarioan langa eta metodoa desagertzen dira', () => {
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);

    expect(screen.getByLabelText('Banaketa-metodoa')).toBeInTheDocument();
    selectSystem('fptp');

    expect(screen.queryByLabelText('Banaketa-metodoa')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Langaren ehunekoa')).not.toBeInTheDocument();
    expect(screen.getByText(/ez dute langarik ez banaketa-metodorik/i)).toBeInTheDocument();
  });

  it('barruti anitzeko eszenatokian FPTPk abisatzen du: irabazleak denak hartzen ditu', () => {
    render(<App />); // DEFAULT_SCENARIO: 3 barruti × 25 eserleku
    selectSystem('fptp');
    expect(screen.getAllByText(/general ticket/i).length).toBeGreaterThan(0);
  });

  it('bi itzulik transferentzien fitxa erakusten du, eta matrizea editagarria da', () => {
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);

    expect(screen.queryByRole('tab', { name: 'Transferentziak' })).not.toBeInTheDocument();
    selectSystem('two-round');

    fireEvent.click(screen.getByRole('tab', { name: 'Transferentziak' }));
    expect(screen.getByLabelText('Alderdi Moreatik Alderdi Berdeara')).toBeInTheDocument();
    expect(screen.getByText(/ez daude datuetan/i)).toBeInTheDocument();
  });

  it('transferentzia-matrizea aldatzeak emaitza aldatzen du', () => {
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);
    selectSystem('two-round');

    const before = seatsOf('Alderdi Gorria');

    // Abstentzioa %0ra: transferentzia gehiago iristen dira, eta emaitzak mugitzen dira.
    fireEvent.click(screen.getByRole('tab', { name: 'Transferentziak' }));
    fireEvent.change(screen.getByLabelText('Hurbiltasunaren zorroztasuna'), {
      target: { value: '80' },
    });

    expect(seatsOf('Alderdi Gorria')).not.toBe(before);
  });

  it('barrutien taulak irabazlea erakusten du barrutiz barruti', () => {
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);
    selectSystem('fptp');

    fireEvent.click(screen.getByRole('tab', { name: 'Barrutiak' }));
    expect(screen.getByRole('columnheader', { name: 'Irabazlea' })).toBeInTheDocument();
    expect(screen.getByText('1. barrutia')).toBeInTheDocument();
  });
});

describe('sistema mistoak (3. fasea)', () => {
  const seatsOf = (name: string) =>
    Number(
      within(screen.getAllByText(name)[0].closest('tr')!).getAllByRole('cell')[3].textContent,
    );

  const selectSystem = (value: string) =>
    fireEvent.change(screen.getByLabelText('Sistema elektorala'), { target: { value } });

  beforeEach(() => useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO }));

  it('MMP-k FPTPk ezabatutako alderdia berpizten du', () => {
    const { container } = render(<App />);
    selectSystem('fptp');
    expect(seatsOf('Alderdi Gorria')).toBe(0); // botoen %16,4rekin

    selectSystem('mmp');

    // Zerrenda-mailak konpentsatzen du: dagokiona hurbil lortzen du.
    expect(seatsOf('Alderdi Gorria')).toBeGreaterThan(10);
    // Ganbera 75 barruti + 25 zerrenda = 100 (gehi overhang-a).
    expect(container.querySelectorAll('svg circle').length).toBeGreaterThanOrEqual(100);
  });

  it('MMM-k EZ du konpentsatzen: hori da MMPrekiko aldea', () => {
    render(<App />);

    selectSystem('mmm');
    const mmmSeats = seatsOf('Alderdi Gorria');

    selectSystem('mmp');
    const mmpSeats = seatsOf('Alderdi Gorria');

    // Maila berberak, poltsa berbera — baina lotura egoteak dena aldatzen du.
    expect(mmpSeats).toBeGreaterThan(mmmSeats * 2);
  });

  it('bi mailen taulak barrutiak, dagokiona eta zerrenda erakusten ditu', () => {
    render(<App />);
    selectSystem('mmp');

    fireEvent.click(screen.getByRole('tab', { name: 'Bi mailak' }));
    expect(screen.getByRole('columnheader', { name: 'Barrutiak' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Dagokiona' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Zerrenda' })).toBeInTheDocument();
  });

  it('zerrenda-poltsa txikitzeak overhang-a agerrarazten du', () => {
    render(<App />);
    selectSystem('mmp');

    // Poltsa handiarekin ez dago overhang-ik.
    fireEvent.change(screen.getByLabelText('Zerrenda-mailako eserlekuak'), {
      target: { value: '150' },
    });
    expect(screen.queryByText(/overhang eserleku/i)).not.toBeInTheDocument();

    // Poltsa txikituta, alderdiren batek dagokiona baino barruti gehiago irabazten ditu.
    fireEvent.change(screen.getByLabelText('Zerrenda-mailako eserlekuak'), {
      target: { value: '10' },
    });
    expect(screen.getAllByText(/overhang eserleku/i).length).toBeGreaterThan(0);
  });

  it('overhang-aren hiru erregelek ganbera desberdinak ematen dituzte', () => {
    const { container } = render(<App />);
    selectSystem('mmp');
    fireEvent.change(screen.getByLabelText('Zerrenda-mailako eserlekuak'), {
      target: { value: '25' },
    });

    const chamber = () => container.querySelectorAll('svg circle').length;
    const rule = (value: string) =>
      fireEvent.change(screen.getByLabelText('Overhang-aren erregela'), { target: { value } });

    rule('fixed');
    const fixed = chamber();
    rule('keep');
    const keep = chamber();
    rule('leveling');
    const leveling = chamber();

    // Finkoak ez du hazten; mantentzeak apur bat; orekatzeak gehien.
    expect(fixed).toBe(100);
    expect(keep).toBeGreaterThan(fixed);
    expect(leveling).toBeGreaterThan(keep);
  });

  it('bigarren botoa piztuta, editatzeko taula agertzen da', () => {
    render(<App />);
    selectSystem('mmp');

    expect(screen.queryByText('Bigarren botoa (zerrenda)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /bigarren botoa/i }));

    fireEvent.click(screen.getByRole('tab', { name: 'Datuak' }));
    expect(screen.getByText('Bigarren botoa (zerrenda)')).toBeInTheDocument();
  });
});

describe('zerrenda irekiak eta STV (4. fasea)', () => {
  const seatsOf = (name: string) =>
    Number(
      within(screen.getAllByText(name)[0].closest('tr')!).getAllByRole('cell')[3].textContent,
    );

  const selectSystem = (value: string) =>
    fireEvent.change(screen.getByLabelText('Sistema elektorala'), { target: { value } });

  it('zerrenda-motak ez du eserleku kopurua aldatzen, nor sartzen den baizik', () => {
    render(<App />);

    const before = DEFAULT_SCENARIO.parties.map((p) => seatsOf(p.name));

    fireEvent.click(screen.getByRole('tab', { name: 'Hautagaiak' }));
    fireEvent.change(screen.getByLabelText('Zerrenda-mota'), { target: { value: 'open' } });

    // Eserlekuak berdin-berdin: geruza honek NOR aldatzen du, ez ZENBAT.
    expect(DEFAULT_SCENARIO.parties.map((p) => seatsOf(p.name))).toEqual(before);
    // Baina hautagaien ordena aldatu da: norbait aurreratu da.
    expect(screen.getAllByText('aurreratua').length).toBeGreaterThan(0);
  });

  it('zerrenda itxian ezin dira lehentasun-botoak editatu', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hautagaiak' }));

    const input = screen.getAllByLabelText(/lehentasun-botoak$/i)[0];
    expect(input).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Zerrenda-mota'), { target: { value: 'open' } });
    expect(screen.getAllByLabelText(/lehentasun-botoak$/i)[0]).toBeEnabled();
  });

  it('STV: Droop kuota erakusten du eta erronda-erronda kontatzen du', () => {
    render(<App />);
    selectSystem('stv');

    fireEvent.click(screen.getByRole('tab', { name: 'Erronda-erronda' }));
    // "Droop kuota" alboko panelean ere agertzen da: hemen erronda-taula bilatzen dugu.
    expect(screen.getByRole('columnheader', { name: 'Erronda' })).toBeInTheDocument();
    expect(screen.getAllByText('hautatua').length).toBeGreaterThan(0);
    expect(screen.getAllByText('kanporatua').length).toBeGreaterThan(0);
  });

  it('STV-k eserleku guztiak esleitzen ditu', () => {
    const { container } = render(<App />);
    selectSystem('stv');
    expect(container.querySelectorAll('svg circle')).toHaveLength(75);
  });

  it('STVk transferentzia-matrizea erabiltzen du: aldatuz gero, emaitza aldatzen da', () => {
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);
    selectSystem('stv');

    const before = SINGLE_MEMBER_SCENARIO.parties.map((p) => seatsOf(p.name));

    fireEvent.click(screen.getByRole('tab', { name: 'Transferentziak' }));
    fireEvent.change(screen.getByLabelText('Abstentzio lehenetsia'), { target: { value: '90' } });

    expect(SINGLE_MEMBER_SCENARIO.parties.map((p) => seatsOf(p.name))).not.toEqual(before);
  });

  it('STVn langa eta metodoa desagertzen dira: Droop kuota da langa', () => {
    render(<App />);
    selectSystem('stv');

    expect(screen.queryByLabelText('Banaketa-metodoa')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Langaren ehunekoa')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Droop kuota/i).length).toBeGreaterThan(0);
  });

  it('barruti uninominaletan STV IRV dela dio, ez STV', () => {
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);
    selectSystem('stv');

    // Testua elementutan zatituta dago (<strong>IRV</strong>), beraz edukiontziaren testua begiratzen dugu.
    const note = screen
      .getAllByText(/kanporaketa\s*mailakatua/i)[0]
      .closest('p');
    expect(note!.textContent).toMatch(/IRV/);
  });
});

describe('eszenatokien hautatzailea', () => {
  const seatsOf = (name: string) =>
    Number(
      within(screen.getAllByText(name)[0].closest('tr')!).getAllByRole('cell')[3].textContent,
    );

  it('ez du bikoizketarik: uneko eszenatokia behin bakarrik agertzen da', () => {
    // Akats zaharra: goitibeherak `<option value="">{scenario.name}</option>` zuen, eta gero
    // eszenatoki bera zerrendan errepikatzen zen.
    render(<App />);
    expect(screen.getAllByRole('radio', { name: /3 barruti × 25 eserleku/ })).toHaveLength(1);
  });

  it('eszenatoki bakoitzak bere azalpena erakusten du (lehen botatzen zen)', () => {
    render(<App />);
    // Hasierako eszenatokiaren azalpena ikusgai dago, klik egin gabe.
    expect(screen.getByText(/BEREZKO langa ~%3,8 da/)).toBeInTheDocument();

    // Eta talde-goiburuak esperimentua azaltzen du.
    expect(screen.getByText(/Boto BERBERAK, 75 eserleku/)).toBeInTheDocument();
  });

  it('hauteskunde erreal batek EMAITZA OFIZIALA ematen du klik bakar batez', () => {
    // Hau da benetan inporta duena. Lehen, eszenatokiak bere arau legalak ez zekartzanez, Eusko
    // Legebiltzarra kargatuta zure uneko langarekin kalkulatuko luke — eta emaitza ez litzateke
    // ofiziala izango, jakin gabe zergatik.
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Eusko Legebiltzarra 2024/ }));

    expect(seatsOf('EAJ-PNV')).toBe(27);
    expect(seatsOf('EH BILDU')).toBe(27);
    expect(seatsOf('PSE-EE/PSOE')).toBe(12);
    expect(seatsOf('PP')).toBe(7);
    expect(seatsOf('SUMAR')).toBe(1);
    expect(seatsOf('VOX')).toBe(1);
  });

  it('Europako Parlamentuak langarik gabe kargatzen du (bere legea)', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Europako Parlamentua 2024/ }));

    // Ez da %3 — Espainiako Europako hauteskundeek ez dute langarik.
    expect((screen.getByLabelText('Langaren ehunekoa') as HTMLInputElement).value).toBe('0');
  });

  it('Kongresua kargatzeak 52 barruti eta 350 eserleku dakartza', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Espainiako Kongresua 2023/ }));

    expect(container.querySelectorAll('svg circle')).toHaveLength(350);
    expect(seatsOf('Partido Popular (PP)')).toBe(137);
  });

  it('hautatutakoa nabarmenduta geratzen da', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Nafarroako Parlamentua 2023/ }));

    expect(screen.getByRole('radio', { name: /Nafarroako Parlamentua 2023/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /3 barruti × 25 eserleku/ })).not.toBeChecked();
  });
});

describe('barrutien kudeaketa eta bateratzea', () => {
  const seatsOf = (name: string) =>
    Number(
      within(screen.getAllByText(name)[0].closest('tr')!).getAllByRole('cell')[3].textContent,
    );

  const openData = () => fireEvent.click(screen.getByRole('tab', { name: 'Datuak' }));

  it('KONGRESUA BATERATUTA: Vox 33 → 48, Sumar 31 → 48', () => {
    // Hau da funtzio honen arrazoia. Lehen zenbaki hauek proba batean bakarrik zeuden, eskuz
    // kalkulatuta. Orain erabiltzaileak klik batez lortzen ditu: boto berberak, 350 eserleku
    // berberak, D'Hondt eta %3 berberak — barrutien tamaina da aldatzen den GAUZA BAKARRA.
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Espainiako Kongresua 2023/ }));

    expect(seatsOf('VOX (VOX)')).toBe(33);
    expect(seatsOf('Sumar (SUMAR)')).toBe(31);

    openData();
    fireEvent.click(screen.getByRole('button', { name: /Bateratu DENAK/ }));

    expect(seatsOf('VOX (VOX)')).toBe(48);
    expect(seatsOf('Sumar (SUMAR)')).toBe(48);

    // Eta alderdi eskualdekoak desagertu egiten dira: %3ko langa nazionala bihurtu da.
    expect(seatsOf('Euskal Herria Bildu (EH Bildu)')).toBe(0);
    expect(seatsOf('Esquerra Republicana de Catalunya (ERC)')).toBe(0);
  });

  it('erkidegoka bateratzeak 52 barruti 19 bihurtzen ditu, eserlekuak galdu gabe', () => {
    const { container } = render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Espainiako Kongresua 2023/ }));
    openData();

    fireEvent.click(screen.getByRole('button', { name: /Bateratu autonomia erkidegoka/ }));

    expect(screen.getByRole('heading', { name: /^Barrutiak \(19\)$/ })).toBeInTheDocument();
    expect(container.querySelectorAll('svg circle')).toHaveLength(350);

    // Erkidegoka, alderdi eskualdekoek beren eserlekuak MANTENTZEN dituzte (bakarrean galtzen
    // dituzten bitartean): beren erkidegoan %3a gainditzen dute.
    expect(seatsOf('Euskal Herria Bildu (EH Bildu)')).toBeGreaterThan(0);
  });

  it('erkidegoen botoia Kongresuan bakarrik agertzen da', () => {
    render(<App />);
    openData();
    expect(screen.queryByRole('button', { name: /erkidegoka/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /Espainiako Kongresua 2023/ }));
    openData();
    expect(screen.getByRole('button', { name: /erkidegoka/ })).toBeInTheDocument();
  });

  it('hautatutako barrutiak bateratzen ditu, eta Desegin-ek atzera botatzen du', () => {
    const { container } = render(<App />);
    openData();

    // Eusko Legebiltzarraren egitura: Araba, Bizkaia, Gipuzkoa (25 + 25 + 25).
    fireEvent.click(screen.getByRole('checkbox', { name: /Araba hautatu/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Bizkaia hautatu/ }));
    fireEvent.click(screen.getByRole('button', { name: /Bateratu hautatutakoak/ }));

    expect(screen.getByRole('heading', { name: /^Barrutiak \(2\)$/ })).toBeInTheDocument();
    expect(screen.getByText('Araba + Bizkaia')).toBeInTheDocument();
    // Eserlekuak ez dira galtzen: 25 + 25 = 50, gehi Gipuzkoako 25 = 75.
    expect(container.querySelectorAll('svg circle')).toHaveLength(75);

    fireEvent.click(screen.getByRole('button', { name: /Desegin/ }));
    expect(screen.getByRole('heading', { name: /^Barrutiak \(3\)$/ })).toBeInTheDocument();
  });

  it('hainbat barruti batera ezabatzen ditu', () => {
    render(<App />);
    openData();

    fireEvent.click(screen.getByRole('checkbox', { name: /Araba hautatu/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Bizkaia hautatu/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Ezabatu/ }));

    expect(screen.getByRole('heading', { name: /^Barrutiak \(1\)$/ })).toBeInTheDocument();
  });

  it('75 barruti dituen eszenatokia zerrendan ikusten da (lehen goitibehera bat zen)', () => {
    useApp.setState({ scenario: SINGLE_MEMBER_SCENARIO });
    render(<App />);
    openData();

    expect(screen.getByRole('heading', { name: /^Barrutiak \(75\)$/ })).toBeInTheDocument();
    // Zerrenda osoa dago, ez barruti bakarra.
    expect(screen.getByText('1. barrutia')).toBeInTheDocument();
    expect(screen.getByText('75. barrutia')).toBeInTheDocument();
  });
});

describe('zatiduren taula', () => {
  const openTable = () => fireEvent.click(screen.getByRole('tab', { name: 'Nola banatu diren' }));
  const divisors = () =>
    screen.getAllByRole('columnheader').filter((h) => h.textContent?.startsWith('÷')).length;

  it('zutabe kopurua irabazitako eserlekuetatik ondorioztatzen da, ez 14tan finkatuta', () => {
    // Lehen `Math.min(district.seats, 14)` zegoen kodean finkatuta. 350 eserlekuko barruti batean
    // PPk 130 eserleku hartzen ditu, eta bere 130. zatidura ikusteko 130 zutabe behar dira: taula
    // erabilgaitza zen.
    render(<App />); // 3 barruti × 25 eserleku; alderdirik handienak ~11 eserleku
    openTable();

    const automatic = divisors();
    expect(automatic).toBeGreaterThan(10);
    expect(automatic).toBeLessThanOrEqual(25); // barrutiaren eserlekuek mugatzen dute
  });

  it('"Denak" botoiak barrutiaren eserleku guztietaraino zabaltzen du', () => {
    render(<App />);
    openTable();

    fireEvent.click(screen.getByRole('button', { name: /Denak \(25\)/ }));
    expect(divisors()).toBe(25);
  });

  it('eskuz ere jar daiteke, eta automatikora itzul daiteke', () => {
    render(<App />);
    openTable();

    fireEvent.change(screen.getByLabelText('Zatitzaileak:'), { target: { value: '20' } });
    expect(divisors()).toBe(20);

    fireEvent.click(screen.getByRole('button', { name: /Automatikoa/ }));
    expect(divisors()).toBeLessThan(20);
  });

  it('ganbera handietan zutabe asko erakusten ditu (Kongresua bateratuta)', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('radio', { name: /Espainiako Kongresua 2023/ }));

    fireEvent.click(screen.getByRole('tab', { name: 'Datuak' }));
    fireEvent.click(screen.getByRole('button', { name: /Bateratu DENAK/ }));
    openTable();

    // PPk 130 eserleku ditu barruti bakarrean: zutabeek harago iritsi behar dute.
    expect(divisors()).toBeGreaterThan(130);
  });

  it('alderdien zutabea ITSATSITA dago: 130 zutaberekin errenkadak identifikagarriak dira', () => {
    const { container } = render(<App />);
    openTable();
    // Goiburua eta errenkada guztiak.
    expect(container.querySelectorAll('.sticky-col').length).toBeGreaterThan(1);
  });
});

describe('fitxak', () => {
  it('fitxa guztiak ireki daitezke erroririk gabe', () => {
    render(<App />);
    for (const label of ['Nola banatu diren', 'Proportzionaltasuna', 'Metodoen konparaketa', 'CSV', 'Datuak']) {
      fireEvent.click(screen.getByRole('tab', { name: label }));
      expect(screen.getByRole('tab', { name: label })).toHaveAttribute('aria-selected', 'true');
    }
  });

  it('konparaketa-taulak metodo guztiak erakusten ditu', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Metodoen konparaketa' }));
    expect(screen.getByRole('columnheader', { name: "D'Hondt" })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sainte-Laguë' })).toBeInTheDocument();
  });
});
