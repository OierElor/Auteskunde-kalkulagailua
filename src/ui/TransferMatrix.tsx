import { buildTransferMatrix, cellKey } from '../core/transfers';
import type { PartyId } from '../core/types';
import { useApp } from '../state/scenario';
import { formatPercent } from './theme';
import type { PartyPaint } from './theme';

interface Props {
  paint: Record<PartyId, PartyPaint>;
}

/**
 * Transferentzia-matrizearen editorea.
 *
 * Hau da aplikazioaren atalik zintzoena: bigarren itzuliko botoak EZ DIRA EXISTITZEN, eta hemen
 * esplizitu egiten dugu zer hipotesi ari garen erabiltzen. Lehenetsia hurbiltasun ideologikoa da,
 * baina asmatutakoa da; erabiltzaileak alda dezake, eta emaitzak zenbat aldatzen diren ikusi.
 */
export function TransferMatrix({ paint }: Props) {
  const { scenario, config, setTransfers, setTransferCell, setPartyAbstention, resetTransfers } =
    useApp();

  const parties = scenario.parties;
  const matrix = buildTransferMatrix(parties, config.transfers);
  const overridden = (from: PartyId, to: PartyId) =>
    config.transfers.cells[cellKey(from, to)] !== undefined;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="banner">
        <span aria-hidden>ℹ</span>
        <div>
          Bigarren itzuliko botoak <strong>ez daude datuetan</strong>: alderdi bat kanporatzean bere
          hautesleak nora joango diren ez dago inon idatzita. Hemen zure hipotesia zehazten duzu.
          Lehenetsia <strong>hurbiltasun ideologikoa</strong> da (ezker-eskuin ardatza), baina
          hipotesi bat besterik ez da — aldatu eta ikusi emaitzak zenbat mugitzen diren.
        </div>
      </div>

      <div className="card stack">
        <h3>Parametro orokorrak</h3>

        <div className="spread">
          <label style={{ minWidth: 150 }}>Hurbiltasunaren zorroztasuna</label>
          <input
            type="range"
            min={5}
            max={80}
            step={1}
            value={config.transfers.affinity}
            onChange={(e) => setTransfers({ affinity: Number(e.target.value) })}
            aria-label="Hurbiltasunaren zorroztasuna"
          />
          <span className="value" style={{ minWidth: 34, textAlign: 'right' }}>
            {config.transfers.affinity}
          </span>
        </div>
        <p className="hint" style={{ marginTop: -4 }}>
          Txikiagoa: botoak ia dena alderdi hurbilenari. Handiagoa: banaketa lauagoa, ideologia gutxi
          axola.
        </p>

        <div className="spread">
          <label style={{ minWidth: 150 }}>Abstentzioa lehenetsia</label>
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={config.transfers.abstention}
            onChange={(e) => setTransfers({ abstention: Number(e.target.value) })}
            aria-label="Abstentzio lehenetsia"
          />
          <span className="value" style={{ minWidth: 34, textAlign: 'right' }}>
            %{config.transfers.abstention}
          </span>
        </div>
        <p className="hint" style={{ marginTop: -4 }}>
          Kanporatutako alderdi baten hautesleen zein zati geratzen den etxean bigarren itzulian.
        </p>

        <div className="row">
          <button onClick={resetTransfers}>Eskuzko aldaketak kendu</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Matrizea</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Errenkada = kanporatutako alderdia. Zutabea = bere botoak nora doazen. Errenkada bakoitza
          %100era normalizatzen da automatikoki. <strong>Lodiz</strong>: eskuz aldatutako gelaxkak.
        </p>

        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Kanporatua ↓ · Nora →</th>
                {parties.map((p) => (
                  <th key={p.id} className="num" style={{ minWidth: 74 }}>
                    <span className="party-cell" style={{ justifyContent: 'flex-end' }}>
                      <span
                        className="swatch"
                        style={{ background: paint[p.id]?.fill }}
                        aria-hidden
                      />
                      {p.abbrev}
                    </span>
                  </th>
                ))}
                <th className="num" style={{ minWidth: 86 }}>
                  Abstentzioa
                </th>
              </tr>
            </thead>
            <tbody>
              {parties.map((from) => (
                <tr key={from.id}>
                  <td>
                    <span className="party-cell">
                      <span
                        className="swatch"
                        style={{ background: paint[from.id]?.fill }}
                        aria-hidden
                      />
                      {from.name}
                    </span>
                  </td>

                  {parties.map((to) => {
                    if (to.id === from.id) {
                      return (
                        <td key={to.id} className="num muted" style={{ background: 'var(--grid)' }}>
                          —
                        </td>
                      );
                    }
                    const value = matrix.weights[from.id]?.[to.id] ?? 0;
                    return (
                      <td key={to.id} className="num">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={Math.round(value)}
                          onChange={(e) =>
                            setTransferCell(from.id, to.id, Number(e.target.value) || 0)
                          }
                          aria-label={`${from.name}tik ${to.name}ra`}
                          style={{
                            fontWeight: overridden(from.id, to.id) ? 700 : 400,
                            borderColor: overridden(from.id, to.id) ? 'var(--ink-2)' : undefined,
                          }}
                        />
                      </td>
                    );
                  })}

                  <td className="num">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(matrix.abstention[from.id] ?? 0)}
                      onChange={(e) =>
                        setPartyAbstention(from.id, Number(e.target.value) || 0)
                      }
                      aria-label={`${from.name} abstentzioa`}
                      style={{
                        fontWeight:
                          config.transfers.abstentions[from.id] !== undefined ? 700 : 400,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="hint" style={{ marginBottom: 0 }}>
          Adibidez: {parties[0]?.name} kanporatuta, bere botoen{' '}
          {formatPercent(matrix.abstention[parties[0]?.id] ?? 0, 0)} etxean geratzen da, eta
          gainerakoa goiko proportzioetan banatzen da bigarren itzulian dirauten alderdien artean.
        </p>
      </div>
    </div>
  );
}
