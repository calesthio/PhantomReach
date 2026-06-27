import type { CategorySkill } from "../types";

export const restaurantSkill: CategorySkill = {
  id: "restaurant",
  name: "Restaurant & Food Service",
  category_patterns: [
    "restaurant", "cafe", "coffee_shop", "bakery", "bar", "pizza",
    "sushi", "mexican_restaurant", "italian_restaurant", "chinese_restaurant",
    "thai_restaurant", "indian_restaurant", "fast_food", "diner", "bistro",
    "food_truck", "catering", "deli", "ice_cream", "juice_bar", "brewery",
    "winery", "food", "dining",
  ],

  review_intelligence: {
    critical_signals: [
      "Food safety mentions (hair, bugs, undercooked, cold food) — even one is a red flag",
      "Wait time patterns — distinguish between 'worth the wait' positive and 'walked out' negative",
      "Delivery/takeout experience vs dine-in — these are functionally different businesses",
      "Server name mentions — high name-mention rate indicates strong service culture",
      "Parking and accessibility complaints — invisible revenue killer",
      "Portion size and value perception — 'expensive' vs 'overpriced' are different signals",
      "Birthday/anniversary/event mentions — indicates or lacks special occasion positioning",
      "Menu change reactions — 'they changed the recipe' complaints indicate identity risk",
    ],
    positive_indicators: [
      "Repeat visit language ('we come here every week', 'our go-to spot')",
      "Specific dish mentions (indicates memorable signature items)",
      "Atmosphere/vibe praise (indicates experiential differentiation)",
      "Staff name mentions (indicates relationship-driven loyalty)",
    ],
    negative_indicators: [
      "Health code language even if vague ('not clean', 'questionable hygiene')",
      "Declining quality over time ('used to be great', 'not what it was')",
      "Management response hostility (defensive owner responses are a business risk)",
      "Inconsistency signals ('hit or miss', 'depends on who\\'s cooking')",
    ],
    customer_decision_factors: [
      "What's the vibe — date night, family, quick lunch, or late night?",
      "Can I see the menu and prices before I go?",
      "Can I order online / make a reservation without calling?",
      "What do people say about the signature dishes?",
      "Is parking going to be a problem?",
    ],
  },

  gbp_priorities: {
    critical_attributes: [
      "Menu link (critical — #1 reason people check GBP for restaurants)",
      "Online ordering link (direct revenue driver)",
      "Reservation link (reduce friction for high-intent customers)",
      "Hours accuracy (especially weekend and holiday hours — wrong hours = lost customers)",
      "Price level attribute ($$, $$$) — helps Google match search intent",
      "Dine-in / takeout / delivery flags",
      "Popular times data accuracy",
    ],
    photo_expectations: [
      "Food photos (minimum 10, professionally lit — these are the #1 conversion driver)",
      "Interior/ambiance photos (sets expectations, reduces anxiety)",
      "Exterior photo (helps people find you — 'oh that place')",
      "Menu board photos (readable, current)",
      "Team/chef photos (humanizes the brand)",
    ],
    category_features: [
      "Q&A section — unanswered 'do you have vegan options?' type questions are lost customers",
      "Posts — weekly specials, events, seasonal menus",
      "Products/menu section completeness",
    ],
  },

  website_conversion: {
    must_have_elements: [
      "Menu (with prices) — accessible without PDF download on mobile",
      "Online ordering integration (DoorDash, UberEats, Toast, Square Online, or direct)",
      "Reservation widget (OpenTable, Resy, Yelp Reservations, or direct)",
      "Location with embedded Google Map",
      "Phone number clickable on mobile (click-to-call)",
      "Hours displayed prominently (not buried in footer)",
    ],
    trust_signals: [
      "Health department rating/certificate",
      "Award badges (Michelin, James Beard, local 'Best Of')",
      "Press mentions",
      "Chef/owner story",
      "Sourcing story (farm-to-table, local suppliers)",
    ],
    friction_points: [
      "PDF-only menu (disaster on mobile — immediate bounce)",
      "No online ordering when competitors have it",
      "Outdated seasonal menu still showing",
      "No way to book for large parties",
      "Flash/JavaScript-heavy site that fails on slow mobile connections",
    ],
  },

  tech_expectations: {
    expected_tools: [
      "POS system (Toast, Square, Clover, Lightspeed)",
      "Online ordering (Toast Online, ChowNow, direct integration)",
      "Reservation system (OpenTable, Resy, Yelp)",
      "Loyalty/rewards program (Thanx, FiveStars, built-in POS loyalty)",
      "Email marketing (Mailchimp, Constant Contact — for specials, events)",
      "Social scheduling (Later, Hootsuite — for food photography posts)",
      "Review management (Birdeye, Podium — for response automation)",
    ],
    critical_gaps: [
      "No online ordering in 2026 = leaving 30-40% of potential revenue on the table",
      "No reservation system for sit-down restaurants = phone-only friction",
      "No Google Analytics = flying blind on which marketing drives covers",
      "No email capture = no way to drive repeat visits during slow periods",
    ],
    maturity_baseline: "A modern restaurant should score 50+ on digital maturity. Below 30 indicates a pre-2020 digital presence that is actively losing customers to competitors.",
  },

  social_priorities: {
    platform_ranking: [
      { platform: "Instagram", why: "Food is visual — Instagram is the #1 discovery platform for restaurants. Missing = invisible to under-40 diners." },
      { platform: "TikTok", why: "Viral food content drives massive foot traffic. One video can change a restaurant's trajectory." },
      { platform: "Facebook", why: "Events, community groups, older demographic reach. Important for family restaurants." },
      { platform: "Yelp", why: "Still a primary decision engine for restaurants. Claimed profile with photos is baseline." },
      { platform: "Google Posts", why: "Weekly specials and events directly in search results. Free impressions." },
    ],
    content_expectations: [
      "Food photography (well-lit, appetizing — phone photos are fine if good)",
      "Behind-the-scenes kitchen content (builds authenticity)",
      "Chef/team spotlights (humanizes the brand)",
      "Seasonal menu announcements",
      "User-generated content reposts (social proof at scale)",
    ],
  },

  competitive_lens: {
    real_differentiators: [
      "Cuisine uniqueness (are they the only Ethiopian restaurant in town, or one of 50 pizza places?)",
      "Price positioning (budget, mid-range, fine dining — right audience for right message)",
      "Experience positioning (quick service, casual dining, special occasion)",
      "Signature items (what do reviewers specifically recommend?)",
      "Location advantage/disadvantage (foot traffic, parking, visibility)",
    ],
    key_comparison_metrics: [
      "Google rating + review count (the two numbers that determine local pack ranking)",
      "Online ordering availability (direct revenue comparison)",
      "Instagram follower count and posting frequency",
      "Menu accessibility (online, readable, priced)",
      "Review response rate and quality",
    ],
    blind_spots: [
      "Comparing against the wrong competitors (a $15 lunch spot shouldn't benchmark against fine dining)",
      "Ignoring delivery platform ratings (DoorDash/UberEats ratings are separate from Google)",
      "Not considering time-of-day competition (breakfast competitors are different from dinner competitors)",
    ],
  },

  revenue_context: {
    avg_customer_ltv: "$1,200-$3,600/year for a regular diner visiting 2-4x/month at $25-$75 avg ticket",
    digital_revenue_drivers: [
      "Google Maps visibility → foot traffic (40-60% of restaurant discovery happens via Maps)",
      "Online ordering → incremental revenue (not cannibalization — these are additional orders)",
      "Reservation system → reduced no-shows, optimized table turns",
      "Email marketing → fills slow nights (Tuesday email blast → 15-20% of subscribers act)",
      "Instagram presence → under-35 discovery funnel (they check Instagram before Google)",
    ],
    leakage_patterns: [
      "No online ordering when competitors have it → losing $2,000-$8,000/month in delivery/takeout revenue",
      "Poor Google rating (<4.0) → suppressed in local pack → invisible to 70% of searchers",
      "No reservation system → phone-only booking → losing impatient customers to OpenTable-enabled competitors",
      "Outdated/missing menu online → bounce rate 60%+ → losing research-phase customers",
      "No email list → no way to drive traffic during slow periods → empty Tuesday nights",
    ],
  },

  insider_knowledge: [
    "Restaurants with 4.2-4.5 stars actually convert better than 5.0 — perfect ratings look fake.",
    "The single biggest predictor of restaurant survival is not food quality, it's online ordering adoption since 2020.",
    "A restaurant that responds to negative reviews within 24 hours retains 70% of unhappy customers. No response = they tell 9 friends.",
    "Photo count on GBP is a direct ranking factor. Restaurants with 50+ photos get 520% more direction requests than those with fewer than 10.",
    "The 'popular times' graph on GBP directly influences consumer behavior — inaccurate data actively steers customers away during actual slow periods.",
    "Restaurants that post weekly Google Business updates see 7x more engagement on their profile.",
    "A mobile-unfriendly menu is the #1 reason for website bounce in the restaurant category — worse than slow load time.",
  ],
};
