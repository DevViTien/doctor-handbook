import { redirect } from "next/navigation";

import { routes } from "@/config/routes";
import { getCurrentAuth, getHomeRouteForRole } from "@/server/auth/guards";

/** Entry point: send each user to their home screen. */
export default async function RootPage() {
  const auth = await getCurrentAuth();
  redirect(auth ? getHomeRouteForRole(auth.account.role) : routes.auth.login);
}
