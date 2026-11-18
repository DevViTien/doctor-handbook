import "server-only";

import { and, isNotNull, sql } from "drizzle-orm";

import { TRASH_RETENTION_DAYS } from "@/config/retention";
import { patients } from "@/server/db/schema";

/**
 * THE definition of "in the trash and still restorable" (design §2): deleted less than 30 days
 * ago. Listing, counting and restoring all use it, so an expired patient disappears exactly at
 * the deadline, whenever the daily purge actually runs. Shared: backup exports exactly the patients
 * the trash still shows.
 */
export function trashIsLive() {
  return and(
    isNotNull(patients.deletedAt),
    sql`${patients.deletedAt} > now() - make_interval(days => ${TRASH_RETENTION_DAYS})`,
  );
}

/** Deleted 30 days ago or more: due for the daily purge. */
export function trashIsExpired() {
  return sql`${patients.deletedAt} <= now() - make_interval(days => ${TRASH_RETENTION_DAYS})`;
}
