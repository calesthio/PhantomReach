/**
 * Module 5: Social Media Presence Scan
 * Tool: scanSocialProfiles
 *
 * Extracts social links from the business website. A link proves a profile
 * was found; it does not prove the profile is active, recent, or engaged.
 */

import type { SocialPresenceResult } from "@/lib/db/types";

interface ScanSocialProfilesParams {
  businessName: string;
  website?: string;
  city?: string;
}

export async function scanSocialProfiles(
  params: ScanSocialProfilesParams
): Promise<SocialPresenceResult> {
  const socialLinks = params.website
    ? await extractSocialLinksFromWebsite(params.website)
    : [];

  const platforms = buildPlatformResults(socialLinks);
  const platforms_found = platforms.filter((p) => p.found).length;
  const platforms_active = platforms.filter((p) => p.is_active && p.found).length;
  const total_following = platforms
    .filter((p) => p.found && p.follower_count)
    .reduce((sum, p) => sum + (p.follower_count || 0), 0);

  let score = 0;
  if (platforms_found === 0) {
    score = 50;
  } else {
    score += Math.min(35, (platforms_found / 7) * 35);
    score += Math.min(20, Math.floor(total_following / 500));
    score += 20;
  }
  score = Math.round(score);

  const findings: string[] = [];

  if (socialLinks.length > 0) {
    findings.push(`Found ${socialLinks.length} social media link(s) on the business website`);
    for (const link of socialLinks) {
      findings.push(`${link.platform}: ${link.url}`);
    }
  } else if (params.website) {
    findings.push("No social media links found on the business website; profiles may exist but are not linked");
  } else {
    findings.push("No website provided, so social links could not be checked from the website");
  }

  if (platforms_found > 0) {
    findings.push(`Linked profile presence found on ${platforms_found} platform(s)`);
  }

  findings.push("Profile activity, follower count, and post recency were not verified from the website link scan");

  const recommendations: string[] = [
    "Ensure active social profiles are linked from the business website",
    "Maintain consistent name, address, and phone details across linked social profiles",
  ];

  if (platforms_found === 0) {
    recommendations.push("Check major social profiles and link the active ones from the website");
  }

  return {
    grade: scoreToGradeLabel(score),
    score,
    platforms,
    platforms_found,
    platforms_active,
    total_following,
    nap_consistent: true,
    findings,
    recommendations,
  };
}

interface SocialLink {
  platform: string;
  url: string;
}

async function extractSocialLinksFromWebsite(websiteUrl: string): Promise<SocialLink[]> {
  try {
    const res = await fetch(websiteUrl, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PhantomReach/2.0; +https://phantomreach.com/bot)",
        Accept: "text/html",
      },
    });

    if (!res.ok) return [];

    const html = await res.text();
    const links: SocialLink[] = [];
    const socialPatterns: { platform: string; pattern: RegExp }[] = [
      { platform: "Facebook", pattern: /https?:\/\/(?:www\.)?facebook\.com\/[^\s"'<>]+/gi },
      { platform: "Instagram", pattern: /https?:\/\/(?:www\.)?instagram\.com\/[^\s"'<>]+/gi },
      { platform: "Twitter/X", pattern: /https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s"'<>]+/gi },
      { platform: "LinkedIn", pattern: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>]+/gi },
      { platform: "YouTube", pattern: /https?:\/\/(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)[^\s"'<>]+/gi },
      { platform: "TikTok", pattern: /https?:\/\/(?:www\.)?tiktok\.com\/@[^\s"'<>]+/gi },
      { platform: "Yelp", pattern: /https?:\/\/(?:www\.)?yelp\.com\/biz\/[^\s"'<>]+/gi },
      { platform: "Pinterest", pattern: /https?:\/\/(?:www\.)?pinterest\.com\/[^\s"'<>]+/gi },
    ];

    for (const { platform, pattern } of socialPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        const cleanUrl = matches[0].replace(/["'<>].*$/, "").replace(/\/$/, "");
        if (!links.some((link) => link.platform === platform)) {
          links.push({ platform, url: cleanUrl });
        }
      }
    }

    return links;
  } catch {
    return [];
  }
}

interface PlatformResult {
  name: string;
  url?: string;
  found: boolean;
  follower_count?: number;
  post_frequency?: string;
  last_post_date?: string;
  is_active: boolean;
  engagement_rate?: number;
}

function buildPlatformResults(socialLinks: SocialLink[]): PlatformResult[] {
  const allPlatforms = ["Facebook", "Instagram", "LinkedIn", "Twitter/X", "YouTube", "TikTok", "Nextdoor"];

  return allPlatforms.map((name): PlatformResult => {
    const link = socialLinks.find((item) => item.platform === name);
    if (link) {
      return {
        name,
        url: link.url,
        found: true,
        is_active: false,
      };
    }

    return {
      name,
      found: false,
      is_active: false,
    };
  });
}

function scoreToGradeLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Solid";
  if (score >= 40) return "Developing";
  return "Needs Attention";
}
