import { DIVISOR_METHODS } from '../core/divisors';
import { QUOTA_METHODS } from '../core/quotas';
import { SYSTEMS, systemSpec } from '../core/systems';
import type { DivisorMethodId, MethodId, QuotaMethodId } from '../core/types';
import { useApp } from '../state/scenario';
import { EXAMPLES } from '../data/examples';
import { formatInt } from './theme';

export function ControlPanel() {
  const {
    scenario,
    config,
    setSystem,
    setMethod,
    setThreshold,
    setRunoff,
    setMixed,
    enableSecondVotes,
    scaleAllSeats,
    loadExample,
  } = useApp();

  const totalSeats = scenario.districts.reduce((sum, d) => sum + d.seats, 0);
  const spec = systemSpec(config.system);
  const method = config.method;
  const methodSpec =
    method in DIVISOR_METHODS
      ? DIVISOR_METHODS[method as DivisorMethodId]
      : QUOTA_METHODS[method as QuotaMethodId];

  const uninominal = scenario.districts.every((d) => d.seats === 1);

  return (
    <>
      <div className="card stack">
        <h3>Eszenatokia</h3>
        <select
          value=""
          onChange={(e) => e.target.value && loadExample(e.target.value)}
          aria-label="Adibidea kargatu"
        >
          <option value="">{scenario.name}</option>
          {EXAMPLES.map((e) => (
            <option key={e.id} value={e.id}>
              {e.label}
            </option>
          ))}
        </select>
        <p className="hint">
          Datuak asmatuak dira. Zureak <strong>CSV</strong> fitxan karga ditzakezu.
        </p>
      </div>

      <div className="card stack">
        <h3>Sistema elektorala</h3>
        <select
          value={config.system}
          onChange={(e) => setSystem(e.target.value as never)}
          aria-label="Sistema elektorala"
        >
          {SYSTEMS.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.available}>
              {s.name}
              {s.available ? '' : ' — laster'}
            </option>
          ))}
        </select>
        <p className="hint">{spec.description}</p>

        {(!spec.proportional || spec.mixed) && !spec.ranked && !uninominal && (
          <div className="banner alert">
            <span aria-hidden>⚠</span>
            <div>
              Sistema honek <strong>barruti uninominalak</strong> behar ditu, baina barruti hauek
              eserleku bat baino gehiago dute: irabazleak <strong>denak</strong> hartzen ditu.
              Kargatu <em>75 barruti uninominal</em> adibidea emaitza esanguratsua ikusteko.
            </div>
          </div>
        )}

        {spec.ranked && (
          <p className="hint" style={{ margin: 0 }}>
            {uninominal ? (
              <>
                Barruti guztiek eserleku bat dute: hau <strong>IRV</strong> da (kanporaketa
                mailakatua), ez STV.
              </>
            ) : (
              <>
                Barrutiek eserleku bat baino gehiago dute: hau <strong>STV</strong> da. Benetako
                STV-barrutiek 3–6 eserleku izaten dituzte.
              </>
            )}
          </p>
        )}
      </div>

      {spec.proportional ? (
        <>
          <div className="card stack">
            <h3>Banaketa-metodoa</h3>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as MethodId)}
              aria-label="Banaketa-metodoa"
            >
              <optgroup label="Zatitzaileak">
                {Object.values(DIVISOR_METHODS).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.sequence})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Kuotak (hondar handiena)">
                {Object.values(QUOTA_METHODS).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.formula}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="hint">{methodSpec.description}</p>
          </div>

          <div className="card stack">
            <h3>Barrera elektorala</h3>
            <div className="spread">
              <input
                type="range"
                min={0}
                max={15}
                step={0.1}
                value={config.threshold.percent}
                onChange={(e) => setThreshold({ percent: Number(e.target.value) })}
                aria-label="Langaren ehunekoa"
              />
              <span className="value" style={{ minWidth: 48, textAlign: 'right' }}>
                %{config.threshold.percent.toFixed(1)}
              </span>
            </div>

            {spec.mixed ? (
              <p className="hint" style={{ margin: 0 }}>
                Sistema mistoetan langa <strong>beti nazionala</strong> da: eserleku-poltsa bakarra
                banatzen ari gara, eta ez luke zentzurik barrutiz barruti aplikatzeak. Alemaniako %5a
                horrelakoa da.
              </p>
            ) : (
              <select
                value={config.threshold.scope}
                onChange={(e) => setThreshold({ scope: e.target.value as 'district' | 'national' })}
                aria-label="Langaren esparrua"
              >
                <option value="district">Barruti bakoitzean aplikatu</option>
                <option value="national">Estatu mailan aplikatu</option>
              </select>
            )}

            <label className="checkbox">
              <input
                type="checkbox"
                checked={config.threshold.includeBlank}
                onChange={(e) => setThreshold({ includeBlank: e.target.checked })}
              />
              <span>
                Boto zuriak izendatzailean sartu
                <br />
                <span className="hint">
                  Espainiako eta Euskadiko legeak bai: boto zuriak baliodunak dira, eta langa
                  altxatzen dute alderdi txikientzat.
                </span>
              </span>
            </label>
          </div>
        </>
      ) : (
        <div className="card stack">
          <h3>Langa eta metodoa</h3>
          <p className="hint" style={{ margin: 0 }}>
            {spec.ranked ? (
              <>
                STVk <strong>ez du langarik ez banaketa-metodorik</strong>: <strong>Droop kuota</strong>{' '}
                da benetako langa, eta hautagaiak ordenatzen ditu, ez alderdiak. Boto-txartelak{' '}
                <strong>Transferentziak</strong> fitxako matrizetik sortzen dira.
              </>
            ) : (
              <>
                Sistema maioritarioek <strong>ez dute langarik ez banaketa-metodorik</strong>. Boto
                gehien dituenak barrutia irabazten du, %2 baino ez badu ere. Barrutiaren tamaina bera
                da langa —eta askoz gogorragoa.
              </>
            )}
          </p>
        </div>
      )}

      {spec.mixed && (
        <div className="card stack">
          <h3>Bi mailak</h3>

          <div className="spread">
            <label style={{ minWidth: 100 }}>Zerrenda-eserlekuak</label>
            <input
              type="range"
              min={0}
              max={200}
              step={1}
              value={config.mixed.listSeats}
              onChange={(e) => setMixed({ listSeats: Number(e.target.value) })}
              aria-label="Zerrenda-mailako eserlekuak"
            />
            <span className="value" style={{ minWidth: 34, textAlign: 'right' }}>
              {config.mixed.listSeats}
            </span>
          </div>
          <p className="hint" style={{ marginTop: -4 }}>
            {scenario.districts.length} barruti + {config.mixed.listSeats} zerrenda ={' '}
            <strong>{scenario.districts.reduce((s, d) => s + d.seats, 0) + config.mixed.listSeats}</strong>{' '}
            eserleku nominal.
            {config.system === 'mmp' &&
              ' Poltsa txikitzean overhang-a agertzen da: probatu jaisten.'}
          </p>

          {config.system === 'mmp' && (
            <>
              <label>Overhang-a (dagokiona baino barruti gehiago)</label>
              <select
                value={config.mixed.overhang}
                onChange={(e) => setMixed({ overhang: e.target.value as never })}
                aria-label="Overhang-aren erregela"
              >
                <option value="keep">Mantendu — ganbera hazi (Alemania 2013 arte)</option>
                <option value="leveling">Orekatu — eserleku gehiago proportzionala izan arte</option>
                <option value="fixed">Finkoa — ganbera ez da hazten, besteek ordaintzen dute</option>
              </select>
            </>
          )}

          <label className="checkbox">
            <input
              type="checkbox"
              checked={config.mixed.ballot === 'second'}
              onChange={(e) => enableSecondVotes(e.target.checked)}
            />
            <span>
              Bigarren botoa (boto banatua)
              <br />
              <span className="hint">
                Hautesleak barrutian alderdi bati eta zerrendan beste bati bozka diezaioke. Hori da
                Alemaniako overhang-aren iturri nagusia. Datuak <strong>Datuak</strong> fitxan.
              </span>
            </span>
          </label>
        </div>
      )}

      {config.system === 'two-round' && (
        <div className="card stack">
          <h3>Bigarren itzulia</h3>
          <select
            value={config.runoff.rule}
            onChange={(e) => setRunoff({ rule: e.target.value as 'top-two' | 'qualify' })}
            aria-label="Bigarren itzuliko erregela"
          >
            <option value="top-two">Bi onenak pasatzen dira</option>
            <option value="qualify">Ehuneko bat gainditzen dutenak (Frantzia)</option>
          </select>

          {config.runoff.rule === 'qualify' && (
            <div className="spread">
              <input
                type="range"
                min={5}
                max={30}
                step={0.5}
                value={config.runoff.qualifyPercent}
                onChange={(e) => setRunoff({ qualifyPercent: Number(e.target.value) })}
                aria-label="Bigarren itzulirako gutxieneko ehunekoa"
              />
              <span className="value" style={{ minWidth: 48, textAlign: 'right' }}>
                %{config.runoff.qualifyPercent.toFixed(1)}
              </span>
            </div>
          )}

          <p className="hint">
            Hiru edo lau alderdi pasa daitezke ehunekoaren erregelarekin (<em>triangulaire</em>).
            Bigarren itzuliko botoak <strong>Transferentziak</strong> fitxan doitzen dira.
          </p>
        </div>
      )}

      <div className="card stack">
        <h3>Eserlekuak guztira</h3>
        <div className="spread">
          <input
            type="range"
            min={Math.max(1, scenario.districts.length)}
            max={400}
            step={1}
            value={totalSeats}
            onChange={(e) => scaleAllSeats(Number(e.target.value))}
            aria-label="Eserleku kopurua guztira"
          />
          <span className="value" style={{ minWidth: 48, textAlign: 'right' }}>
            {formatInt(totalSeats)}
          </span>
        </div>
        <p className="hint">
          Barrutien artean oraingo proportzioari eutsiz banatzen dira. Barruti bakoitza banaka
          doitzeko, joan <strong>Datuak</strong> fitxara.
        </p>
      </div>
    </>
  );
}
