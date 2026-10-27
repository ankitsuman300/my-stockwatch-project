import { authenticate } from "../shopify.server";
import { getConfig } from "../lib/config.server";
import { recordStatus } from "../lib/status.server";

// Fires on every stock change: sale, restock, manual edit, POS, other apps.
export const action = async ({ request }) => {
  const { shop, admin, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // No session means the app was uninstalled; nothing to do.
  if (!admin) return new Response();

  // The payload only has the inventory item and ONE location's number, so we
  // don't trust it. We ask Shopify for the product's current total instead.
  // That also makes late or out-of-order webhooks harmless.

  const response = await admin.graphql(
    `#graphql
      query StockwatchInventoryItem($id: ID!) {
        inventoryItem(id: $id) {
          variant {
            product {
              id
              title
              totalInventory
              tracksInventory
            }
          }
        }
      }`,
    {
      variables: {
        id: `gid://shopify/InventoryItem/${payload.inventory_item_id}`,
      },
    },
  );
  const { data } = await response.json();
  const product = data.inventoryItem?.variant?.product;
  if (!product) return new Response();

  const { config } = await getConfig(admin);
  await recordStatus({
    shop,
    product,
    threshold: config.threshold,
    source: "WEBHOOK",
  });

  return new Response();
};
