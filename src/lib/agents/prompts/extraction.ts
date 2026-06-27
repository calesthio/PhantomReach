/**
 * Extraction prompts for Claude Haiku.
 * These are designed for fast, structured data extraction tasks.
 */

/**
 * Prompt for analyzing review sentiment from raw review text.
 * Returns structured JSON with sentiment breakdown and themes.
 */
export function getReviewSentimentPrompt(reviews: string[]): string {
  const reviewBlock = reviews
    .map((r, i) => `[Review ${i + 1}]: ${r}`)
    .join("\n");

  return `<task>
Analyze the following customer reviews and extract structured sentiment data.
</task>

<reviews>
${reviewBlock}
</reviews>

<instructions>
Analyze each review for sentiment and extract recurring themes. Return ONLY valid
JSON with no additional text or markdown formatting.
</instructions>

<output_schema>
{
  "sentiment_breakdown": {
    "positive": <number 0-100, percentage of reviews>,
    "neutral": <number 0-100, percentage of reviews>,
    "negative": <number 0-100, percentage of reviews>
  },
  "top_praise_themes": [<string>, ...],  // max 5 themes
  "top_complaint_themes": [<string>, ...],  // max 5 themes
  "trend_direction": "improving" | "stable" | "declining",
  "average_sentiment_score": <number 0-1, overall positivity>,
  "confidence": <number 0-1, confidence in analysis given data quality>
}
</output_schema>

<guidelines>
- Base sentiment on actual language, not star ratings
- Themes should be specific (e.g., "slow service" not "bad experience")
- Limit praise and complaint themes to the top 5 each
- Set confidence lower when fewer than 10 reviews are provided
- If reviews are insufficient to determine a trend, use "stable"
</guidelines>`;
}

/**
 * Prompt for extracting tech stack from HTML <head> content.
 * Returns structured JSON with detected technologies.
 */
export function getTechStackExtractionPrompt(htmlHead: string): string {
  return `<task>
Analyze the following HTML head content and identify the technology stack in use.
</task>

<html_head>
${htmlHead}
</html_head>

<instructions>
Identify technologies from script tags, meta tags, link tags, and inline references.
Return ONLY valid JSON with no additional text or markdown formatting.
</instructions>

<output_schema>
{
  "cms": <string | null>,
  "analytics": [<string>, ...],
  "marketing_automation": [<string>, ...],
  "chat_widget": <string | null>,
  "booking_system": <string | null>,
  "payment_processor": <string | null>,
  "ecommerce": <string | null>,
  "hosting_cdn": <string | null>,
  "email_provider": <string | null>,
  "ssl_issuer": <string | null>,
  "frameworks": [<string>, ...],
  "tag_managers": [<string>, ...],
  "additional_tools": [<string>, ...],
  "confidence": <number 0-1, overall extraction confidence>
}
</output_schema>

<detection_hints>
- CMS: Look for wp-content (WordPress), Shopify CDN, Squarespace, Wix, etc.
- Analytics: Google Analytics (gtag, UA-), Google Tag Manager, Facebook Pixel, Hotjar, etc.
- Marketing: HubSpot, Mailchimp, ActiveCampaign, Klaviyo, etc.
- Chat: Intercom, Drift, Zendesk, LiveChat, Tawk.to, Crisp, etc.
- Booking: Calendly, Acuity, Booksy, Square Appointments, etc.
- CDN: Cloudflare, Fastly, AWS CloudFront, Vercel, Netlify, etc.
- Only include technologies you can confirm from the HTML; do not guess
</detection_hints>`;
}

/**
 * Prompt for analyzing website content quality from markdown.
 * Returns structured JSON with content analysis.
 */
export function getWebsiteContentPrompt(markdownContent: string): string {
  return `<task>
Analyze the following website content (converted to markdown) for quality,
clarity, and conversion optimization.
</task>

<website_content>
${markdownContent}
</website_content>

<instructions>
Evaluate the content for business effectiveness. Return ONLY valid JSON with
no additional text or markdown formatting.
</instructions>

<output_schema>
{
  "has_clear_value_proposition": <boolean>,
  "has_call_to_action": <boolean>,
  "cta_types": [<string>, ...],
  "has_contact_info": <boolean>,
  "has_social_proof": <boolean>,
  "has_service_descriptions": <boolean>,
  "has_pricing": <boolean>,
  "readability_score": <number 1-10, where 10 is easiest to read>,
  "content_quality_score": <number 1-10, where 10 is excellent>,
  "seo_signals": {
    "has_h1": <boolean>,
    "heading_structure_valid": <boolean>,
    "estimated_word_count": <number>,
    "has_meta_description": <boolean>,
    "has_schema_markup_hints": <boolean>
  },
  "improvement_suggestions": [<string>, ...],  // max 5
  "confidence": <number 0-1>
}
</output_schema>

<guidelines>
- Evaluate from a potential customer's perspective
- A clear value proposition answers "why should I choose this business?"
- Strong CTAs are specific ("Book a Free Consultation") not vague ("Contact Us")
- Social proof includes testimonials, review counts, certifications, client logos
- Content quality considers clarity, professionalism, specificity, and completeness
- Keep improvement suggestions specific and actionable
</guidelines>`;
}
