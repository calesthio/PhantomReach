import "server-only";

import type { User } from "@/lib/db/types";
import { getLocalWorkspaceUser } from "./local-workspace";

export function getAuthErrorMessage(): string {
  return "Phantom Reach is running in local workspace mode. Authentication is not required.";
}

export async function getCurrentUser(): Promise<User> {
  return getLocalWorkspaceUser();
}

export async function requireCurrentUser(): Promise<User> {
  return getLocalWorkspaceUser();
}
