import type { CategorySkill } from "../types";

export const homeServicesSkill: CategorySkill = {
  id: "home-services",
  name: "Home Services & Contractors",
  category_patterns: [
    "plumber", "electrician", "hvac", "roofer", "painter", "carpenter",
    "general_contractor", "home_repair", "home_improvement", "construction",
    "handyman", "chimney_sweep", "gutter_cleaning", "landscaping", "tree_service",
    "pest_control", "home_maintenance", "cleaning_service", "power_washing",
  ],

  review_intelligence: {
    critical_signals: [
      "Initial estimate vs final bill complaints — the #1 trust destroyer in home services",
      "Timeline adherence — 'finished on time' vs 'dragged on for weeks'",
      "Cleanup quality — minor signal that indicates professionalism/respect",
      "Warranty mentions — 'guaranteed the work' vs 'no warranty offered'",
      "Communication about problems — did they explain issues or hide them?",
      "Licensing/insurance mentions — indicates professional vs DIY operation",
      "Repeat business signals — 'have them back every year' = trusted relationship",
      "Job quality language — 'looks professional' vs 'looks DIY'",
    ],
    positive_indicators: [
      "Specific problem-solving details (not vague 'great service')",
      "Punctuality mentions",
      "Respects home/belongings language",
      "Clear communication about work performed",
    ],
    negative_indicators: [
      "Price increases mid-project without agreement",
      "Abandonment or unfinished work complaints",
      "Damage or lack of care for customer's home",
      "Licensing/insurance concerns",
    ],
    customer_decision_factors: [
      "Are they licensed and insured?",
      "Can I get a free estimate?",
      "How quickly can they start?",
      "What's the warranty on the work?",
      "Will they communicate if issues arise?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Service area clearly defined (contractors have geographic bounds)",
      "Before/after photos (critical for visual work)",
      "Licensing/insurance displayed",
      "Warranty information",
      "Service categories listed (plumbing + electrical vs just plumbing)",
    ],
    photo_expectations: [
      "Before/after project photos (2-3 complete examples minimum)",
      "Team/technician photos (builds trust for in-home work)",
      "Truck/vehicle with company branding (mobile billboard)",
      "Warehouse/office if applicable",
    ],
    category_features: [
      "Q&A for common questions (timeline, pricing, warranty)",
      "Google Posts for seasonal services",
      "Services section mapped to what they actually offer",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Service area map (ZIP code or radius)",
      "Licensing/insurance verification visible",
      "Before/after portfolio (at least 6 projects)",
      "Free estimate request form (lowest friction)",
      "Testimonials with customer names/photos",
      "Warranty information",
    ],
    trust_signals: [
      "License and bond information with verification links",
      "Years in business / family-owned status",
      "Professional associations (BBB, local chamber)",
      "Detailed project case studies",
      "Video testimonials from customers",
    ],
    friction_points: [
      "No service area information",
      "No way to request estimate (phone only kills conversion)",
      "No before/after portfolio",
      "No licensing/insurance displayed",
      "Outdated photos",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "Online quote/estimate tool (ServiceTitan, Jobber, Housecall Pro)",
      "Before/after portfolio software",
      "Customer review management (Google, Yelp, Thumbtack)",
      "Email follow-up automation",
      "Scheduling software (Calendly or integrated)",
    ],
    critical_gaps: [
      "No online estimate request = losing 40% of DIY-conscious homeowners",
      "No portfolio online = can't sell past work",
      "No review management = won't rank in local search",
    ],
    maturity_baseline: "Home service businesses should score 45+ on digital maturity. Under 30 indicates phone-only acquisition.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Before/After Portfolio (Website)", why: "The single most important asset — shows competence directly." },
      { platform: "Google Business Profile", why: "Drives 60%+ of discovery for local contractors." },
      { platform: "Nextdoor", why: "Hyper-local referral network. Homeowners actively ask for contractor recommendations." },
      { platform: "Facebook", why: "Community presence, testimonials, seasonal campaigns." },
      { platform: "Instagram", why: "Visual transformation content performs well, especially for cosmetic work." },
    ],
    content_expectations: [
      "Project before/after photos",
      "Time-lapse videos of projects",
      "Educational content (how to maintain X, signs you need work)",
      "Team/crew introductions",
      "Seasonal service promotions",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Responsiveness (how fast they return calls/messages)",
      "Service area coverage",
      "Pricing transparency (estimates in 24 hours)",
      "Warranty offerings",
      "Speed of service (emergency calls answered 24/7)",
    ],
    key_comparison_metrics: [
      "Google rating + review count + response rate",
      "Portfolio quality and quantity",
      "License verification and insurance",
      "Online estimate availability",
      "Service area vs customer location",
    ],
    blind_spots: [
      "Not considering competitor licensing status",
      "Ignoring Nextdoor presence in homeowner-dense markets",
      "Oversimplifying price comparisons (cheap ≠ competitive, quality varies)",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "$2,000-$8,000/year for ongoing maintenance relationships",
    digital_revenue_drivers: [
      "Google Maps discovery → emergency calls (70% of 'urgent need' searches start with Google)",
      "Online estimate request → qualified lead capture",
      "Before/after portfolio → decision confidence",
      "Review volume/rating → price tolerance (high-rated can charge premium)",
      "Email/SMS follow-up → repeat business from past customers",
    ],
    leakage_patterns: [
      "No online estimate = losing time-sensitive customers who pick up phone to next contractor",
      "Low review count = losing price comparison negotiation power",
      "No portfolio = can't differentiate quality vs competitor",
      "Service area not defined = customers call not knowing if contractor covers them",
      "No follow-up system = one-time customers never become repeat business",
    ],
  },

  insider_knowledge: [
    "The biggest predictor of success for contractors is responsiveness. First contractor to answer usually gets the job.",
    "Before/after photos are worth more than 100 testimonials. Homeowners buy with their eyes.",
    "Contractors with transparent pricing upfront (online estimates) close 35% higher than phone-only quotes.",
    "Nextdoor is the #2 source of contractor leads in suburban America but is ignored by 80% of contractors.",
    "Email list of past customers is worth $15-30 per contact. Regular maintenance campaigns drive 20-30% of annual revenue.",
  ],
};
