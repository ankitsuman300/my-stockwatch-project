import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// Last 20 LOW <-> OK changes for this shop, newest first.
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const changes = await db.statusChange.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    changes: changes.map((change) => ({
      ...change,
      createdAt: change.createdAt.toISOString(),
    })),
  };
};

function statusBadge(status) {
  return status === "LOW" ? (
    <s-badge tone="critical">Low</s-badge>
  ) : (
    <s-badge tone="success">OK</s-badge>
  );
}

export default function Activity() {
  const { changes } = useLoaderData();

  return (
    <s-page heading="Activity">
      <s-section>
        {changes.length === 0 ? (
          <s-stack direction="block" gap="base" alignItems="center" padding="large">
            <s-heading>No activity yet</s-heading>
            <s-paragraph>
              When a product becomes low or recovers, it will show up here.
            </s-paragraph>
          </s-stack>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>When</s-table-header>
              <s-table-header>Product</s-table-header>
              <s-table-header>Change</s-table-header>
              <s-table-header format="numeric">Inventory</s-table-header>
              <s-table-header format="numeric">Threshold</s-table-header>
              <s-table-header>Source</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {changes.map((change) => (
                <s-table-row key={change.id}>
                  <s-table-cell>
                    {new Date(change.createdAt).toLocaleString()}
                  </s-table-cell>
                  <s-table-cell>{change.productTitle}</s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      {statusBadge(change.oldStatus)}
                      <s-text>→</s-text>
                      {statusBadge(change.newStatus)}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>{change.inventory}</s-table-cell>
                  <s-table-cell>{change.threshold}</s-table-cell>
                  <s-table-cell>
                    {change.source === "SYNC" ? "Sync all" : "Inventory change"}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
