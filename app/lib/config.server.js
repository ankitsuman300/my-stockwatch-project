import { sanitizeConfig } from "./config";

// No metafield and no database: Maya's settings live on the "Low stock message"
// block in her theme editor. Shopify saves them in the live theme's
// templates/product.json, and we read them from there.
const TEMPLATE_FILE = "templates/product.json";

// App blocks appear in the template as "shopify://apps/<app>/blocks/stock-badge/<id>".
const BLOCK_TYPE_PART = "/blocks/stock-badge/";

export async function getConfig(admin) {
  const response = await admin.graphql(
    `#graphql
      query StockwatchThemeSettings($filenames: [String!]!) {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            files(filenames: $filenames, first: 1) {
              nodes {
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      }`,
    { variables: { filenames: [TEMPLATE_FILE] } },
  );
  const { data } = await response.json();
  const content = data.themes.nodes[0]?.files.nodes[0]?.body?.content;
  const settings = findBlockSettings(content);

  return {
    blockFound: Boolean(settings),
    ...sanitizeConfig(
      settings && {
        threshold: settings.threshold,
        messageSingular: settings.message_singular,
        messagePlural: settings.message_plural,
      },
    ),
  };
}

// Returns our block's settings from the template JSON, or null if Maya hasn't added it.
function findBlockSettings(content) {
  if (!content) return null;

  let template;
  try {
    // Shopify puts a /* comment */ at the top of template files; JSON can't have that.
    template = JSON.parse(content.replace(/^\s*\/\*[\s\S]*?\*\//, ""));
  } catch {
    return null;
  }

  for (const section of Object.values(template.sections ?? {})) {
    for (const block of Object.values(section.blocks ?? {})) {
      if (block.type?.includes(BLOCK_TYPE_PART) && !block.disabled) {
        // Settings left at their default may be missing; sanitizeConfig fills them in.
        return block.settings ?? {};
      }
    }
  }
  return null;
}
