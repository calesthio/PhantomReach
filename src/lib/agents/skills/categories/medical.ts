import type { CategorySkill } from "../types";

export const medicalSkill: CategorySkill = {
  id: "medical",
  name: "Medical & Healthcare",
  category_patterns: [
    "doctor", "physician", "clinic", "medical_office", "urgent_care",
    "family_medicine", "general_practitioner", "specialist", "cardiologist",
    "dermatologist", "pediatrician", "ob_gyn", "healthcare",
  ],

  review_intelligence: {
    critical_signals: [
      "Wait time mentions — 'reasonable wait' vs 'waited 2 hours for 10 min appointment'",
      "Doctor communication style — 'listened to me' vs 'rushed through'",
      "Appointment availability — 'got in quickly' vs 'earliest appointment 3 months out'",
      "Office cleanliness — critical for healthcare (explicit or implicit)",
      "Front desk professionalism — heavily influences perception",
      "Insurance handling — 'dealt with insurance smoothly' vs 'billing nightmare'",
      "Treatment explanation — 'doctor explained everything' vs 'left confused'",
      "Nursing staff — separate perception from doctor",
    ],
    positive_indicators: [
      "Specific doctor name praise with communication details",
      "Appointment availability ease",
      "Long-term patient relationship language",
      "Thoroughness mentions",
    ],
    negative_indicators: [
      "Cleanliness concerns (implied or stated)",
      "Feeling rushed or unheard",
      "Billing/insurance confusion",
      "Staff rudeness",
    ],
    customer_decision_factors: [
      "Can I get an appointment this month?",
      "Do they accept my insurance?",
      "What's the doctor's communication style?",
      "Is the office clean and modern?",
      "Will they explain my condition thoroughly?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Insurance accepted list",
      "Appointment booking link",
      "Doctor profiles with credentials",
      "Patient portal information",
      "After-hours care information",
    ],
    photo_expectations: [
      "Doctor/provider photos (professional headshots)",
      "Office/waiting room photos (cleanliness visible)",
      "No stock photos",
    ],
    category_features: [
      "Q&A for common questions",
      "Services/specialties listed",
      "Online forms availability",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Online appointment booking (critical for healthcare)",
      "Insurance accepted list",
      "Provider profiles with credentials and specialty",
      "New patient information/forms",
      "Patient portal access",
      "Telehealth offering if applicable",
    ],
    trust_signals: [
      "Board certification displayed",
      "Hospital affiliations",
      "Medical education background",
      "Patient testimonials (video preferred)",
      "Award/recognition badges",
    ],
    friction_points: [
      "No online appointment booking",
      "Insurance information vague or absent",
      "No provider profiles",
      "Slow load time (mobile healthcare searches are often urgent)",
      "No new patient information",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "Electronic health records (Epic, Cerner, Athena)",
      "Online appointment scheduling (Zocdoc, Acuity, Epic-integrated)",
      "Patient portal",
      "Telehealth capability",
      "Automated appointment reminders (text/email)",
    ],
    critical_gaps: [
      "No online scheduling = lost modern patients",
      "No patient portal = communication friction",
      "No telehealth = losing convenience-seeking patients",
      "No appointment reminders = high no-show rate",
    ],
    maturity_baseline: "Healthcare practices should score 60+ on digital maturity. Below 40 indicates outdated patient experience.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Google Business Profile", why: "90%+ of healthcare searches start on Google/Maps." },
      { platform: "Healthgrades", why: "Medical-specific review platform with high intent." },
      { platform: "Facebook", why: "Community health education and patient engagement." },
      { platform: "Zocdoc", why: "Primary booking platform for specialty care." },
    ],
    content_expectations: [
      "Health education content",
      "Condition/treatment explanations",
      "Preventive care information",
      "Office/team updates",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Appointment availability (new patient wait time)",
      "Telehealth availability",
      "Insurance network breadth",
      "Provider credentials and training",
      "Patient communication style",
    ],
    key_comparison_metrics: [
      "Google rating + review count + recency",
      "Healthgrades rating and review count",
      "Online booking availability",
      "Insurance accepted count",
      "Response rate to reviews",
    ],
    blind_spots: [
      "Not considering Healthgrades presence",
      "Ignoring patient portal quality",
      "Overlooking telehealth as differentiator",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "$2,000-$5,000/year for active patient (visits + referrals)",
    digital_revenue_drivers: [
      "Google visibility → new patient discovery",
      "Online booking → conversion rate uplift (40%+ of patients prefer online)",
      "Appointment reminders → reduced no-shows (30% reduction)",
      "Telehealth offering → patient retention uplift",
      "Review volume + rating → trust threshold",
    ],
    leakage_patterns: [
      "No online booking = losing digitally-native patients",
      "Outdated GBP information = patients call to confirm hours/insurance",
      "Low review count = invisible in local pack",
      "No telehealth in 2026 = losing patients to competitors offering it",
      "No appointment reminders = 20-30% no-show rate",
    ],
  },

  insider_knowledge: [
    "Healthcare patients check 2.8 sources before choosing. Presence on Google and Healthgrades is critical.",
    "New patient acquisition in healthcare is 3x more expensive than retention through patient portals.",
    "Telehealth availability is now a core expectation for under-40 patients and a retention factor.",
    "Appointment no-show rate average is 25%. Every percentage point reduction = 2-4 more patients monthly.",
  ],
};
