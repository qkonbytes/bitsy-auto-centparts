// Client for the Bitsy admin API (Supabase Edge Function "bitsy-admin").
// The admin screens can't use the storefront App Proxy, so they call this function
// directly with Shopify's ID token (shopify.auth.idToken), which the function verifies with the
// app's client secret. Responses must send Access-Control-Allow-Origin: * (extensions run with a null origin).
// Contract: docs/INTERFACE-CONTRACT.md → "Admin API".

export const BITSY_ADMIN_URL =
  'https://uclehygojvydvyzsqvzk.supabase.co/functions/v1/bitsy-admin';

export class BitsyError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * @param {string} path
 * @param {{method?: string, body?: unknown}} [opts]
 */
async function call(path, opts = {}) {
  const token = await shopify.auth.idToken();
  let res;
  try {
    res = await fetch(`${BITSY_ADMIN_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(opts.body ? {'Content-Type': 'application/json'} : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (_) {
    throw new BitsyError('The Bitsy service could not be reached.', 0);
  }
  let json = null;
  try {
    json = await res.json();
  } catch (_) {
    json = null;
  }
  if (!res.ok) {
    throw new BitsyError(json?.error ?? `The Bitsy service answered ${res.status}.`, res.status);
  }
  return json;
}

const q = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ).toString();

/**
 * @returns {Promise<{
 *   period: {start: string, end: string, resetsOn: string},
 *   api: {used: number, allowed: number},
 *   vin: {used: number, allowed: number, limit: number | null}
 * }>}
 */
export const getUsage = () => call('/usage');

/**
 * @returns {Promise<{
 *   service: 'live' | 'test' | 'down',
 *   tecdoc: 'live' | 'not_live' | 'down',
 *   checkedAt: string
 * }>}
 */
export const getStatus = () => call('/status');

export const ymm = {
  makes: () => call('/ymm/makes'),
  models: (make) => call(`/ymm/models?${q({make})}`),
  years: (make, model) => call(`/ymm/years?${q({make, model})}`),
  engines: (make, model, year) => call(`/ymm/engines?${q({make, model, year})}`),
};

/** @returns {Promise<{ktype: number, count: number}>} */
export const countParts = (ktype) => call(`/parts/count?${q({ktype})}`);

/**
 * Tells Bitsy the store's VIN limit, which it enforces on every VIN search.
 * Bitsy caps it at the plan's allowance and returns the value it saved.
 * @returns {Promise<{vinLimitEnabled: boolean, vinMonthlyLimit: number}>}
 */
export const saveLimits = (vinLimitEnabled, vinMonthlyLimit) =>
  call('/settings', {method: 'PUT', body: {vinLimitEnabled, vinMonthlyLimit}});
