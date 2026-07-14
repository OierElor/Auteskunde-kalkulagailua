import { EXAMPLES, GROUPS } from '../data/examples';
import { useApp } from '../state/scenario';

/**
 * Eszenatokien hautatzailea.
 *
 * Goitibehera bat zen, eta hiru arazo zituen: uneko eszenatokia BI aldiz agertzen zen, eszenatoki
 * bakoitzaren azalpena (`hint`) idatzita zegoen baina ez zen inoiz erakusten, eta lau adibide
 * sintetikoak esperimentu BAKARRA direla inon ez zen esaten.
 *
 * Orain zerrenda ikusgai bat da: aukera bakoitza zertarako den irakur daiteke KLIK EGIN GABE, eta
 * talde-goiburuek testuingurua ematen dute.
 */
export function ScenarioPicker() {
  const { exampleId, loadExample } = useApp();
  const selected = EXAMPLES.find((e) => e.id === exampleId);

  return (
    <div className="card stack">
      <h3>Eszenatokia</h3>

      {GROUPS.map((group) => (
        <div key={group.id}>
          <div
            style={{
              fontSize: '0.68rem',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: 700,
              color: 'var(--ink-2)',
              marginBottom: group.note ? 3 : 6,
            }}
          >
            {group.label}
          </div>

          {group.note && (
            <p className="hint" style={{ marginTop: 0, marginBottom: 7 }}>
              {group.note}
            </p>
          )}

          <div role="radiogroup" aria-label={group.label} className="stack" style={{ gap: 2 }}>
            {EXAMPLES.filter((e) => e.group === group.id).map((example) => {
              const active = example.id === exampleId;
              return (
                <button
                  key={example.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => loadExample(example.id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 9px',
                    borderColor: active ? 'var(--ink)' : 'transparent',
                    background: active ? 'var(--hover)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontWeight: active ? 700 : 400,
                      fontSize: '0.85rem',
                      color: 'var(--ink)',
                    }}
                  >
                    {example.label}
                  </span>
                  <span
                    style={{ display: 'block', fontSize: '0.72rem', color: 'var(--ink-muted)' }}
                  >
                    {example.summary}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {selected ? (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 9,
          }}
        >
          <p className="hint" style={{ margin: 0 }}>
            {selected.hint}
          </p>
          <p className="hint" style={{ margin: '5px 0 0', color: 'var(--ink-muted)' }}>
            {selected.source ? (
              <>
                <strong>{selected.source}</strong> · arau legalak automatikoki aplikatuta.
              </>
            ) : (
              'Datuak asmatuak dira.'
            )}
          </p>
        </div>
      ) : (
        <p className="hint" style={{ margin: 0, borderTop: '1px solid var(--border)', paddingTop: 9 }}>
          CSV batetik kargatutako datuak. Egiaztatu langa eta metodoa zuzenak direla.
        </p>
      )}
    </div>
  );
}
