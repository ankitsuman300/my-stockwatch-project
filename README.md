# Stockwatch

A Shopify app for Brewline Coffee: shows shoppers a plain "Only N left!" message when a product is nearly sold out, and gives the ops team a dashboard and an activity history.

Built on the official Shopify React Router app template (JavaScript), with Polaris web components, a Liquid theme app extension and Prisma.

## Run it

You need the [Shopify CLI](https://shopify.dev/docs/apps/tools/cli) and a Partner account with a development store.

```bash
npm install
```

```bash
shopify app dev
```

Press `P` to open the app and install it on your dev store. Then open **Settings → Add to product page** (or the theme editor), place the **Low stock message** block on the product page, and save.

## How it works

```
Maya ──► Theme editor ──► "Low stock message" block settings (threshold + messages)
                                  │  saved by Shopify in templates/product.json
                                  ▼
Shopper ──► Product page ──► Liquid reads block settings + live stock ──► "Only 3 left!"

Stock changes ──► inventory_levels/update webhook ──► app reads threshold from the theme
                                                    ──► LOW/OK check ──► history row (only if changed)

Dev ──► Dashboard (live from Shopify) · Activity (last 20 rows from DB) · Sync all (Bulk Operation)
```

## Where each requirement lives

| Requirement | File |
|---|---|
| Defaults, validation, message formatting | `app/lib/config.js` |
| Read the settings from the live theme (no metafield, no DB) | `app/lib/config.server.js` |
| Settings page: current values, preview, link to theme editor | `app/routes/app.settings.jsx` |
| Dashboard: image, title, inventory, LOW/OK, pagination, loading/error/empty states | `app/routes/app._index.jsx` |
| "Sync all" via Bulk Operation (safe for large catalogs) | `app/lib/sync.server.js`, `app/routes/webhooks.bulk.finish.jsx` |
| Automatic status update on stock change | `app/routes/webhooks.inventory.update.jsx` |
| Save a history row only when the status changes | `app/lib/status.server.js` |
| Activity page (last 20 changes) | `app/routes/app.activity.jsx` |
| History table (the only business data stored) | `prisma/schema.prisma` → `StatusChange` |
| Uninstall: delete sessions | `app/routes/webhooks.app.uninstalled.jsx` |
| Privacy: delete the shop's history on `shop/redact` | `app/routes/webhooks.compliance.jsx` |
| Storefront message + its settings | `extensions/stock-badge/blocks/stock-badge.liquid` |
| Update the message on variant change (no network calls) | `extensions/stock-badge/assets/stock-badge.js` |
| Scopes and webhook subscriptions | `shopify.app.toml` |

## Key rules

- **No metafield, no config in our database.** The threshold and messages are settings on the theme block. Liquid reads `block.settings`, and the backend reads the same values from the live theme's `templates/product.json` (needs `read_themes`).
- **Missing or invalid settings fall back to defaults** (threshold 5, "Only {count} left!"), field by field. Keep `DEFAULT_CONFIG` in `config.js` equal to the block's schema defaults.
- **Low means `inventory ≤ threshold`.** The storefront message shows only for 1 or more; at 0 the theme shows "Sold out".
- **Plain text.** The message uses the theme's font and colour and adds no CSS, so it can't affect the theme.
- **The dashboard is per product** (total inventory). **The message is per variant** (the selected colour or size).
- **Duplicate or out-of-order webhooks are harmless.** We always fetch the current total from Shopify and write a row only if the status differs from the last saved one.
- **No storefront slowdown.** The message is server-rendered Liquid, and the small script is deferred and makes no requests.

## Known simplifications

- Only the default product template (`templates/product.json`) is read. Alternate product templates use the same defaults.
- A threshold change updates the storefront and dashboard immediately. History catches up when someone clicks **Sync all**.
- Sync results are processed in the background inside the web server. A larger deployment would use a job queue.
- SQLite is used for local development. Use Postgres in production.
