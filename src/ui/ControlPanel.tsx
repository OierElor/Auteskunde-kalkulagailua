import { DIVISOR_METHODS } from '../core/divisors';
import { QUOTA_METHODS } from '../core/quotas';
import { SYSTEMS } from '../core/systems';
import type { DivisorMethodId, MethodId, QuotaMethodId } from '../core/types';
import { useApp } from '../state/scenario';
import { EXAMPLES } from '../data/examples';
import { formatInt } from './theme';

export function ControlPanel() {
  const { scenario, config, setSystem, setMethod, setThreshold, scaleAllSeats, loadExample } =
    useApp();

  const totalSeats = scenario.districts.reduce((sum, d) => sum + d.seats, 0);
  const method = config.method;
  const methodSpec =
    method in DIVISOR_METHODS
      ? DIVISOR_METHODS[method as DivisorMethodId]
      : QUOTA_METHODS[method as QuotaMethodId];

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
        <p className="hint">{SYSTEMS.find((s) => s.id === config.system)?.description}</p>
      </div>

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

        <select
          value={config.threshold.scope}
          onChange={(e) => setThreshold({ scope: e.target.value as 'district' | 'national' })}
          aria-label="Langaren esparrua"
        >
          <option value="district">Barruti bakoitzean aplikatu</option>
          <option value="national">Estatu mailan aplikatu</option>
        </select>

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
              Espainiako eta Euskadiko legeak bai: boto zuriak baliodunak dira, eta langa altxatzen
              dute alderdi txikientzat.
            </span>
          </span>
        </label>
      </div>

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
