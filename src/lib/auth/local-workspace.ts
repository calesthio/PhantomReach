import "server-only";

import { db } from "@/lib/db";
import type { User } from "@/lib/db/types";

export async function getLocalWorkspaceUser(): Promise<User> {
  const maybeLocal = db as typeof db & {
    getLocalWorkspaceUser?: () => Promise<User>;
  };

  if (typeof maybeLocal.getLocalWorkspaceUser !== "function") {
    throw new Error("The active database does not expose a local workspace user.");
  }

  return maybeLocal.getLocalWorkspaceUser();
}
