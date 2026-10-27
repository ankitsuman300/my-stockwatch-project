import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { getConfig } from "./config.server";
import { recordStatus } from "./status.server";

// "Sync all": a Bulk Operation lets Shopify export every product in the
// background, so it is safe for 100,000+ products and doesn't use our rate limit.
// When it finishes, Shopify calls the bulk_operations/finish webhook.

export async function startSync(admin) {
  const response = await admin.graphql(

    `#graphql
      mutation StartStockwatchSync($query: String!) {
        bulkOperationRunQuery(query: $query) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      variables: {
        query: `{
          products {
            edges {
              node {
                id
                title
                totalInventory
                tracksInventory
              }
            }
          }
        }`,
      },
    },
  );

  const { data } = await response.json();
  const { bulkOperation, userErrors } = data.bulkOperationRunQuery;
  if (userErrors.length > 0) return { error: userErrors[0].message };

  return { bulkOperation };
}

// Called from the webhook when the bulk operation is done.
export async function processSyncResult({ admin, shop, bulkOperationId }) {
  const response = await admin.graphql(
    `#graphql
      query StockwatchSyncResult($id: ID!) {
        node(id: $id) {
          ... on BulkOperation {
            status
            url
          }
        }
      }`,
    { variables: { id: bulkOperationId } },
  );

  const { data } = await response.json();
  const operation = data.node;
  // url is null when the store has no products.
  if (operation?.status !== "COMPLETED" || !operation.url) return 0;

  const { config } = await getConfig(admin);
  const file = await fetch(operation.url);

  // The result is a JSONL file (one product per line). Read it line by line
  // instead of loading it all into memory.

  const lines = createInterface({ input: Readable.fromWeb(file.body) });
  let changed = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    const product = JSON.parse(line);
    const row = await recordStatus({
      shop,
      product,
      threshold: config.threshold,
      source: "SYNC",
    });
    if (row) changed += 1;
  }

  return changed;
}
