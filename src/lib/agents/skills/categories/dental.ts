import type { CategorySkill } from "../types";

export const dentalSkill: CategorySkill = {
  id: "dental",
  name: "Dental & Orthodontics",
  category_patterns: [
    "dentist", "dental", "orthodontist", "oral_surgeon", "endodontist",
    "periodontist", "pediatric_dentist", "cosmetic_dentist", "dental_clinic",
    "dental_implant", "teeth_whitening", "invisalign", "braces",
  ],

  review_intelligence: {
    critical_signals: [
      "Dental anxiety mentions ('gentle', 'painless', 'scared') — anxiety management is the #1 differentiator",
      "Insurance/billing complaints — even 1-2 billing complaints destroy trust in healthcare",
      "Appointment availability — 'couldn't get in for 3 weeks' signals capacity issues",
      "Staff continuity — 'same hygienist for years' = retention, 'new staff every time' = turnover",
      "Emergency availability — 'fit me in same day' vs 'couldn't get anyone to answer'",
      "Procedure-specific feedback — indicates service line strengths/weaknesses",
      "Children/family mentions — indicates family-friendly positioning",
      "Front desk experience — heavily influences dental decisions",
    ],
    positive_indicators: [
      "Anxiety relief language ('I actually don't mind going to the dentist now')",
      "Long-term relationship mentions ('been coming here for 10 years')",
      "Referral language ('sent my whole family here')",
      "Specific doctor name praise with procedure context",
    ],
    negative_indicators: [
      "Unexpected cost after treatment ('said it was covered then got a bill')",
      "Pressure to upsell ('tried to sell me veneers when I came for a cleaning')",
      "Pain dismissal ('told me it was normal when it clearly wasn't')",
      "Communication gaps between provider and front desk",
    ],
    customer_decision_factors: [
      "Do they accept my insurance?",
      "Can I get an appointment this week for an emergency?",
      "Are they good with anxious patients / dental phobia?",
      "What's the office like — modern or dated?",
      "Do they offer sedation options?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Insurance accepted list (the single most searched attribute for dental)",
      "Emergency/same-day availability flag",
      "Services list (cleanings, implants, cosmetic, ortho, pediatric)",
      "Languages spoken (critical in diverse markets)",
      "Appointment booking link (reduce phone friction)",
      "New patient specials/offers",
    ],
    photo_expectations: [
      "Modern, clean office interior (#1 trust signal — patients judge quality by lobby)",
      "Treatment rooms (modern equipment = trust, old equipment = fear)",
      "Team photos (builds familiarity before the visit)",
      "Before/after cosmetic results (powerful conversion tool)",
      "Exterior with clear signage (wayfinding)",
    ],
    category_features: [
      "Services/products section fully populated with all service lines",
      "Q&A section — unanswered insurance questions are lost patients",
      "Google Posts — new patient specials, technology announcements",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Online appointment scheduling (Zocdoc, LocalMed, or custom)",
      "Insurance accepted page (comprehensive, searchable)",
      "New patient forms downloadable or online fillable",
      "Service pages for each major service line (not just a bullet list)",
      "Doctor bio pages with credentials, photo, personal touch",
      "Emergency contact/after-hours instructions",
      "Patient testimonials (video is 10x more effective for dental)",
    ],
    trust_signals: [
      "Board certifications and credentials displayed",
      "Professional association memberships (ADA, state dental association)",
      "Technology highlights (digital X-rays, same-day crowns, laser dentistry)",
      "Continuing education / specialization mentions",
      "Years in practice / community involvement",
    ],
    friction_points: [
      "No online scheduling (highest-demand category for online booking)",
      "Insurance page that just says 'we accept most insurance — call to verify'",
      "No new patient forms online (means paperwork in office = barrier)",
      "Generic stock photos instead of actual office/team",
      "No pricing transparency or financing options visible",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "Practice management (Dentrix, Eaglesoft, Open Dental)",
      "Online scheduling (Zocdoc, LocalMed, or PMS-integrated)",
      "Patient communication (Weave, RevenueWell, Lighthouse 360)",
      "Review generation (Birdeye, Podium, NexHealth)",
      "Digital forms (Jotform, IntakeQ, or PMS-integrated)",
      "Payment processing with financing (CareCredit, Sunbit, Cherry)",
    ],
    critical_gaps: [
      "No online scheduling = losing 25-40% of new patient inquiries",
      "No patient communication platform = high no-show rate",
      "No review generation tool = competitor with 500 reviews always wins",
      "No financing option displayed = losing cosmetic and implant cases",
    ],
    maturity_baseline: "A modern dental practice should score 55+ on digital maturity. Below 35 indicates reliance on referral-only patient acquisition.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Instagram", why: "Before/after transformations, office culture, team spotlights — visual trust-building." },
      { platform: "Facebook", why: "Community engagement, patient education, family audience reach." },
      { platform: "TikTok", why: "Dental education content goes viral. Reaches younger patients." },
      { platform: "YouTube", why: "Procedure explainers reduce anxiety. Long-tail SEO value." },
      { platform: "Google Posts", why: "New patient offers directly in search results." },
    ],
    content_expectations: [
      "Before/after cosmetic cases (with consent)",
      "Office tour / technology showcase",
      "Team introductions and behind-the-scenes",
      "Patient education (flossing tips, when to see a dentist)",
      "Community involvement",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Insurance network breadth",
      "Appointment availability (new patient wait time)",
      "Technology adoption (digital X-rays, same-day crowns, 3D imaging)",
      "Sedation options (differentiator for anxious patients)",
      "Specialty services in-house (ortho + general under one roof)",
    ],
    key_comparison_metrics: [
      "Google rating + review count + review recency",
      "Insurance accepted count",
      "Online booking availability",
      "New patient offer quality",
      "Response rate to reviews",
    ],
    blind_spots: [
      "Comparing a general dentist against a cosmetic specialist",
      "Ignoring Zocdoc/Healthgrades presence",
      "Not considering practice age and referral networks",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "$3,000-$8,000/year for an active patient (2 cleanings + occasional procedures + referrals)",
    digital_revenue_drivers: [
      "Google Maps visibility → new patient calls (65% of new dental acquisition starts with local search)",
      "Online scheduling → conversion rate uplift (30-50% prefer online booking)",
      "Review volume + rating → trust threshold (won't consider below 4.2 stars or under 50 reviews)",
      "Financing visibility → case acceptance (CareCredit/Sunbit increases cosmetic acceptance 40%+)",
      "Patient communication automation → reduced no-shows (25-35% reduction)",
    ],
    leakage_patterns: [
      "No online scheduling → losing 5-15 new patients/month → $15,000-$120,000/year",
      "Low review count (<50) when competitors have 200+ → invisible in local pack",
      "No insurance page or vague info → patients call, get voicemail, call next practice",
      "No financing options → losing $5,000-$15,000 cosmetic/implant cases",
      "Not on Zocdoc in dominant markets → missing entire acquisition channel",
    ],
  },

  insider_knowledge: [
    "The average dental practice loses $150,000-$250,000/year from no-shows. Automated communication tools cut this by 30%.",
    "Dental patients check 3.2 sources before choosing. Invisible on any one = lost patient.",
    "The #1 reason patients leave is scheduling difficulty, not clinical quality.",
    "Practices that respond to Google reviews see 15-20% higher conversion from Maps to appointments.",
    "A dental GBP with 50+ photos gets 3x more direction requests. Patients judge clinical quality by lobby appearance.",
    "Same-day crowns (CEREC) on website and GBP is one of the strongest conversion signals in dental.",
  ],
};
