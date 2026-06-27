/**
 * White-label theme presets for Phantom Reach.
 *
 * Agencies on the Agency tier can apply one of these presets
 * or create a custom theme. The theme controls:
 *  - Dashboard colors (CSS variables)
 *  - PDF/export report branding
 *  - Widget appearance
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  colors: {
    primary: string;       // Main brand color
    primaryForeground: string;
    secondary: string;     // Supporting color
    secondaryForeground: string;
    accent: string;        // Highlight / CTA color
    accentForeground: string;
    background: string;
    foreground: string;
    muted: string;
    mutedForeground: string;
    card: string;
    cardForeground: string;
    border: string;
    destructive: string;
    destructiveForeground: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  borderRadius: string;  // CSS value (e.g., "0.5rem")
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "phantom-default",
    name: "Phantom Default",
    description: "Purple-forward modern SaaS aesthetic. The default Phantom Reach look.",
    bestFor: ["SaaS", "technology", "digital agencies"],
    colors: {
      primary: "262 83% 58%",         // #7c3aed purple
      primaryForeground: "0 0% 100%",
      secondary: "240 5% 96%",
      secondaryForeground: "240 6% 10%",
      accent: "262 83% 58%",
      accentForeground: "0 0% 100%",
      background: "0 0% 100%",
      foreground: "222 47% 11%",
      muted: "240 5% 96%",
      mutedForeground: "240 4% 46%",
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      border: "240 6% 90%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "Inter", body: "Inter" },
    borderRadius: "0.5rem",
  },
  {
    id: "ocean-depths",
    name: "Ocean Depths",
    description: "Deep navy and teal palette. Professional and authoritative.",
    bestFor: ["finance", "healthcare", "legal", "consulting"],
    colors: {
      primary: "200 40% 15%",         // #1a2332 deep navy
      primaryForeground: "0 0% 100%",
      secondary: "180 50% 36%",       // #2d8b8b teal
      secondaryForeground: "0 0% 100%",
      accent: "168 40% 76%",          // #a8dadc seafoam
      accentForeground: "200 40% 15%",
      background: "140 20% 97%",      // #f1faee cream
      foreground: "200 40% 15%",
      muted: "168 20% 92%",
      mutedForeground: "200 20% 40%",
      card: "0 0% 100%",
      cardForeground: "200 40% 15%",
      border: "168 20% 85%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "Georgia", body: "Inter" },
    borderRadius: "0.375rem",
  },
  {
    id: "midnight-galaxy",
    name: "Midnight Galaxy",
    description: "Dark, cosmic purple palette. Bold and distinctive.",
    bestFor: ["creative agencies", "entertainment", "luxury brands"],
    colors: {
      primary: "270 35% 18%",         // #2b1e3e deep purple
      primaryForeground: "0 0% 100%",
      secondary: "240 30% 43%",       // #4a4e8f cosmic blue
      secondaryForeground: "0 0% 100%",
      accent: "270 30% 66%",          // #a490c2 lavender
      accentForeground: "0 0% 100%",
      background: "240 33% 95%",      // #e6e6fa silver
      foreground: "270 35% 18%",
      muted: "270 15% 90%",
      mutedForeground: "270 15% 45%",
      card: "0 0% 100%",
      cardForeground: "270 35% 18%",
      border: "270 15% 85%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "Playfair Display", body: "Inter" },
    borderRadius: "0.75rem",
  },
  {
    id: "modern-minimalist",
    name: "Modern Minimalist",
    description: "Clean charcoal and white. Timeless and professional.",
    bestFor: ["corporate", "b2b", "accounting", "real estate"],
    colors: {
      primary: "200 16% 26%",         // #36454f charcoal
      primaryForeground: "0 0% 100%",
      secondary: "210 11% 50%",       // #708090 slate
      secondaryForeground: "0 0% 100%",
      accent: "0 0% 83%",             // #d3d3d3 light gray
      accentForeground: "200 16% 26%",
      background: "0 0% 100%",
      foreground: "200 16% 26%",
      muted: "210 11% 96%",
      mutedForeground: "210 11% 50%",
      card: "0 0% 100%",
      cardForeground: "200 16% 26%",
      border: "210 11% 90%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "Inter", body: "Inter" },
    borderRadius: "0.375rem",
  },
  {
    id: "tech-innovation",
    name: "Tech Innovation",
    description: "Electric blue on dark. High-tech and modern.",
    bestFor: ["tech startups", "AI companies", "dev tools", "cybersecurity"],
    colors: {
      primary: "220 100% 50%",        // #0066ff electric blue
      primaryForeground: "0 0% 100%",
      secondary: "180 100% 50%",      // #00ffff cyan
      secondaryForeground: "0 0% 8%",
      accent: "220 100% 50%",
      accentForeground: "0 0% 100%",
      background: "0 0% 100%",
      foreground: "0 0% 12%",         // #1e1e1e
      muted: "220 20% 95%",
      mutedForeground: "220 10% 45%",
      card: "0 0% 100%",
      cardForeground: "0 0% 12%",
      border: "220 20% 90%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "JetBrains Mono", body: "Inter" },
    borderRadius: "0.5rem",
  },
  {
    id: "golden-hour",
    name: "Golden Hour",
    description: "Warm mustard and terracotta. Inviting and grounded.",
    bestFor: ["hospitality", "food & beverage", "wellness", "lifestyle"],
    colors: {
      primary: "42 92% 48%",          // #f4a900 mustard
      primaryForeground: "0 0% 100%",
      secondary: "350 45% 58%",       // #c1666b terracotta
      secondaryForeground: "0 0% 100%",
      accent: "32 45% 72%",           // #d4b896 warm beige
      accentForeground: "25 15% 25%",
      background: "0 0% 100%",
      foreground: "25 15% 25%",       // #4a403a chocolate
      muted: "32 30% 94%",
      mutedForeground: "25 10% 45%",
      card: "0 0% 100%",
      cardForeground: "25 15% 25%",
      border: "32 20% 88%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "Georgia", body: "Inter" },
    borderRadius: "0.5rem",
  },
  {
    id: "forest-canopy",
    name: "Forest Canopy",
    description: "Deep green and ivory. Natural and trustworthy.",
    bestFor: ["sustainability", "agriculture", "outdoor", "health & wellness"],
    colors: {
      primary: "120 30% 23%",         // #2d4a2b forest green
      primaryForeground: "0 0% 100%",
      secondary: "90 8% 48%",         // #7d8471 sage
      secondaryForeground: "0 0% 100%",
      accent: "80 15% 59%",           // #a4ac86 olive
      accentForeground: "120 30% 15%",
      background: "40 20% 98%",       // #faf9f6 ivory
      foreground: "120 30% 23%",
      muted: "80 10% 93%",
      mutedForeground: "90 8% 45%",
      card: "0 0% 100%",
      cardForeground: "120 30% 23%",
      border: "80 10% 87%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "Merriweather", body: "Inter" },
    borderRadius: "0.5rem",
  },
  {
    id: "sunset-boulevard",
    name: "Sunset Boulevard",
    description: "Burnt orange and coral with deep teal contrast. Energetic.",
    bestFor: ["marketing agencies", "media", "events", "retail"],
    colors: {
      primary: "14 78% 61%",          // #e76f51 burnt orange
      primaryForeground: "0 0% 100%",
      secondary: "28 87% 67%",        // #f4a261 coral
      secondaryForeground: "195 40% 24%",
      accent: "43 69% 66%",           // #e9c46a sand
      accentForeground: "195 40% 24%",
      background: "0 0% 100%",
      foreground: "195 40% 24%",      // #264653 deep teal
      muted: "28 40% 95%",
      mutedForeground: "195 20% 40%",
      card: "0 0% 100%",
      cardForeground: "195 40% 24%",
      border: "28 30% 88%",
      destructive: "0 84% 60%",
      destructiveForeground: "0 0% 100%",
    },
    fonts: { heading: "DM Serif Display", body: "Inter" },
    borderRadius: "0.75rem",
  },
];

/** Look up a theme preset by ID */
export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find((t) => t.id === id);
}

/** Generate CSS custom properties from a theme preset */
export function themeToCSSVars(theme: ThemePreset): Record<string, string> {
  return {
    "--primary": theme.colors.primary,
    "--primary-foreground": theme.colors.primaryForeground,
    "--secondary": theme.colors.secondary,
    "--secondary-foreground": theme.colors.secondaryForeground,
    "--accent": theme.colors.accent,
    "--accent-foreground": theme.colors.accentForeground,
    "--background": theme.colors.background,
    "--foreground": theme.colors.foreground,
    "--muted": theme.colors.muted,
    "--muted-foreground": theme.colors.mutedForeground,
    "--card": theme.colors.card,
    "--card-foreground": theme.colors.cardForeground,
    "--border": theme.colors.border,
    "--destructive": theme.colors.destructive,
    "--destructive-foreground": theme.colors.destructiveForeground,
    "--radius": theme.borderRadius,
    "--font-heading": theme.fonts.heading,
    "--font-body": theme.fonts.body,
  };
}

/** Build a CSS string that can be injected into :root */
export function themeToCSS(theme: ThemePreset): string {
  const vars = themeToCSSVars(theme);
  const rules = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  return `:root {\n${rules}\n}`;
}
