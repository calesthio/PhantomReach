import type { CategorySkill } from "../types";

export const defaultSkill: CategorySkill = {
  id: "default",
  name: "Local Business",
  category_patterns: [],

  review_intelligence: {
    critical_signals: [
      "Consistency mentions — 'hit or miss' signals operational problems",
      "Staff turnover signals — different names over time vs consistent team",
      "Response time complaints — 'never called back', 'hard to reach'",
      "Value perception — 'expensive' vs 'overpriced' are different signals",
      "Referral language — 'told all my friends' indicates organic growth potential",
    ],
    positive_indicators: [
      "Repeat visit language ('always come here', 'our go-to')",
      "Specific employee praise (indicates strong team culture)",
      "Recommendation language ('highly recommend', 'best in town')",
      "Value acknowledgment ('worth every penny', 'fair price')",
    ],
    negative_indicators: [
      "Communication failures ('never returned my call', 'ghosted')",
      "Bait-and-switch signals ('price changed', 'not what was quoted')",
      "Quality decline ('used to be great', 'went downhill')",
      "Management issues ('owner was rude', 'argued with me')",
    ],
    customer_decision_factors: [
      "Can I trust this business based on what others say?",
      "How easy is it to contact them and get started?",
      "Are they transparent about pricing?",
      "Do they stand behind their work?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Accurate hours (including holiday hours)",
      "Phone number that answers or has professional voicemail",
      "Website link that works and is mobile-friendly",
      "Service area or address clearly defined",
      "Business description utilizing all 750 characters",
    ],
    photo_expectations: [
      "Exterior photo (helps customers find the location)",
      "Interior photos (sets expectations)",
      "Team photos (builds trust before the visit)",
      "Work examples or products (demonstrates quality)",
    ],
    category_features: [
      "Q&A section monitored and answered",
      "Regular Google Posts (at minimum monthly)",
      "Services or products section populated",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Clear contact information above the fold",
      "Mobile-responsive design",
      "Service/product descriptions with pricing indicators",
      "Call-to-action on every page",
      "About page with team information",
    ],
    trust_signals: [
      "Customer testimonials or review widgets",
      "Professional certifications or licenses",
      "Years in business",
      "Insurance and bonding information where applicable",
      "BBB rating or industry association membership",
    ],
    friction_points: [
      "No clear way to contact or book",
      "Outdated information (old year in copyright, expired promotions)",
      "Slow load time on mobile (>3 seconds)",
      "No SSL certificate",
      "Contact form only (no phone number visible)",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "Google Analytics or equivalent web analytics",
      "Google Business Profile (claimed and optimized)",
      "Email marketing platform",
      "Online scheduling or contact form",
      "Review management tool",
    ],
    critical_gaps: [
      "No web analytics = no understanding of customer acquisition",
      "No online booking/scheduling = friction for modern consumers",
      "No email marketing = no way to nurture leads or drive repeat business",
      "No review management = competitors with more reviews always win",
    ],
    maturity_baseline: "A typical local business should score 40+ on digital maturity. Below 25 indicates a business operating primarily on word-of-mouth with minimal digital infrastructure.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Google Business Profile", why: "The most important 'social' platform for local businesses — it IS the search result." },
      { platform: "Facebook", why: "Community engagement, events, and the 35+ demographic. Still the broadest reach for local." },
      { platform: "Instagram", why: "Visual businesses benefit enormously. Even non-visual businesses build trust through behind-the-scenes content." },
      { platform: "Nextdoor", why: "Hyper-local recommendations. Often overlooked but high-intent audience." },
    ],
    content_expectations: [
      "Regular posting (minimum weekly)",
      "Mix of promotional and value-add content",
      "Community involvement and local engagement",
      "Customer spotlight or testimonial sharing",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Review volume and rating (the two numbers customers see first)",
      "Online booking/scheduling availability",
      "Response time to inquiries",
      "Transparency in pricing and process",
      "Specialization or niche focus",
    ],
    key_comparison_metrics: [
      "Google rating and review count",
      "Website quality and mobile experience",
      "Social media presence and engagement",
      "Technology adoption level",
      "Online visibility in local search",
    ],
    blind_spots: [
      "Comparing against businesses in different price tiers",
      "Ignoring offline reputation and referral networks",
      "Over-weighting social media for industries where it doesn't drive revenue",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "Varies widely by industry — $500-$10,000+ annually depending on category and service frequency",
    digital_revenue_drivers: [
      "Google Maps visibility → discovery by new customers (46% of all Google searches have local intent)",
      "Website conversion rate → turning visitors into leads or customers",
      "Review volume and rating → trust threshold that determines click-through",
      "Online booking → reduced friction = higher conversion rate",
    ],
    leakage_patterns: [
      "Invisible in local search = losing customers to visible competitors",
      "No online booking = losing impatient customers who won't call",
      "Low review count = losing trust comparison against competitors with more reviews",
      "Slow or broken website = losing 53% of mobile visitors who won't wait >3 seconds",
    ],
  },

  insider_knowledge: [
    "46% of all Google searches have local intent. If a business isn't visible in local search, it's invisible to nearly half of potential customers.",
    "88% of consumers trust online reviews as much as personal recommendations. Review quantity and quality directly impact revenue.",
    "The average local business loses 20-35% of potential revenue to digital gaps — most without realizing it.",
    "Businesses that respond to reviews (positive and negative) see 12% higher conversion from search to contact.",
    "Mobile page speed under 3 seconds is the threshold — every second beyond that loses 7% of visitors.",
    "A Google Business Profile with 100+ photos gets 520% more direction requests and 1,065% more website clicks than average.",
  ],
};
