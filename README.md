# Bitsy Auto – CentParts

Shopify app that lets shoppers find their vehicle (Make → Model → Year → Engine, or VIN) and see only the CentParts products that fit, checked live against TecDoc through Supabase. Built by Q-KON Bytes.

**No TecDoc fitment data is stored** in Shopify, in Supabase or in the browser (beyond the shopper's own garage vehicles). Every lookup is live.

## What's here

| Path | What it is |
|---|---|
| `shopify.app.toml` | App configuration: scopes, App Proxy `/apps/bitsy` → Supabase `storefront` |
| `extensions/admin-home` | The app's screens in the Shopify admin (Home, Settings, Help), a Shopify-hosted App Home UI extension (Preact + Polaris web components) |
| `extensions/bitsy-auto-theme` | Theme app extension: nav bar + My Garage (app embed), selector block, hero, collection bar, results *(next)* |
| `docs/INTERFACE-CONTRACT.md` | Endpoints between this app and Supabase |
| `docs/THEME-SETTINGS.md` | Every theme editor setting per section |

There is no server to host. The admin screens are hosted by Shopify; all data calls go to Supabase.

## Shopify Dev Dashboard values

| Field | Value |
|---|---|
| App URL | `https://shopify.dev/apps/default-app-home` |
| Allowed redirection URL | `https://shopify.dev/apps/app-home/api/auth` |
| Embedded | Yes |
| Scopes | `read_products, write_online_store_pages, read_themes, unauthenticated_read_product_listings, unauthenticated_read_product_inventory` |
| App proxy | Prefix `apps`, subpath `bitsy`, URL `https://uclehygojvydvyzsqvzk.supabase.co/functions/v1/storefront` |
| Distribution | Custom (App Home UI extensions require custom distribution) |

`shopify app deploy` pushes these from `shopify.app.toml`, so the toml is the source of truth.

## Develop

```sh
npm install
# put the app's client ID in shopify.app.toml first
npm run dev       # shopify app dev, on a development store
npm run deploy    # shopify app deploy
```

The Supabase side (Edge Functions `storefront` and `bitsy-admin`, matching, usage, plans) lives in the Bitsy Auto Project and is described in `docs/INTERFACE-CONTRACT.md`.

Support: connect@qkonbytes.com
