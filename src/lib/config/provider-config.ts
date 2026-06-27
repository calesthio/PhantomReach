import {
  getSecret,
  listSecretMetadata,
  type LocalSecretKey,
  type SecretMetadata,
} from "./local-secrets";

interface ProviderDefinition {
  key: LocalSecretKey;
  provider: string;
  label: string;
  env: string[];
  required: boolean;
  unlocks: string;
  setup?: {
    docsUrl: string;
    envVar: string;
    steps: string[];
  };
}

export interface DataSourceMetadata extends SecretMetadata {
  required: boolean;
  unlocks: string;
  source: "sqlite" | "env" | "missing";
  setup?: ProviderDefinition["setup"];
}

export const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    key: "google_places_api_key",
    provider: "google",
    label: "Google Places",
    env: ["GOOGLE_PLACES_API_KEY"],
    required: true,
    unlocks: "Find businesses, Google profiles, reviews, and competitors.",
    setup: {
      docsUrl: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
      envVar: "GOOGLE_PLACES_API_KEY",
      steps: [
        "Create or select a Google Cloud project.",
        "Enable the Places API.",
        "Create an API key and paste it here.",
      ],
    },
  },
  {
    key: "google_pagespeed_api_key",
    provider: "google",
    label: "Google PageSpeed",
    env: ["GOOGLE_PAGESPEED_API_KEY"],
    required: false,
    unlocks: "Check website speed, mobile experience, and technical SEO.",
    setup: {
      docsUrl: "https://console.cloud.google.com/apis/library/pagespeedonline.googleapis.com",
      envVar: "GOOGLE_PAGESPEED_API_KEY",
      steps: [
        "Use the same Google Cloud project as Places if possible.",
        "Enable the PageSpeed Insights API.",
        "Create or reuse an API key and paste it here.",
      ],
    },
  },
  {
    key: "google_crux_api_key",
    provider: "google",
    label: "Google Chrome UX Report",
    env: ["GOOGLE_CRUX_API_KEY"],
    required: false,
    unlocks: "Check real-user Chrome field performance when the API is enabled.",
    setup: {
      docsUrl: "https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com",
      envVar: "GOOGLE_CRUX_API_KEY",
      steps: [
        "Open the Chrome UX Report API page in Google Cloud.",
        "Enable the API for the project that owns your key.",
        "Paste a CrUX-enabled key here, or leave blank to try the PageSpeed or Places key.",
      ],
    },
  },
  {
    key: "census_api_key",
    provider: "government",
    label: "US Census",
    env: ["CENSUS_API_KEY"],
    required: false,
    unlocks: "Add ZIP-level public market context such as population and median income.",
    setup: {
      docsUrl: "https://api.census.gov/data/key_signup.html",
      envVar: "CENSUS_API_KEY",
      steps: [
        "Request a key from the Census Data API signup page.",
        "Confirm the key from the email Census sends you.",
        "Paste the key here and click Test.",
      ],
    },
  },
  {
    key: "opencorporates_api_token",
    provider: "business_records",
    label: "OpenCorporates",
    env: ["OPENCORPORATES_API_TOKEN"],
    required: false,
    unlocks: "Add public business filing context when an OpenCorporates API token is available.",
    setup: {
      docsUrl: "https://api.opencorporates.com/documentation/API-Reference",
      envVar: "OPENCORPORATES_API_TOKEN",
      steps: [
        "Create or log in to an OpenCorporates API Account.",
        "Copy the API token from the account/API area.",
        "Paste the token here and click Test.",
      ],
    },
  },
  {
    key: "llm_provider",
    provider: "ai",
    label: "AI Provider",
    env: ["LLM_PROVIDER"],
    required: false,
    unlocks: "Choose which AI provider writes summaries and recommendations.",
  },
  {
    key: "openai_api_key",
    provider: "ai",
    label: "OpenAI API Key",
    env: ["OPENAI_API_KEY"],
    required: false,
    unlocks: "Use OpenAI for executive summaries and strategy writing.",
  },
  {
    key: "anthropic_api_key",
    provider: "ai",
    label: "Anthropic API Key",
    env: ["ANTHROPIC_API_KEY"],
    required: false,
    unlocks: "Use Anthropic for executive summaries and strategy writing.",
  },
  {
    key: "google_ai_api_key",
    provider: "ai",
    label: "Google Gemini API Key",
    env: ["GOOGLE_AI_API_KEY", "GEMINI_API_KEY"],
    required: false,
    unlocks: "Use Gemini for executive summaries and strategy writing.",
  },
  {
    key: "yelp_api_key",
    provider: "yelp",
    label: "Yelp",
    env: ["YELP_API_KEY"],
    required: false,
    unlocks: "Optional extra review source.",
  },
];

function maskSecret(value: string): string {
  if (value.length <= 8) return "....";
  return `${value.slice(0, 4)}...${value.slice(-3)}`;
}

function envValue(definition: ProviderDefinition): string | undefined {
  for (const envName of definition.env) {
    const value = process.env[envName]?.trim();
    if (value) return value;
  }
  return undefined;
}

export async function getProviderSecret(key: LocalSecretKey): Promise<string | undefined> {
  try {
    const sqliteValue = await getSecret(key);
    if (sqliteValue) return sqliteValue;
  } catch {
    return undefined;
  }

  const definition = PROVIDER_DEFINITIONS.find((item) => item.key === key);
  return definition ? envValue(definition) : undefined;
}

export async function listDataSources(): Promise<DataSourceMetadata[]> {
  const stored = await listSecretMetadata();
  const storedByKey = new Map(stored.map((item) => [item.key, item]));

  return PROVIDER_DEFINITIONS.map((definition) => {
    const storedMetadata = storedByKey.get(definition.key);
    if (storedMetadata) {
      return {
        ...storedMetadata,
        required: definition.required,
        unlocks: definition.unlocks,
        source: "sqlite" as const,
        setup: definition.setup,
      };
    }

    const fromEnv = envValue(definition);
    if (fromEnv) {
      return {
        key: definition.key,
        provider: definition.provider,
        label: definition.label,
        configured: true,
        maskedValue: maskSecret(fromEnv),
        status: "connected",
        required: definition.required,
        unlocks: definition.unlocks,
        source: "env" as const,
        setup: definition.setup,
      };
    }

    return {
      key: definition.key,
      provider: definition.provider,
      label: definition.label,
      configured: false,
      status: definition.required ? "missing" : "optional",
      required: definition.required,
      unlocks: definition.unlocks,
      source: "missing" as const,
      setup: definition.setup,
    };
  });
}

export function getProviderDefinition(key: LocalSecretKey): ProviderDefinition | undefined {
  return PROVIDER_DEFINITIONS.find((definition) => definition.key === key);
}
