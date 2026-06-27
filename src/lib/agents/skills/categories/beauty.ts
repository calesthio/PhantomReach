import type { CategorySkill } from "../types";

export const beautySkill: CategorySkill = {
  id: "beauty",
  name: "Beauty & Personal Care",
  category_patterns: [
    "salon", "hair_salon", "barber", "nail_salon", "spa", "waxing",
    "makeup", "eyebrow", "massage", "tattoo", "piercing", "beauty",
    "hairdresser", "stylist", "esthetician",
  ],

  review_intelligence: {
    critical_signals: [
      "Stylist name consistency — same stylist vs rotating = loyalty signal",
      "Result satisfaction language — 'exactly what I asked for' vs 'not what I wanted'",
      "Wait time patterns — 'walk-ins always accepted' vs 'book 6 weeks ahead'",
      "Hygiene mentions — critical in close-contact services",
      "Pressure to upsell — 'didn't push extra services' vs 'aggressive upsell'",
      "Price fairness — 'fair for quality' vs 'overpriced'",
      "Appointment reliability — 'always on time' vs 'started 30 mins late'",
      "Ambiance/vibe — 'relaxing atmosphere' critical for this category",
    ],
    positive_indicators: [
      "Specific stylist name mentions with result details",
      "Ambiance/vibe praise",
      "Appointment ease language",
      "Price fairness acknowledgment",
    ],
    negative_indicators: [
      "Bad result language",
      "Hygiene concerns",
      "Stylist personality complaints",
      "Long wait time frustration",
    ],
    customer_decision_factors: [
      "Can I book with the stylist I want?",
      "What's the wait time for new clients?",
      "What's the price range?",
      "What's the vibe/atmosphere like?",
      "Do they have before/after photos?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Stylist/provider list",
      "Services with pricing visible",
      "Appointment booking link (critical)",
      "Walk-in policy if applicable",
      "Online booking for specific stylist",
    ],
    photo_expectations: [
      "Before/after hair/nails/beauty work (minimum 10)",
      "Salon interior/ambiance photos",
      "Team/stylist photos",
      "Product photos",
    ],
    category_features: [
      "Q&A for common service questions",
      "Stylist bios with specialties",
      "Online booking by stylist",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Online appointment booking by stylist (critical)",
      "Before/after gallery (minimum 15 photos)",
      "Stylist profiles with specialties",
      "Service menu with prices",
      "Availability calendar",
      "New client information",
    ],
    trust_signals: [
      "Stylist credentials/certifications",
      "Years of experience",
      "Specialization (color specialist, braiding expert)",
      "Product brands used",
      "Client transformation gallery",
    ],
    friction_points: [
      "No online booking (phone-only kills conversion)",
      "No stylist selection (want specific person)",
      "Limited before/after photos",
      "No pricing visible",
      "Outdated photos",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "Appointment booking by stylist (Acuity, Mindbody, Vagaro, Booker)",
      "Payment processing (integrated with booking)",
      "Client profile/history",
      "Loyalty/rewards program (critical in beauty)",
      "SMS/email appointment reminders",
    ],
    critical_gaps: [
      "No online booking = losing 50%+ of potential clients",
      "No stylist selection = can't build loyalty",
      "No loyalty program = no repeat customer incentive",
      "No appointment reminders = 25-30% no-show rate",
    ],
    maturity_baseline: "Beauty businesses should score 60+ on digital maturity. Under 35 indicates phone-only operations.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Instagram", why: "Visual transformations. Instagram IS the marketing channel for beauty." },
      { platform: "TikTok", why: "Viral hair/beauty content drives walk-ins." },
      { platform: "Facebook", why: "Local community reach and events." },
      { platform: "Google Business Profile", why: "Local search + Google Photos portfolio." },
    ],
    content_expectations: [
      "Before/after transformations",
      "Tutorial content (how to style, product tips)",
      "Stylist spotlights",
      "New product/service announcements",
      "Trend content",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Specific stylist skill (color specialist, cutting expertise)",
      "Appointment availability",
      "Service range (hair only vs hair+nails+makeup)",
      "Ambiance/experience positioning",
      "Product quality/brands used",
    ],
    key_comparison_metrics: [
      "Google rating + review count + recency",
      "Instagram follower count and engagement",
      "Before/after portfolio quality",
      "Online booking availability",
      "Pricing competitiveness",
    ],
    blind_spots: [
      "Ignoring Instagram presence (huge for beauty)",
      "Not considering stylist tenure/turnover",
      "Overlooking ambiance as differentiator",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "$1,500-$4,000/year for active salon client (monthly+ visits)",
    digital_revenue_drivers: [
      "Instagram discovery → impulse walk-ins",
      "Online booking availability → conversion 25-40% higher",
      "Stylist profiles → loyalty and specific request booking",
      "Before/after portfolio → client confidence",
      "SMS loyalty program → repeat visit rate uplift",
    ],
    leakage_patterns: [
      "No Instagram presence = invisible to under-35 demographic",
      "No online booking = losing phone-resistant clients",
      "No stylist selection = can't build stylist loyalty (biggest churn driver)",
      "No loyalty program = losing repeat customer incentive",
      "No appointment reminders = high no-show rate",
    ],
  },

  insider_knowledge: [
    "The #1 reason beauty clients switch is stylist availability, not price or quality.",
    "Salons with strong Instagram presence get 2-3x more walk-in traffic.",
    "Online booking increases no-show rate reduction by 35-40% because clients are less likely to cancel online.",
    "Loyalty programs in beauty drive 40-50% of repeat business.",
  ],
};
