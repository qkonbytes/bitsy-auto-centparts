import {useEffect, useRef, useState} from 'preact/hooks';
import {
  loadInstallation,
  saveSettings,
  withDefaults,
  PER_PAGE_OPTIONS,
  MAX_GARAGE_VEHICLES,
} from '../lib/settings.js';
import {listPages, createResultsPage, RESULTS_PAGE} from '../lib/admin.js';
import {getUsage, saveLimits} from '../lib/bitsy.js';
import {num} from '../lib/format.js';

const FILTERS = [
  {key: 'price', label: 'Price', source: 'Product price'},
  {key: 'inStock', label: 'In stock', source: 'Inventory'},
  {key: 'productType', label: 'Product type', source: 'Product type'},
  {key: 'brand', label: 'Brand', source: 'Vendor'},
];

export default function SettingsPage() {
  const [installationId, setInstallationId] = useState('');
  const [settings, setSettings] = useState(withDefaults(null));
  const saved = useRef(withDefaults(null));
  const [pages, setPages] = useState(/** @type {any[]} */ ([]));
  const [planVin, setPlanVin] = useState(/** @type {number|null} */ (null));
  const [status, setStatus] = useState(/** @type {'loading'|'idle'|'saving'} */ ('loading'));
  const [error, setError] = useState(/** @type {string|null} */ (null));
  const [notice, setNotice] = useState(/** @type {string|null} */ (null));
  const [creatingPage, setCreatingPage] = useState(false);

  useEffect(() => {
    shopify.loading(true);
    Promise.all([loadInstallation(), listPages().catch(() => [])])
      .then(([inst, pageList]) => {
        setInstallationId(inst.installationId);
        saved.current = inst.settings;
        setSettings(inst.settings);
        setPages(pageList);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        setStatus('idle');
        shopify.loading(false);
      });
    getUsage()
      .then((u) => setPlanVin(u?.vin?.allowed ?? null))
      .catch(() => setPlanVin(null));
  }, []);

  /** @param {(s: ReturnType<typeof withDefaults>) => void} mutate */
  const update = (mutate) =>
    setSettings((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      mutate(next);
      return next;
    });

  const handleSave = (event) => {
    const promise = (async () => {
      setStatus('saving');
      setError(null);
      setNotice(null);
      try {
        let toSave = settings;
        // Bitsy enforces the VIN limit, so it must know it. It caps the value at the plan.
        try {
          const limits = await saveLimits(settings.vin.limitEnabled, settings.vin.monthlyLimit);
          if (limits && limits.vinMonthlyLimit !== settings.vin.monthlyLimit) {
            toSave = {...settings, vin: {...settings.vin, monthlyLimit: limits.vinMonthlyLimit}};
            setNotice(`Your plan allows ${num(limits.vinMonthlyLimit)} VIN searches a month, so the limit was set to that.`);
          }
        } catch (e) {
          setNotice(`Saved in Shopify, but Bitsy couldn't be told about the VIN limit yet: ${e.message}`);
        }
        const clean = await saveSettings(installationId, toSave);
        saved.current = clean;
        setSettings(clean);
      } catch (e) {
        setError(e.message);
        throw e;
      } finally {
        setStatus('idle');
      }
    })();
    event?.waitUntil?.(promise);
    return promise;
  };

  const handleReset = () => {
    setSettings(JSON.parse(JSON.stringify(saved.current)));
  };

  const onCreatePage = async () => {
    setCreatingPage(true);
    setError(null);
    try {
      const page = await createResultsPage();
      setPages((p) => [...p, page]);
      update((s) => {
        s.results.pageHandle = page.handle;
      });
      shopify.toast.show('Results page created');
    } catch (e) {
      setError(e.message);
    }
    setCreatingPage(false);
  };

  const hasResultsPage = pages.some((p) => p.handle === settings.results.pageHandle);
  const target = /** @param {Event} e */ (e) => /** @type {HTMLInputElement} */ (e.currentTarget);

  return (
    <s-page heading="Settings" inlineSize="base">
      <s-link slot="breadcrumb-actions" href="/">
        Home
      </s-link>

      {error && (
        <s-section>
          <s-banner tone="critical">{error}</s-banner>
        </s-section>
      )}
      {notice && (
        <s-section>
          <s-banner tone="warning" dismissible onDismiss={() => setNotice(null)}>
            {notice}
          </s-banner>
        </s-section>
      )}

      {status !== 'loading' && (
        <s-form onSubmit={handleSave} onReset={handleReset}>
          <s-section heading="VIN search limit">
            <s-stack gap="base">
              <s-paragraph>
                Caps how many VIN searches are sent each calendar month. Once the limit is reached,
                no more VIN searches go through until the 1st. Make, Model, Year and Engine keep
                working.
              </s-paragraph>
              <s-switch
                label="Limit VIN searches"
                name="vinLimitEnabled"
                checked={settings.vin.limitEnabled}
                onChange={(e) =>
                  update((s) => {
                    s.vin.limitEnabled = target(e).checked;
                  })
                }
                details="Without a limit, VIN searches can use up to your plan's allowance."
              />
              {settings.vin.limitEnabled && (
                <s-number-field
                  label="VIN searches per month"
                  name="vinMonthlyLimit"
                  min={0}
                  max={planVin ?? undefined}
                  step={1}
                  value={String(settings.vin.monthlyLimit)}
                  onInput={(e) =>
                    update((s) => {
                      s.vin.monthlyLimit = Number(target(e).value || 0);
                    })
                  }
                  details={planVin != null ? `Your plan allows up to ${num(planVin)}.` : undefined}
                />
              )}
            </s-stack>
          </s-section>

          <s-section heading="Results page">
            <s-stack gap="base">
              <s-paragraph>Where shoppers see every part that fits their vehicle.</s-paragraph>
              <s-grid gridTemplateColumns="1fr auto" gap="base" alignItems="end">
                <s-select
                  label="Page"
                  name="pageHandle"
                  value={settings.results.pageHandle}
                  onChange={(e) =>
                    update((s) => {
                      s.results.pageHandle = target(e).value;
                    })
                  }
                >
                  {!hasResultsPage && (
                    <s-option value={settings.results.pageHandle}>
                      /pages/{settings.results.pageHandle} (not created yet)
                    </s-option>
                  )}
                  {pages.map((p) => (
                    <s-option key={p.id} value={p.handle}>
                      {p.title} — /pages/{p.handle}
                    </s-option>
                  ))}
                </s-select>
                {!pages.some((p) => p.handle === RESULTS_PAGE.handle) && (
                  <s-button onClick={onCreatePage} loading={creatingPage}>
                    Create page
                  </s-button>
                )}
              </s-grid>
              <s-select
                label="Products per page"
                name="perPage"
                value={String(settings.results.perPage)}
                onChange={(e) =>
                  update((s) => {
                    s.results.perPage = Number(target(e).value);
                  })
                }
              >
                {PER_PAGE_OPTIONS.map((n) => (
                  <s-option key={n} value={String(n)}>
                    {String(n)}
                  </s-option>
                ))}
              </s-select>
              <s-checkbox
                label="Put out-of-stock products last"
                name="outOfStockLast"
                checked={settings.results.outOfStockLast}
                onChange={(e) =>
                  update((s) => {
                    s.results.outOfStockLast = target(e).checked;
                  })
                }
              />
              <s-divider />
              <s-heading>Product filters</s-heading>
              <s-text color="subdued">
                Built from your Shopify product data. Tick the ones shoppers can use on the results
                page and on filtered collections.
              </s-text>
              {FILTERS.map((f) => (
                <s-checkbox
                  key={f.key}
                  label={f.label}
                  details={f.source}
                  name={`filter_${f.key}`}
                  checked={settings.results.filters[f.key]}
                  onChange={(e) =>
                    update((s) => {
                      s.results.filters[f.key] = target(e).checked;
                    })
                  }
                />
              ))}
            </s-stack>
          </s-section>

          <s-section heading="My Garage">
            <s-stack gap="base">
              <s-paragraph>
                Saves shoppers' vehicles in their own browser, so they can pick one again without
                searching.
              </s-paragraph>
              <s-switch
                label="Turn on My Garage"
                name="garageEnabled"
                checked={settings.garage.enabled}
                onChange={(e) =>
                  update((s) => {
                    s.garage.enabled = target(e).checked;
                  })
                }
              />
              {settings.garage.enabled && (
                <>
                  <s-select
                    label="Vehicles per shopper"
                    name="maxVehicles"
                    value={String(settings.garage.maxVehicles)}
                    onChange={(e) =>
                      update((s) => {
                        s.garage.maxVehicles = Number(target(e).value);
                      })
                    }
                  >
                    {Array.from({length: MAX_GARAGE_VEHICLES}, (_, i) => i + 1).map((n) => (
                      <s-option key={n} value={String(n)}>
                        {String(n)}
                      </s-option>
                    ))}
                  </s-select>
                  <s-text color="subdued">
                    Saved for each vehicle: Make, Model, Year, Engine and the TecDoc KType.
                  </s-text>
                  <s-checkbox
                    label="Also save the VIN"
                    name="saveVin"
                    checked={settings.garage.saveVin}
                    onChange={(e) =>
                      update((s) => {
                        s.garage.saveVin = target(e).checked;
                      })
                    }
                    details="Only for vehicles found by VIN search. A VIN identifies one specific car, so it stays on the shopper's device and is never sent to Shopify."
                  />
                </>
              )}
            </s-stack>
          </s-section>
        </s-form>
      )}
    </s-page>
  );
}
