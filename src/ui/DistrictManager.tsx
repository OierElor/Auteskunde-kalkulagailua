import { useState } from 'react';
import { districtVoteTotal } from '../core/districts';
import { matchesSpanishProvinces } from '../data/erkidegoak';
import { useApp } from '../state/scenario';
import { formatInt } from './theme';

interface Props {
  /** Boto-editorean erakusten den barrutia. */
  focusedId: string;
  onFocus: (id: string) => void;
}

/**
 * Barrutien kudeatzailea: zerrenda osoa, hautaketa anitza eta bateratzea.
 *
 * Lehen 12 barruti baino gehiago zeudenean goitibehera batera murrizten zen: bat ikusten zenuen
 * aldiez, ezin zenituen konparatu ezta hainbat batera hautatu ere. 75 barrutirekin erabilezina zen.
 *
 * Zerrenda ARINA da nahita (kontrol-laukia + testua, ez sarrera-eremuak): 675 sarrera-eremuk
 * 98 ms kostatzen zuten graduatzaile-mugimendu bakoitzeko. Izena eta eserlekuak beheko
 * boto-editorean editatzen dira, hautatutako barrutiarenak.
 */
export function DistrictManager({ focusedId, onFocus }: Props) {
  const {
    scenario,
    addDistrict,
    mergeSelected,
    mergeAllDistricts,
    mergeByRegion,
    removeSelected,
    moveDistrictBy,
  } = useApp();

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const clear = () => setSelected(new Set());
  const ids = [...selected];
  const canMerge = ids.length >= 2;
  const canDelete = ids.length >= 1 && ids.length < scenario.districts.length;
  const isCongress = matchesSpanishProvinces(scenario);

  const act = (fn: () => void) => {
    fn();
    clear();
  };

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 10 }}>
        <h3>Barrutiak ({scenario.districts.length})</h3>
        <button onClick={addDistrict}>+ Barrutia gehitu</button>
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <button
          className={canMerge ? 'primary' : undefined}
          disabled={!canMerge}
          onClick={() => act(() => mergeSelected(ids))}
        >
          Bateratu hautatutakoak {selected.size > 0 && `(${selected.size})`}
        </button>
        <button disabled={!canDelete} onClick={() => act(() => removeSelected(ids))}>
          Ezabatu {selected.size > 0 && `(${selected.size})`}
        </button>
        {selected.size > 0 && (
          <button className="ghost" onClick={clear}>
            Hautaketa garbitu
          </button>
        )}
      </div>

      <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        <button
          disabled={scenario.districts.length < 2}
          onClick={() => act(mergeAllDistricts)}
          title="Barruti guztiak bakar batean: botoak, eserlekuak eta boto zuriak batuta"
        >
          ⇢ Bateratu DENAK barruti bakarrean
        </button>
        {isCongress && (
          <button
            onClick={() => act(mergeByRegion)}
            title="52 probintzia → 17 autonomia erkidego + Ceuta + Melilla"
          >
            ⇢ Bateratu autonomia erkidegoka (52 → 19)
          </button>
        )}
      </div>

      <div className="scroll-x" style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ width: 28 }} />
              <th>Barrutia</th>
              <th className="num" style={{ width: 74 }}>
                Eserlekuak
              </th>
              <th className="num" style={{ width: 96 }}>
                Botoak
              </th>
              <th className="num" style={{ width: 74 }}>
                Zuriak
              </th>
              <th style={{ width: 58 }} />
            </tr>
          </thead>
          <tbody>
            {scenario.districts.map((district, index) => {
              const active = district.id === focusedId;
              return (
                <tr
                  key={district.id}
                  onClick={() => onFocus(district.id)}
                  style={{
                    cursor: 'pointer',
                    background: active ? 'var(--hover)' : undefined,
                  }}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(district.id)}
                      onChange={() => toggle(district.id)}
                      aria-label={`${district.name} hautatu`}
                    />
                  </td>
                  <td style={{ fontWeight: active ? 700 : 400 }}>
                    {district.name}
                    {district.threshold != null && (
                      <span className="muted" style={{ marginLeft: 6, fontSize: '0.72rem' }}>
                        langa %{district.threshold}
                      </span>
                    )}
                  </td>
                  <td className="num">{district.seats}</td>
                  <td className="num muted">{formatInt(districtVoteTotal(scenario, district.id))}</td>
                  <td className="num muted">
                    {formatInt(scenario.blankVotes[district.id] ?? 0)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span className="row" style={{ gap: 0 }}>
                      <button
                        className="ghost"
                        disabled={index === 0}
                        onClick={() => moveDistrictBy(district.id, -1)}
                        aria-label={`${district.name} gora`}
                        title="Gora"
                      >
                        ↑
                      </button>
                      <button
                        className="ghost"
                        disabled={index === scenario.districts.length - 1}
                        onClick={() => moveDistrictBy(district.id, 1)}
                        aria-label={`${district.name} behera`}
                        title="Behera"
                      >
                        ↓
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="hint" style={{ marginBottom: 0, marginTop: 10 }}>
        Klikatu errenkada bat beheko boto-editorean irekitzeko. Kontrol-laukiekin hainbat hautatu eta
        bateratu: <strong>botoak, eserlekuak eta boto zuriak batu egiten dira</strong> — ez da ezer
        sortzen ez galtzen.
      </p>
    </div>
  );
}
