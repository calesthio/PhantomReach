const PROD_APP_URL = "https://phantomreach.io";
const DEV_APP_URL = "http://localhost:3000";

export function getAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  return process.env.NODE_ENV === "development" ? DEV_APP_URL : PROD_APP_URL;
}
