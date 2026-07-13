// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import { useApp } from './state/scenario';
import { DEFAULT_SCENARIO, SINGLE_DISTRICT_SCENARIO } from './data/examples';

/**
 * Muntatze-proba. Proba unitarioek motorra egiaztatzen dute, baina ez dute frogatzen APLIKAZIOA
 * marrazten denik: osagai batek exekuzioan huts egin dezake, kalkulua zuzena izanda ere.
 * Hemen benetan muntatzen dugu, kontrolak erabiltzen ditugu eta emaitza ikusten dugu.
 */

const seatCircles = (container: HTMLElement) => container.querySelectorAll('svg circle');

beforeEach(() => {
  useApp.setState({
    scenario: DEFAULT_SCENARIO,
    config: {
      system: 'list-pr',
      method: 'dhondt',
      threshold: { percent: 3, scope: 'district', includeBlank: true },
    },
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
