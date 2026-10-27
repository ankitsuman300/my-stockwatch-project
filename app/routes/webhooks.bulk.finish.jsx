import { authenticate } from "../shopify.server";
import { processSyncResult } from "../lib/sync.server";

// Shopify calls this when the "Sync all" bulk operation finishes.

export const action = async ({ request }) => {
  const { shop, admin, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}: ${payload.status}`);

  if (!admin || payload.status !== "completed") return new Response();

  // Shopify waits only 5 seconds for a reply, and a big store takes longer to
  // process, so we answer straight away and keep working in the background.

  processSyncResult({
    admin,
    shop,
    bulkOperationId: payload.admin_graphql_api_id,
  })
    .then((changed) => console.log(`Sync for ${shop}: ${changed} changes`))
    .catch((error) => console.error(`Sync for ${shop} failed`, error));

  return new Response();
};
