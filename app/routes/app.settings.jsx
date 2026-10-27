import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { getConfig } from "../lib/config.server";
import { formatMessage } from "../lib/config";

// Maya edits the threshold and messages on the "Low stock message" block in
// her theme editor (Shopify validates the number range there and shows a live
// preview). This page shows what is currently set and links her there.
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { config, blockFound } = await getConfig(admin);

  // Opens the product template in the theme editor. If the block isn't there
  // yet, addAppBlockId adds it for her.
  // eslint-disable-next-line no-undef
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  const editorUrl = blockFound
    ? "shopify:admin/themes/current/editor?template=product"
    : `shopify:admin/themes/current/editor?template=product&addAppBlockId=${apiKey}/stock-badge&target=mainSection`;

  return { config, blockFound, editorUrl };
};

export default function Settings() {
  const { config, blockFound, editorUrl } = useLoaderData();
  const previewCounts = [1, 2, config.threshold].filter(
    (count, index, all) => all.indexOf(count) === index,
  );

  return (
    <s-page heading="Settings">
      <s-button slot="primary-action" variant="primary" href={editorUrl}>
        {blockFound ? "Edit in theme editor" : "Add to product page"}
      </s-button>

      {!blockFound && (
        <s-banner tone="warning" heading="Not on your product page yet">
          Add the Low stock message block to your product page. Until then, the
          defaults below are used for the dashboard and history.
        </s-banner>
      )}

      <s-section heading="Current settings">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Low when stock is at or below: <s-text type="strong">{config.threshold}</s-text>
          </s-paragraph>
          <s-paragraph>
            Message when 1 is left: <s-text type="strong">{config.messageSingular}</s-text>
          </s-paragraph>
          <s-paragraph>
            Message when 2 or more are left:{" "}
            <s-text type="strong">{config.messagePlural}</s-text>
          </s-paragraph>
          <s-paragraph color="subdued">
            To change these, open the theme editor, select the Low stock message
            block on the product page, and save.
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="What shoppers see">
        <s-stack direction="block" gap="base">
          {previewCounts.map((count) => (
            <s-stack key={count} direction="block" gap="small-200">
              <s-text color="subdued">With {count} in stock</s-text>
              <s-text>{formatMessage(config, count)}</s-text>
            </s-stack>
          ))}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
