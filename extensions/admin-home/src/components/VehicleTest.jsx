import {useEffect, useState} from 'preact/hooks';
import {ymm, countParts} from '../lib/bitsy.js';
import {num} from '../lib/format.js';

// Make → Model → Year → Engine, each loaded from Bitsy only after the previous one is chosen,
// exactly as the storefront dropdowns work. Then counts the CentParts products that fit.
export default function VehicleTest() {
  const [makes, setMakes] = useState(/** @type {any[]} */ ([]));
  const [models, setModels] = useState(/** @type {any[]} */ ([]));
  const [years, setYears] = useState(/** @type {number[]} */ ([]));
  const [engines, setEngines] = useState(/** @type {any[]} */ ([]));
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [ktype, setKtype] = useState('');
  const [loading, setLoading] = useState(/** @type {string|null} */ ('makes'));
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [result, setResult] = useState(/** @type {any} */ (null));

  const run = async (what, fn) => {
    setLoading(what);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    run('makes', ymm.makes).then((list) => setMakes(list ?? []));
  }, []);

  const onMake = async (value) => {
    setMake(value);
    setModel('');
    setYear('');
    setKtype('');
    setModels([]);
    setYears([]);
    setEngines([]);
    setResult(null);
    if (value) setModels((await run('models', () => ymm.models(value))) ?? []);
  };
  const onModel = async (value) => {
    setModel(value);
    setYear('');
    setKtype('');
    setYears([]);
    setEngines([]);
    setResult(null);
    if (value) setYears((await run('years', () => ymm.years(make, value))) ?? []);
  };
  const onYear = async (value) => {
    setYear(value);
    setKtype('');
    setEngines([]);
    setResult(null);
    if (value) setEngines((await run('engines', () => ymm.engines(make, model, value))) ?? []);
  };
  const onCheck = async () => {
    const engine = engines.find((e) => String(e.ktype) === ktype);
    const res = await run('parts', () => countParts(ktype));
    if (res) setResult({...res, label: engine?.label ?? ''});
  };

  const val = (e) => /** @type {HTMLSelectElement} */ (e.currentTarget).value;

  return (
    <s-section heading="Test the vehicle dropdowns">
      <s-stack gap="base">
        <s-paragraph>
          Runs the same lookups a shopper would and shows how many CentParts products fit. Test
          lookups count toward your API calls.
        </s-paragraph>
        {error && <s-banner tone="critical">{error}</s-banner>}
        <s-grid gridTemplateColumns="repeat(auto-fit, minmax(160px, 1fr))" gap="base" alignItems="end">
          <s-select label="Make" value={make} disabled={!makes.length} onChange={(e) => onMake(val(e))}>
            <s-option value="">{loading === 'makes' ? 'Loading…' : 'Select make'}</s-option>
            {makes.map((m) => (
              <s-option key={m.id} value={String(m.id)}>{m.name}</s-option>
            ))}
          </s-select>
          <s-select label="Model" value={model} disabled={!models.length} onChange={(e) => onModel(val(e))}>
            <s-option value="">{loading === 'models' ? 'Loading…' : 'Select model'}</s-option>
            {models.map((m) => (
              <s-option key={m.id} value={String(m.id)}>{m.name}</s-option>
            ))}
          </s-select>
          <s-select label="Year" value={year} disabled={!years.length} onChange={(e) => onYear(val(e))}>
            <s-option value="">{loading === 'years' ? 'Loading…' : 'Select year'}</s-option>
            {years.map((y) => (
              <s-option key={y} value={String(y)}>{String(y)}</s-option>
            ))}
          </s-select>
          <s-select
            label="Engine"
            value={ktype}
            disabled={!engines.length}
            onChange={(e) => {
              setKtype(val(e));
              setResult(null);
            }}
          >
            <s-option value="">{loading === 'engines' ? 'Loading…' : 'Select engine'}</s-option>
            {engines.map((en) => (
              <s-option key={en.ktype} value={String(en.ktype)}>{en.label}</s-option>
            ))}
          </s-select>
          <s-button variant="primary" disabled={!ktype} loading={loading === 'parts'} onClick={onCheck}>
            Check fitment
          </s-button>
        </s-grid>
        {result && (
          <s-banner tone="info">
            TecDoc vehicle {result.ktype}
            {result.label ? ` (${result.label})` : ''}: {num(result.count)} CentParts{' '}
            {result.count === 1 ? 'product fits' : 'products fit'}.
          </s-banner>
        )}
      </s-stack>
    </s-section>
  );
}
