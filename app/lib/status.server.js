import db from "../db.server";
import { statusFor } from "./config";

// Compare a product's current inventory with its last saved status.

// Writes a history row only when the status actually changes, so duplicate
// or repeated webhooks are harmless.

// product = { id, title, totalInventory, tracksInventory }
export async function recordStatus({ shop, product, threshold, source }) {
  // Products that don't track stock are never "low".
  const newStatus = product.tracksInventory
    ? statusFor(product.totalInventory, threshold)
    : "OK";

  const last = await db.statusChange.findFirst({
    where: { shop, productId: product.id },
    orderBy: { createdAt: "desc" },
  });
  // A product we've never seen is assumed OK, so we only log real drops.
  const oldStatus = last?.newStatus ?? "OK";
  if (oldStatus === newStatus) return null;

  return db.statusChange.create({
    data: {
      shop,
      productId: product.id,
      productTitle: product.title,
      oldStatus,
      newStatus,
      inventory: product.totalInventory,
      threshold,
      source,
    },
  });
}
