import { useEffect } from "react";
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useRevalidator,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getConfig } from "../lib/config.server";
import { statusFor } from "../lib/config";
import { startSync } from "../lib/sync.server";

const PAGE_SIZE = 25;

// Dev's dashboard: products come live from Shopify (never copied into our DB),
// and LOW/OK is calculated on the fly against the current threshold.
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const before = url.searchParams.get("before");

  // Cursor pagination: "next" uses after=endCursor, "previous" uses before=startCursor.
  const variables = before
    ? { last: PAGE_SIZE, before }
    : { first: PAGE_SIZE, after };

  try {
    const { config } = await getConfig(admin);
    const response = await admin.graphql(
      `#graphql
        query StockwatchProducts($first: Int, $last: Int, $after: String, $before: String) {
          products(first: $first, last: $last, after: $after, before: $before, sortKey: TITLE) {
            nodes {
              id
              title
              totalInventory
              tracksInventory
              featuredMedia {
                preview {
                  image {
                    url
                    altText
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }`,
      { variables },
    );
    const { data } = await response.json();

    return {
      threshold: config.threshold,
      products: data.products.nodes,
      pageInfo: data.products.pageInfo,
      error: null,
    };
  }

  catch (error) {
    // Auth redirects are thrown as Responses; let Shopify's boundary handle them.
    if (error instanceof Response) throw error;
    console.error("Dashboard load failed", error);
    return {
      threshold: null,
      products: [],
      pageInfo: null,
      error: "We couldn't load products from Shopify. Please try again.",
    };
  }
};

// The "Sync all" button: bring every product in line with the current config.
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const result = await startSync(admin);
  if (result.error) return { ok: false, message: result.error };
  return {
    ok: true,
    message: "Sync started. Changes will appear on the Activity page.",
  };
};

export default function Dashboard() {
  const { threshold, products, pageInfo, error } = useLoaderData();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const isLoading =
    navigation.state === "loading" || revalidator.state === "loading";
  const isSyncing = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data?.message) {
      shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
    }
  }, [fetcher.data, shopify]);

  const syncAll = () => fetcher.submit({}, { method: "POST" });

  return (
    <s-page heading="Stock dashboard">
      <s-button
        slot="primary-action"
        onClick={syncAll}
        {...(isSyncing ? { loading: true } : {})}
      >
        Sync all products
      </s-button>

      {error && (
        <s-banner tone="critical" heading="Something went wrong">
          {error}
          <s-button slot="secondary-actions" onClick={() => revalidator.revalidate()}>
            Retry
          </s-button>
        </s-banner>
      )}

      {!error && (
        <s-section>
          {threshold !== null && (
            <s-paragraph>
              Products with {threshold} or fewer in stock are marked Low.
            </s-paragraph>
          )}

          {isLoading ? (
            <s-stack direction="inline" justifyContent="center" padding="large">
              <s-spinner accessibilityLabel="Loading products" />
            </s-stack>
          ) : products.length === 0 ? (
            <s-stack direction="block" gap="base" alignItems="center" padding="large">
              <s-heading>No products yet</s-heading>
              <s-paragraph>
                Add products in Shopify and they&apos;ll show up here.
              </s-paragraph>
            </s-stack>
          ) : (
            <s-table>
              <s-table-header-row>
                <s-table-header>Product</s-table-header>
                <s-table-header format="numeric">Inventory</s-table-header>
                <s-table-header>Status</s-table-header>
              </s-table-header-row>
              <s-table-body>
                {products.map((product) => productRow(product, threshold))}
              </s-table-body>
            </s-table>
          )}

          {pageInfo && (pageInfo.hasPreviousPage || pageInfo.hasNextPage) && (
            <s-stack direction="inline" gap="base" justifyContent="center" padding="base">
              <s-button
                disabled={!pageInfo.hasPreviousPage || isLoading}
                onClick={() => navigate(`?before=${pageInfo.startCursor}`)}
              >
                Previous
              </s-button>
              <s-button
                disabled={!pageInfo.hasNextPage || isLoading}
                onClick={() => navigate(`?after=${pageInfo.endCursor}`)}
              >
                Next
              </s-button>
            </s-stack>
          )}
        </s-section>
      )}
    </s-page>
  );
}

function productRow(product, threshold) {
  const image = product.featuredMedia?.preview?.image;
  const status = product.tracksInventory
    ? statusFor(product.totalInventory, threshold)
    : null;

  return (
    <s-table-row key={product.id}>
      <s-table-cell>
        <s-stack direction="inline" gap="base" alignItems="center">
          <s-thumbnail
            src={image?.url}
            alt={image?.altText || product.title}
            size="small"
          />
          <s-text>{product.title}</s-text>
        </s-stack>
      </s-table-cell>
      <s-table-cell>
        {product.tracksInventory ? product.totalInventory : "—"}
      </s-table-cell>
      <s-table-cell>
        {status === "LOW" && <s-badge tone="critical">Low</s-badge>}
        {status === "OK" && <s-badge tone="success">OK</s-badge>}
        {status === null && <s-badge>Not tracked</s-badge>}
      </s-table-cell>
    </s-table-row>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
