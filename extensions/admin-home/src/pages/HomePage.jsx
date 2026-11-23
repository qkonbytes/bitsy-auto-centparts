import {useEffect, useState} from 'preact/hooks';
import {getUsage, getStatus} from '../lib/bitsy.js';
import {getCatalogueCounts} from '../lib/admin.js';
import {loadInstallation} from '../lib/settings.js';
import {ensureStorefrontToken} from '../lib/storefront.js';
import {num, pct, usageTone, nextResetLabel, monthLabel} from '../lib/format.js';
import VehicleTest from '../components/VehicleTest.jsx';
import ThemeSetup from '../components/ThemeSetup.jsx';

const SERVICE = {
  live: {tone: 'success', label: 'Live'},
  test: {tone: 'warning', label: 'Test mode'},
  down: {tone: 'critical', label: 'Unavailable'},
};
const TECDOC = {
  live: {tone: 'success', label: 'Connected'},
  not_live: {tone: 'neutral', label: 'Not live yet'},
  down: {tone: 'critical', label: 'Unavailable'},
};

export default function HomePage() {
  const [usage, setUsage] = useState(/** @type {any} */ (null));
  const [usageError, setUsageError] = useState(/** @type {string|null} */ (null));
  const [status, setStatus] = useState(/** @type {any} */ (null));
  const [statusError, setStatusError] = useState(/** @type {string|null} */ (null));
  const [checking, setChecking] = useState(false);
  const [counts, setCounts] = useState(/** @type {any} */ (null));
  const [storefront, setStorefront] = useState(/** @type {'ok'|'error'|null} */ (null));
  const [resultsHandle, setResultsHandle] = useState('parts-for-your-vehicle');

  const checkStatus = async () => {
    setChecking(true);
    setStatusError(null);
    try {
      setStatus(await getStatus());
    } catch (e) {
      setStatus(null);
      setStatusError(e.message);
    }
    setChecking(false);
  };

  useEffect(() => {
    getUsage()
      .then(setUsage)
      .catch((e) => setUsageError(e.message));
    checkStatus();
    getCatalogueCounts()
      .then(setCounts)
      .catch(() => setCounts({products: null, variants: null}));
    loadInstallation()
      .then((inst) => {
        setResultsHandle(inst.settings.results.pageHandle);
        return ensureStorefrontToken(inst.installationId, inst.storefrontToken);
      })
      .then(() => setStorefront('ok'))
      .catch(() => setStorefront('error'));
  }, []);

  const apiPct = usage ? pct(usage.api.used, usage.api.allowed) : 0;
  const vinAllowed = usage ? usage.vin.limit ?? usage.vin.allowed : 0;
  const vinPct = usage ? pct(usage.vin.used, vinAllowed) : 0;

  return (
    <s-page heading="Bitsy Auto">
      <s-section heading={`Usage this month · ${monthLabel()}`}>
        <s-stack gap="base">
          <s-text color="subdued">Counters reset on {nextResetLabel()}.</s-text>
          {usageError && (
            <s-banner tone="warning" heading="Usage isn't available yet">
              {usageError}
            </s-banner>
          )}
          <s-grid gridTemplateColumns="repeat(auto-fit, minmax(260px, 1fr))" gap="base">
            <UsageCard
              title="API calls"
              loading={!usage && !usageError}
              used={usage?.api.used}
              allowed={usage?.api.allowed}
              allowedLabel="Plan allows"
              percent={apiPct}
              note="Every vehicle lookup and parts search counts as a call."
            />
            <UsageCard
              title="VIN searches"
              loading={!usage && !usageError}
              used={usage?.vin.used}
              allowed={vinAllowed}
              allowedLabel={usage?.vin.limit != null ? 'Your limit' : 'Plan allows'}
              percent={vinPct}
              note="At the limit, VIN search pauses until the 1st. Make, Model, Year and Engine keep working."
              link={{href: '/settings', label: 'Change limit'}}
            />
          </s-grid>
        </s-stack>
      </s-section>

      <s-grid gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap="base">
        <s-section heading="API service status">
          <s-stack gap="base">
            {statusError && <s-banner tone="critical">{statusError}</s-banner>}
            <StatusRow label="Bitsy fitment service" value={status && SERVICE[status.service]} loading={checking} />
            <StatusRow label="TecDoc connection" value={status && TECDOC[status.tecdoc]} loading={checking} />
            <StatusRow
              label="Storefront access"
              value={
                storefront === 'ok'
                  ? {tone: 'success', label: 'Operational'}
                  : storefront === 'error'
                    ? {tone: 'critical', label: 'Needs attention'}
                    : null
              }
              loading={storefront === null}
            />
            <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
              <s-text color="subdued">
                {status?.checkedAt
                  ? `Last checked ${new Date(status.checkedAt).toLocaleTimeString('en-ZA')}`
                  : ' '}
              </s-text>
              <s-button onClick={checkStatus} loading={checking}>
                Check now
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>

        <s-section heading="Products on Shopify">
          <s-stack gap="base">
            <s-stack direction="inline" gap="large-200">
              <Stat value={counts ? num(counts.products) : null} label="products" />
              <Stat value={counts ? num(counts.variants) : null} label="variants" />
            </s-stack>
            <s-text color="subdued">
              Only variants with a SKU can be matched to TecDoc part numbers.
            </s-text>
          </s-stack>
        </s-section>
      </s-grid>

      <VehicleTest />

      <ThemeSetup resultsHandle={resultsHandle} />
    </s-page>
  );
}

/**
 * @param {{title: string, loading: boolean, used?: number, allowed?: number, allowedLabel: string,
 *   percent: number, note: string, link?: {href: string, label: string}}} props
 */
function UsageCard({title, loading, used, allowed, allowedLabel, percent, note, link}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" borderColor="base">
      <s-stack gap="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-heading>{title}</s-heading>
          {!loading && allowed != null && (
            <s-text color="subdued">
              {allowedLabel} {num(allowed)}
            </s-text>
          )}
        </s-stack>
        {loading ? (
          <s-spinner accessibilityLabel={`Loading ${title}`} />
        ) : (
          <>
            <s-stack direction="inline" gap="small-200" alignItems="baseline">
              <s-text type="strong">{num(used)}</s-text>
              <s-text color="subdued">used</s-text>
              {used != null && allowed ? <s-badge tone={usageTone(percent)}>{percent}%</s-badge> : null}
            </s-stack>
            <s-text>
              {used != null && allowed != null
                ? `${num(Math.max(0, allowed - used))} left this month`
                : ' '}
            </s-text>
          </>
        )}
        <s-text color="subdued">{note}</s-text>
        {link && <s-link href={link.href}>{link.label}</s-link>}
      </s-stack>
    </s-box>
  );
}

function StatusRow({label, value, loading}) {
  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center">
      <s-text>{label}</s-text>
      {loading ? (
        <s-spinner size="base" accessibilityLabel={`Checking ${label}`} />
      ) : value ? (
        <s-badge tone={value.tone}>{value.label}</s-badge>
      ) : (
        <s-badge tone="neutral">Unknown</s-badge>
      )}
    </s-stack>
  );
}

function Stat({value, label}) {
  return (
    <s-stack gap="none">
      {value == null ? <s-spinner accessibilityLabel={`Loading ${label}`} /> : <s-heading>{value}</s-heading>}
      <s-text color="subdued">{label}</s-text>
    </s-stack>
  );
}
