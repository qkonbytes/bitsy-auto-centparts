// App settings live in app-data metafields on this app's installation.
// Only this app can write them; theme blocks read them as `app.metafields.bitsy.*`.
import {gql, assertNoUserErrors} from './admin.js';

export const NAMESPACE = 'bitsy';

/** @typedef {typeof DEFAULT_SETTINGS} BitsySettings */
export const DEFAULT_SETTINGS = {
  version: 1,
  vin: {
    limitEnabled: true,
    monthlyLimit: 500,
  },
  results: {
    pageHandle: 'parts-for-your-vehicle',
    perPage: 24,
    outOfStockLast: true,
    filters: {price: true, inStock: true, productType: true, brand: true},
  },
  garage: {
    enabled: true,
    maxVehicles: 5,
    saveVin: false,
  },
};

export const PER_PAGE_OPTIONS = [12, 24, 36, 48];
export const MAX_GARAGE_VEHICLES = 5;

/** Merge stored values over the defaults so new settings always have a value. */
export function withDefaults(stored) {
  const s = stored && typeof stored === 'object' ? stored : {};
  return {
    version: DEFAULT_SETTINGS.version,
    vin: {...DEFAULT_SETTINGS.vin, ...(s.vin ?? {})},
    results: {
      ...DEFAULT_SETTINGS.results,
      ...(s.results ?? {}),
      filters: {...DEFAULT_SETTINGS.results.filters, ...(s.results?.filters ?? {})},
    },
    garage: {...DEFAULT_SETTINGS.garage, ...(s.garage ?? {})},
  };
}

/** Clamp values to what the storefront supports. */
export function sanitize(settings) {
  const s = withDefaults(settings);
  s.vin.monthlyLimit = Math.max(0, Math.floor(Number(s.vin.monthlyLimit) || 0));
  if (!PER_PAGE_OPTIONS.includes(Number(s.results.perPage))) s.results.perPage = 24;
  s.results.perPage = Number(s.results.perPage);
  s.results.pageHandle = String(s.results.pageHandle || DEFAULT_SETTINGS.results.pageHandle);
  s.garage.maxVehicles = Math.min(
    MAX_GARAGE_VEHICLES,
    Math.max(1, Math.floor(Number(s.garage.maxVehicles) || MAX_GARAGE_VEHICLES)),
  );
  return s;
}

export async function loadInstallation() {
  const data = await gql(`#graphql
    query BitsyInstallation {
      currentAppInstallation {
        id
        settings: metafield(namespace: "${NAMESPACE}", key: "settings") { value }
        storefrontToken: metafield(namespace: "${NAMESPACE}", key: "storefront_token") { value }
      }
    }`);
  const inst = data.currentAppInstallation;
  let stored = null;
  try {
    stored = inst.settings?.value ? JSON.parse(inst.settings.value) : null;
  } catch (_) {
    stored = null;
  }
  return {
    installationId: inst.id,
    settings: withDefaults(stored),
    storefrontToken: inst.storefrontToken?.value ?? null,
  };
}

/**
 * @param {string} installationId
 * @param {Array<{key: string, type: string, value: string}>} fields
 */
export async function setInstallationMetafields(installationId, fields) {
  const data = await gql(
    `#graphql
    mutation BitsySetMetafields($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { key }
        userErrors { field message }
      }
    }`,
    {
      metafields: fields.map((f) => ({
        ownerId: installationId,
        namespace: NAMESPACE,
        key: f.key,
        type: f.type,
        value: f.value,
      })),
    },
  );
  assertNoUserErrors(data.metafieldsSet, 'Could not save settings');
}

export async function saveSettings(installationId, settings) {
  const clean = sanitize(settings);
  await setInstallationMetafields(installationId, [
    {key: 'settings', type: 'json', value: JSON.stringify(clean)},
  ]);
  return clean;
}
