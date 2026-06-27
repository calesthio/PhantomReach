import type { CategorySkill } from "../types";

export const legalSkill: CategorySkill = {
  id: "legal",
  name: "Legal Services & Law Firms",
  category_patterns: [
    "attorney", "lawyer", "law_firm", "legal_service", "law_office",
    "criminal_attorney", "family_law", "immigration_lawyer", "bankruptcy",
    "personal_injury", "divorce_attorney", "business_attorney",
  ],

  review_intelligence: {
    critical_signals: [
      "Case outcome mentions — 'won my case' vs 'settled for less than expected'",
      "Communication frequency — 'kept me updated' vs 'ghosted between meetings'",
      "Fee transparency — 'clear about costs upfront' vs 'surprise bills'",
      "Timeframe mentions — 'efficient process' vs 'dragged out for years'",
      "Responsiveness — 'returned calls same day' vs 'took weeks to hear back'",
      "Expertise confidence — 'very knowledgeable' vs 'seemed unsure'",
      "Emotional support — 'made me feel heard' vs 'treated like a number'",
      "Ethics/integrity — critical for legal, any doubt is a red flag",
    ],
    positive_indicators: [
      "Specific case handling language",
      "Communication responsiveness praise",
      "Fee fairness acknowledgment",
      "Referral language to others",
    ],
    negative_indicators: [
      "Malpractice concerns (even vague)",
      "Communication breakdown",
      "Billing surprise language",
      "Lack of case progress",
    ],
    customer_decision_factors: [
      "Have they handled cases like mine before?",
      "What's your fee structure?",
      "How often will I hear from you?",
      "What's your track record?",
      "Do I feel confident in your expertise?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Practice areas listed clearly",
      "Attorney profiles with credentials/experience",
      "Fee information or consultation offer",
      "Consultations appointment booking",
      "Bar certification/standing",
    ],
    photo_expectations: [
      "Attorney/team professional photos",
      "Office photos (professional appearance matters)",
      "No stock photos (authenticity critical in legal)",
    ],
    category_features: [
      "Q&A for common case questions",
      "Case results/testimonials",
      "Practice area descriptions",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Attorney profiles with credentials, Bar number, experience",
      "Practice area pages (separate pages for each key area)",
      "Free consultation offer/booking",
      "Fee structure explanation",
      "Case results (HIPAA-compliant)",
      "Client testimonials (critical trust signal)",
    ],
    trust_signals: [
      "State bar certification visible",
      "Specific practice area depth",
      "Years of experience",
      "Notable case results",
      "Professional association memberships (ABA, state bar)",
    ],
    friction_points: [
      "No clear way to request free consultation",
      "Generic attorney bios without experience depth",
      "No fee information",
      "No practice area specialization",
      "No testimonials or case results",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "Law practice management (Clio, Practice, MyCase)",
      "Client portal for document sharing",
      "Appointment scheduling (Calendly, law-specific tools)",
      "Online consultation (Zoom, law-specific platforms)",
      "Document automation (Clio, LawGeex)",
    ],
    critical_gaps: [
      "No online consultation scheduling = losing impatient potential clients",
      "No client portal = high friction communication",
      "No practice area information = generic firm = no specialization premium",
    ],
    maturity_baseline: "Legal firms should score 50+ on digital maturity. Below 35 indicates pre-2015 web presence.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Google Business Profile", why: "Primary discovery source for local legal searches." },
      { platform: "LinkedIn", why: "B2B legal referrals and professional network." },
      { platform: "Facebook", why: "Community presence and educational content." },
      { platform: "Avvo/Justia", why: "Legal-specific directories with high domain authority." },
    ],
    content_expectations: [
      "Legal updates and changes",
      "Educational articles on relevant law",
      "Case type explainers",
      "Firm accomplishments and news",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Specialization depth (family law vs general civil)",
      "Specific court/jurisdiction experience",
      "Case result track record",
      "Attorney credentials and background",
      "Communication responsiveness",
    ],
    key_comparison_metrics: [
      "Google rating + review count + recency",
      "Attorney credentials and bar status",
      "Avvo/Justia rating",
      "Consultation availability",
      "Responsiveness (response time to inquiries)",
    ],
    blind_spots: [
      "Comparing big firms to solo practitioners (different markets)",
      "Not considering practice area specificity",
      "Ignoring Avvo which heavily influences legal search",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "$3,000-$50,000+ depending on case type (divorce, immigration, criminal)",
    digital_revenue_drivers: [
      "Google local search visibility → initial consultation calls",
      "Consultation scheduling friction → conversion rate uplift",
      "Review volume + rating → case type differentiation",
      "Avvo/Justia presence → passive lead generation",
      "Email nurture → repeat client cases and referrals",
    ],
    leakage_patterns: [
      "No online consultation scheduling = losing potential clients to competitors with it",
      "Low review count = invisible in local search",
      "No specialization clear = commoditized on price",
      "Not on Avvo/Justia = invisible to legal directory searchers",
      "No follow-up system = referral loop dies",
    ],
  },

  insider_knowledge: [
    "Legal clients check 3+ sources before choosing. Presence on Google, Avvo, and Justia is baseline.",
    "The #1 factor in legal hiring is review recency. Old reviews = concern about current quality.",
    "Attorneys who book free consultations online convert 25% of them to cases vs 5% from voicemail-only.",
    "Practice area specialization is worth 20-30% premium over generalists in the same market.",
  ],
};
