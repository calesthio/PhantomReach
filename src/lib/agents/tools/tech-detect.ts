/**
 * Module 4: Technology Stack & Digital Maturity Profile
 * Tool: detect_tech_stack
 *
 * Analyzes a website's HTML to detect CMS, analytics, marketing tools,
 * and other technology fingerprints. Calculates a category-neutral
 * digital maturity score from evidence found in the page source.
 */

import type { TechStackResult } from "@/lib/db/types";
import { unavailable, type UnavailableResult } from "./unavailable";

interface TechDetectParams {
  url: string;
  html?: string;
}

const TECH_SIGNATURES: Record<string, { category: string; patterns: RegExp[] }> = {
  WordPress: { category: "cms", patterns: [/wp-content/i, /wp-includes/i, /wordpress/i] },
  Shopify: { category: "cms", patterns: [/cdn\.shopify\.com/i, /shopify/i] },
  Squarespace: { category: "cms", patterns: [/squarespace\.com/i, /static1\.squarespace/i] },
  Wix: { category: "cms", patterns: [/wix\.com/i, /wixstatic\.com/i] },
  Webflow: { category: "cms", patterns: [/webflow\.com/i, /assets\.website-files/i] },
  "GoDaddy Website Builder": { category: "cms", patterns: [/godaddy\.com\/website-builder/i, /img1\.wsimg\.com/i] },

  "Google Analytics (GA4)": { category: "analytics", patterns: [/gtag.*G-/i, /googletagmanager.*gtag/i] },
  "Google Analytics (Universal)": { category: "analytics", patterns: [/ua-\d{4,}/i, /google-analytics\.com\/analytics/i] },
  "Google Tag Manager": { category: "analytics", patterns: [/googletagmanager\.com\/gtm/i, /GTM-/i] },
  "Facebook Pixel": { category: "analytics", patterns: [/facebook\.net\/signals/i, /fbq\(/i, /connect\.facebook\.net/i] },
  Hotjar: { category: "analytics", patterns: [/hotjar\.com/i, /hj\(/i] },

  HubSpot: { category: "marketing", patterns: [/js\.hs-scripts\.com/i, /hubspot/i] },
  Mailchimp: { category: "marketing", patterns: [/mailchimp\.com/i, /mc\.us/i, /list-manage\.com/i] },
  ActiveCampaign: { category: "marketing", patterns: [/activecampaign\.com/i, /trackcmp/i] },
  "Constant Contact": { category: "marketing", patterns: [/constantcontact\.com/i] },
  Klaviyo: { category: "marketing", patterns: [/klaviyo/i] },

  Calendly: { category: "booking", patterns: [/calendly\.com/i] },
  "Acuity Scheduling": { category: "booking", patterns: [/acuityscheduling\.com/i] },
  ServiceTitan: { category: "booking", patterns: [/servicetitan/i] },
  "Housecall Pro": { category: "booking", patterns: [/housecallpro/i] },

  Intercom: { category: "chat", patterns: [/intercom/i, /widget\.intercom\.io/i] },
  Drift: { category: "chat", patterns: [/drift\.com/i, /js\.driftt\.com/i] },
  Tidio: { category: "chat", patterns: [/tidio\.co/i, /tidioChatApi/i] },
  LiveChat: { category: "chat", patterns: [/livechat/i, /livechatinc\.com/i] },
  "Facebook Messenger": { category: "chat", patterns: [/customerchat/i, /facebook\.com\/customer_chat/i] },

  Stripe: { category: "payment", patterns: [/stripe\.com/i, /js\.stripe/i] },
  Square: { category: "payment", patterns: [/squareup\.com/i, /square/i] },
  PayPal: { category: "payment", patterns: [/paypal\.com/i, /paypalobjects/i] },

  WooCommerce: { category: "ecommerce", patterns: [/woocommerce/i, /wc-/i] },
  BigCommerce: { category: "ecommerce", patterns: [/bigcommerce\.com/i] },

  Cloudflare: { category: "hosting", patterns: [/cloudflare/i, /cf-ray/i] },
  AWS: { category: "hosting", patterns: [/amazonaws\.com/i, /cloudfront\.net/i] },
  Vercel: { category: "hosting", patterns: [/vercel\.app/i, /_next\//i] },
  Netlify: { category: "hosting", patterns: [/netlify/i] },

  jQuery: { category: "library", patterns: [/jquery/i] },
  React: { category: "library", patterns: [/__NEXT_DATA__/i, /react/i, /_next\//i] },
  Bootstrap: { category: "library", patterns: [/bootstrap/i] },
  "Font Awesome": { category: "library", patterns: [/font-awesome/i, /fontawesome/i] },
  "Google Fonts": { category: "library", patterns: [/fonts\.googleapis\.com/i] },
  reCAPTCHA: { category: "security", patterns: [/recaptcha/i, /google\.com\/recaptcha/i] },
};

const MATURITY_WEIGHTS: Record<string, number> = {
  cms: 15,
  analytics: 20,
  marketing: 15,
  chat: 10,
  payment: 10,
  ecommerce: 5,
  hosting: 5,
  security: 5,
};

export async function detectTechStack(
  params: TechDetectParams
): Promise<{ analysis: TechStackResult; rawHtmlHead?: string } | UnavailableResult> {
  let html = params.html;

  if (!html) {
    try {
      const response = await fetch(params.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PhantomReachBot/1.0)",
        },
        signal: AbortSignal.timeout(15000),
        redirect: "follow",
      });

      if (!response.ok) {
        return unavailable(
          "tech_detect",
          "failed",
          `Website HTML fetch returned ${response.status} for ${params.url}.`
        );
      }

      html = await response.text();
    } catch (err: any) {
      return unavailable(
        "tech_detect",
        "failed",
        `Website HTML fetch failed for ${params.url}: ${err.message}`
      );
    }
  }

  const detected: Record<string, string[]> = {};
  for (const [tech, config] of Object.entries(TECH_SIGNATURES)) {
    for (const pattern of config.patterns) {
      if (pattern.test(html)) {
        detected[config.category] ??= [];
        if (!detected[config.category].includes(tech)) {
          detected[config.category].push(tech);
        }
        break;
      }
    }
  }

  let maturityScore = 0;
  for (const [category, weight] of Object.entries(MATURITY_WEIGHTS)) {
    if (detected[category]?.length > 0) {
      maturityScore += weight;
    }
  }

  const gaps: string[] = [];
  if (!detected.analytics?.length) {
    gaps.push("No analytics detected, so website traffic and conversion behavior may be hard to measure");
  }
  if (!detected.marketing?.length) {
    gaps.push("No email or marketing automation detected for capturing repeat demand");
  }
  if (!detected.chat?.length) {
    gaps.push("No live chat or messaging widget detected for visitor questions");
  }
  if (!detected.payment?.length) {
    gaps.push("No online payment processing detected");
  }

  const findings: string[] = [];
  const recommendations: string[] = [];
  const cms = detected.cms?.[0] || "Unknown/Custom";
  findings.push(`CMS: ${cms}`);

  if (detected.analytics?.length) {
    findings.push(`Analytics: ${detected.analytics.join(", ")}`);
  } else {
    findings.push("No web analytics detected");
    recommendations.push("Install Google Analytics 4 to understand visitor and conversion behavior");
  }

  if (detected.marketing?.length) {
    findings.push(`Marketing tools: ${detected.marketing.join(", ")}`);
  } else {
    recommendations.push("Add an email capture path for repeat customers and seasonal announcements");
  }

  if (!detected.chat?.length) {
    recommendations.push("Add a clear question/contact path for visitors who need help before converting");
  }

  if (maturityScore < 40) {
    findings.push(`Digital maturity score of ${maturityScore}/100 indicates several measurement or conversion tools are missing`);
  }

  const analysis: TechStackResult = {
    grade: scoreToGrade(maturityScore),
    score: maturityScore,
    digital_maturity_score: maturityScore,
    cms: detected.cms?.[0],
    analytics: detected.analytics || [],
    marketing_automation: detected.marketing || [],
    booking_system: detected.booking?.[0],
    chat_widget: detected.chat?.[0],
    payment_processor: detected.payment?.[0],
    ecommerce: detected.ecommerce?.[0],
    hosting_cdn: detected.hosting?.[0],
    technology_gaps: gaps,
    findings,
    recommendations,
  };

  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  const rawHtmlHead = headMatch ? headMatch[1].slice(0, 15000) : undefined;

  return { analysis, rawHtmlHead };
}

function scoreToGrade(score: number): string {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}
