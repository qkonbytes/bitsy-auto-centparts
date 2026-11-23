# Bitsy Auto – interface contract (Shopify app ↔ Supabase)

The Shopify app (this repo) talks only to Supabase. Supabase talks to the TecDoc gateway server; the app never calls TecDoc or the server, and holds no API key. **No TecDoc data is stored anywhere**: not in Shopify, not in Supabase, not in the browser beyond the shopper's own garage vehicles.

Changes to this contract are agreed in both chats (this repo and the Bitsy Auto Project data chat) before either side builds against them.

Status: **Agreed** = in the original handoff brief. **Proposed** = added for the admin screens and VIN search; needs the data chat's agreement.

## 1. Storefront API – Supabase Edge Function `storefront`

Reached through the Shopify App Proxy: the storefront calls `/apps/bitsy/*` on the shop's own domain, and Shopify forwards it, signed, to `https://uclehygojvydvyzsqvzk.supabase.co/functions/v1/storefront/*`. The function verifies the proxy signature (`signature` query parameter, HMAC-SHA256 with the app's client secret) and answers JSON with `Cache-Control: no-store`.

Each dropdown is loaded only after the previous one is chosen, and every request is live.

| Status | Request | Response |
|---|---|---|
| Agreed | `GET /apps/bitsy/ymm/makes` | `[{ "id": 121, "name": "VW" }]` |
| Agreed | `GET /apps/bitsy/ymm/models?make=` | `[{ "id": 1025, "name": "GOLF VI (5K1)" }]` |
| Agreed | `GET /apps/bitsy/ymm/years?make=&model=` | `[2009, 2010, 2011]` |
| Agreed | `GET /apps/bitsy/ymm/engines?make=&model=&year=` | `[{ "ktype": 27384, "label": "1.6 TDI · 77 kW · CAYC" }]` |
| Agreed | `GET /apps/bitsy/parts?ktype=[&collection=]` | `{ "ktype": 27384, "count": 143, "items": [{ "sku": "04.5155", "product_id": "gid://shopify/Product/…", "variant_id": "gid://shopify/ProductVariant/…" }] }` |
| **Proposed** | `GET /apps/bitsy/vin?vin=` | `{ "ktype": 27384, "label": "1.6 TDI · 77 kW · CAYC", "make": "VW", "model": "GOLF VI (5K1)", "year": 2010 }` |

- `collection` is the numeric Shopify collection ID; with it, `parts` returns every fitting product in the whole collection.
- `vin` is 17 characters, letters and digits, no I/O/Q. When the shop's monthly VIN limit is reached the function answers **429** `{ "error": "vin_limit_reached", "resetsOn": "2026-12-01" }` without calling TecDoc.
- Every successful request counts one API call for the shop's monthly usage; a VIN search also counts one VIN search.
- Errors: `{ "error": "…" }` with **400** (bad input), **401** (bad signature), **402** (monthly API allowance used up), **429** (VIN limit reached), **502** (TecDoc or server unavailable).

## 2. Admin API – Supabase Edge Function `bitsy-admin` (Proposed)

Used by the app's admin screens (Home and Settings), which can't use the App Proxy. Base URL `https://uclehygojvydvyzsqvzk.supabase.co/functions/v1/bitsy-admin`.

- **Auth:** `Authorization: Bearer <Shopify ID token>` from `shopify.auth.idToken()`. The function verifies the JWT (HS256, signed with the app's client secret; `aud` = the app's client ID; `exp`/`nbf` valid) and takes the shop from the `dest` claim. No other credential.
- **CORS:** responses must send `Access-Control-Allow-Origin: *` and answer `OPTIONS` preflights (`Authorization, Content-Type`; `GET, PUT`), because admin extensions run with a null origin.

| Request | Response |
|---|---|
| `GET /usage` | `{ "period": { "start": "2026-11-01", "end": "2026-11-30", "resetsOn": "2026-12-01" }, "api": { "used": 4210, "allowed": 10000 }, "vin": { "used": 92, "allowed": 1000, "limit": 500 } }` |
| `GET /status` | `{ "service": "live" \| "test" \| "down", "tecdoc": "live" \| "not_live" \| "down", "checkedAt": "2026-11-23T18:40:00Z" }` |
| `GET /ymm/makes`, `/ymm/models`, `/ymm/years`, `/ymm/engines` | Same parameters and responses as the storefront API |
| `GET /parts/count?ktype=` | `{ "ktype": 27384, "count": 143 }` |
| `PUT /settings` body `{ "vinLimitEnabled": true, "vinMonthlyLimit": 500 }` | `{ "vinLimitEnabled": true, "vinMonthlyLimit": 500 }` – the limit is capped at the plan's VIN allowance and the saved value is returned |

- `vin.allowed` is the plan's allowance; `vin.limit` is the shop's own lower limit, or `null` when the limit is switched off.
- Usage resets on the 1st of each calendar month (Africa/Johannesburg).
- Admin lookups (`/ymm/*`, `/parts/count`) count toward the shop's API calls, like the storefront's.

## 3. Data Supabase needs per shop (Proposed)

Bitsy's own figures, not TecDoc data, so storing them is allowed:

- **Plan per shop:** shop domain, plan name, monthly API allowance, monthly VIN allowance.
- **Shop settings:** VIN limit on/off and value (from `PUT /settings`).
- **Usage counters per shop per month:** API calls, VIN searches.
- **App credentials:** the app's client ID and client secret as Supabase secrets (proxy signature and ID token checks).

## 4. What the Shopify app keeps

App-data metafields on the app installation (only this app can write them; theme blocks read them as `app.metafields.bitsy.*`):

| Key | Type | Content |
|---|---|---|
| `bitsy.settings` | json | `{ version, vin: { limitEnabled, monthlyLimit }, results: { pageHandle, perPage, outOfStockLast, filters: { price, inStock, productType, brand } }, garage: { enabled, maxVehicles, saveVin } }` |
| `bitsy.storefront_token` | single_line_text_field | Public Storefront API token for the product cards |

Shopper's browser (`localStorage`, key `bitsy:garage`): up to 5 vehicles, each `{ make, model, year, engine, ktype, label, vin? }`; the VIN only when the shop turns that on.
