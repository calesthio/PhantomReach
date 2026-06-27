import type { CategorySkill } from "../types";

export const automotiveSkill: CategorySkill = {
  id: "automotive",
  name: "Automotive Service & Repair",
  category_patterns: [
    "auto_repair", "mechanic", "car_repair", "transmission", "brake",
    "tire_shop", "oil_change", "auto_service", "dealership", "car_wash",
    "detail_service", "body_shop", "collision_repair", "used_car_dealer",
  ],

  review_intelligence: {
    critical_signals: [
      "Transparency about work — 'showed me the problem' vs 'just said it needs fixing'",
      "Upsell pressure — 'recommended what I needed' vs 'pushed unnecessary work'",
      "Price accuracy — 'estimate was accurate' vs 'final bill was double'",
      "Timeline adherence — 'finished when promised' vs 'kept car for days'",
      "Quality/durability — 'work still holding up' vs 'same problem returned'",
      "Warranty mentions — 'guarantees their work' vs 'no warranty'",
      "Loaner car/shuttle service — convenience differentiator",
      "Honest repair recommendations — critical for trust",
    ],
    positive_indicators: [
      "Specific repair language with explanation",
      "Quality durability mentions",
      "Honesty language ('didn't need that repair')",
      "Warranty mentions",
    ],
    negative_indicators: [
      "Unnecessary work upsell",
      "Price overrun language",
      "Same problem recurring",
      "Communication about work failures",
    ],
    customer_decision_factors: [
      "Are they honest about what my car needs?",
      "What's the warranty on repairs?",
      "Will you explain the problem and the fix?",
      "Can you give me an accurate estimate?",
      "Do you offer a loaner car?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Services offered clearly listed",
      "Appointment booking availability",
      "Warranty information",
      "Pricing transparency (labor rates, common services)",
      "Loaner/shuttle service info",
    ],
    photo_expectations: [
      "Facility photos (clean, modern = quality signal)",
      "Service bays/equipment photos",
      "Team/technician photos",
      "Before/after (engine, detail work)",
    ],
    category_features: [
      "Q&A for common repair questions",
      "Services with estimated costs",
      "Manufacturer certifications (ASE, Toyota Certified, etc)",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Online appointment booking",
      "Services with pricing information",
      "Warranty information clearly stated",
      "Technician certifications (ASE, manufacturer specific)",
      "Before/after photos of work",
      "Loaner car / shuttle service info",
    ],
    trust_signals: [
      "ASE Certified technicians displayed",
      "Manufacturer certifications (Ford Certified, etc)",
      "Facility photos showing clean, modern equipment",
      "Warranty promises",
      "Years in business",
    ],
    friction_points: [
      "No online appointment booking",
      "No pricing information visible",
      "No warranty mentioned",
      "Outdated facility photos",
      "No technician credentials shown",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "Service management system (Mitchell, Mitchell Pro, Shop Management)",
      "Online appointment booking (Calendly, Mitchell-integrated)",
      "Customer communication (text updates on repair status)",
      "Digital inspection/photo sharing",
      "Financing options (if dealership)",
    ],
    critical_gaps: [
      "No online booking = losing convenience-seeking customers",
      "No status updates = customers anxious about car",
      "No digital estimates = customers don't trust final bill",
      "No financing options = losing sale on bigger repairs",
    ],
    maturity_baseline: "Auto repair shops should score 50+ on digital maturity. Below 30 indicates phone-only operations.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Google Business Profile", why: "90%+ of auto repair searches are local." },
      { platform: "Facebook", why: "Community reach, service specials, equipment updates." },
      { platform: "YouTube", why: "Repair education and facility/team showcases." },
      { platform: "Yelp", why: "Review platform where car owners actively search." },
    ],
    content_expectations: [
      "Maintenance tips and education",
      "Service specials announcements",
      "Before/after repair documentation",
      "Team and facility showcases",
      "New equipment/technology adoption",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Honesty/transparency in recommendations",
      "Convenience (loaner car, quick turnaround)",
      "Warranty on repairs",
      "Technician expertise and certifications",
      "Price fairness",
    ],
    key_comparison_metrics: [
      "Google rating + review count + recency",
      "Labor rate transparency",
      "Appointment availability",
      "Manufacturer certifications",
      "Review sentiment on honesty/pricing",
    ],
    blind_spots: [
      "Not considering technician certification value",
      "Ignoring convenience factors (loaner, turnaround time)",
      "Overlooking warranty as trust signal",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "$2,000-$4,000/year for regular maintenance customer",
    digital_revenue_drivers: [
      "Google Maps visibility → emergency repair discovery",
      "Online booking → appointment conversion 30-40% higher",
      "Transparent pricing → customer trust and larger repair acceptance",
      "Status update communication → customer retention",
      "Warranty visibility → bigger repair acceptance",
    ],
    leakage_patterns: [
      "No online booking = losing time-conscious customers",
      "No pricing visible = customers call competitors to compare",
      "No warranty mentioned = customer anxiety about repair quality",
      "Poor review sentiment on honesty = losing trust-conscious customers",
      "No loaner/shuttle = losing customers with time pressure",
    ],
  },

  insider_knowledge: [
    "Trust is the primary decision factor in auto repair. One price-gouging story kills customer lifetime value.",
    "Transparent labor rates on website increase repair acceptance by 20-30% because customers know they're fair.",
    "Loaner car availability is worth $10-20/customer perceived value but costs the shop $100-200 annually.",
    "Appointment scheduling reduces shop wait room frustration and improves NPS by 15-20 points.",
  ],
};
