import { authenticate } from "../shopify.server";
import db from "../db.server";

// Mandatory privacy webhooks.
// We store no customer data, so customer requests need no action.
// shop/redact arrives ~48 hours after uninstall: delete everything for that shop.

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  if (topic === "SHOP_REDACT") {
    await db.statusChange.deleteMany({ where: { shop } });
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
