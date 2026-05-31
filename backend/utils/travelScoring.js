const TOURISM_TYPES = new Set([
  "tourist_attraction",
  "museum",
  "art_gallery",
  "park",
  "national_park",
  "natural_feature",
  "hiking_area",
  "zoo",
  "aquarium",
  "amusement_park",
  "cultural_landmark",
  "historical_landmark",
  "place_of_worship",
  "shopping_mall",
  "market",
  "point_of_interest"
]);

const BAD_TRAVEL_TYPES = new Set([
  "restaurant",
  "cafe",
  "food",
  "bakery",
  "meal_takeaway",
  "store",
  "supermarket",
  "convenience_store",
  "hair_care",
  "beauty_salon",
  "real_estate_agency",
  "bank",
  "atm",
  "hospital",
  "doctor",
  "dentist",
  "pharmacy",
  "gas_station",
  "car_repair",
  "school",
  "university",
  "lodging",
  "local_government_office"
]);

const CATEGORY_KEYWORDS = {
  nature: ["park", "national_park", "natural_feature", "hiking_area"],
  culture: ["museum", "art_gallery", "cultural_landmark", "historical_landmark", "place_of_worship"],
  family: ["zoo", "aquarium", "amusement_park", "park"],
  shopping: ["shopping_mall", "market"],
  sightseeing: ["tourist_attraction", "point_of_interest", "cultural_landmark", "historical_landmark"],
  food: ["restaurant", "food", "cafe", "bakery"]
};

export function normalizePreferenceTags(raw = "") {
  const text = String(raw).toLowerCase();

  const tags = new Set();

  if (text.includes("自然") || text.includes("風景") || text.includes("戶外") || text.includes("山") || text.includes("海") || text.includes("nature")) {
    tags.add("nature");
  }

  if (text.includes("文化") || text.includes("歷史") || text.includes("古蹟") || text.includes("博物館") || text.includes("美術館") || text.includes("culture") || text.includes("museum")) {
    tags.add("culture");
  }

  if (text.includes("親子") || text.includes("家庭") || text.includes("family") || text.includes("動物園") || text.includes("水族館")) {
    tags.add("family");
  }

  if (text.includes("購物") || text.includes("商圈") || text.includes("市集") || text.includes("shopping")) {
    tags.add("shopping");
  }

  if (text.includes("美食") || text.includes("餐廳") || text.includes("咖啡") || text.includes("food") || text.includes("cafe")) {
    tags.add("food");
  }

  if (text.includes("景點") || text.includes("觀光") || text.includes("熱門") || text.includes("sightseeing")) {
    tags.add("sightseeing");
  }

  if (tags.size === 0) {
    tags.add("sightseeing");
  }

  return [...tags];
}

export function isTravelWorthyPlace(place) {
  const types = place.types || [];
  const rating = Number(place.rating || 0);
  const userRatingCount = Number(place.userRatingCount || 0);
  const name = place.displayName?.text || "";

  const hasTourismType = types.some(type => TOURISM_TYPES.has(type));
  const hasBadType = types.some(type => BAD_TRAVEL_TYPES.has(type));

  const looksLikeRandomFoodPlace =
    hasBadType &&
    !types.includes("tourist_attraction") &&
    !name.includes("夜市") &&
    !name.includes("老街") &&
    !name.includes("商圈");

  if (looksLikeRandomFoodPlace) return false;

  if (!hasTourismType && userRatingCount < 800) return false;

  if (rating < 4.0) return false;

  if (userRatingCount < 80) return false;

  return true;
}

export function calculateTravelScore(place, preferenceTags = []) {
  const types = place.types || [];
  const rating = Number(place.rating || 0);
  const userRatingCount = Number(place.userRatingCount || 0);
  const photos = place.photos || [];

  let score = 40;
  const reasons = [];

  if (rating >= 4.7) {
    score += 20;
    reasons.push("Google 評分很高");
  } else if (rating >= 4.4) {
    score += 15;
    reasons.push("Google 評分不錯");
  } else if (rating >= 4.0) {
    score += 8;
    reasons.push("Google 評分達標");
  }

  if (userRatingCount >= 10000) {
    score += 20;
    reasons.push("評論數非常多，屬於熱門景點");
  } else if (userRatingCount >= 3000) {
    score += 15;
    reasons.push("評論數多，可信度高");
  } else if (userRatingCount >= 500) {
    score += 10;
    reasons.push("有一定人氣");
  } else if (userRatingCount >= 100) {
    score += 5;
    reasons.push("有基本評論數");
  }

  if (types.includes("tourist_attraction")) {
    score += 18;
    reasons.push("Google 標記為觀光景點");
  }

  if (
    types.includes("museum") ||
    types.includes("art_gallery") ||
    types.includes("historical_landmark") ||
    types.includes("cultural_landmark")
  ) {
    score += 12;
    reasons.push("適合文化旅遊");
  }

  if (
    types.includes("park") ||
    types.includes("national_park") ||
    types.includes("natural_feature") ||
    types.includes("hiking_area")
  ) {
    score += 12;
    reasons.push("適合自然戶外旅遊");
  }

  for (const tag of preferenceTags) {
    const targetTypes = CATEGORY_KEYWORDS[tag] || [];

    if (targetTypes.some(type => types.includes(type))) {
      score += 18;
      reasons.push(`符合你的 ${tag} 偏好`);
    }
  }

  if (photos.length >= 3) {
    score += 5;
    reasons.push("圖片資料完整");
  }

  const hasBadType = types.some(type => BAD_TRAVEL_TYPES.has(type));

  if (hasBadType && !preferenceTags.includes("food")) {
    score -= 25;
    reasons.push("較偏一般店家，降低推薦權重");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    score,
    reasons
  };
}

export function buildTravelQueriesFromPreference(profile) {
  const tags = normalizePreferenceTags(profile.interest_tag || "");
  const queries = [];

  for (const tag of tags) {
    if (tag === "nature") {
      queries.push("台灣 必去 自然景點");
      queries.push("台灣 風景區 國家公園");
    }

    if (tag === "culture") {
      queries.push("台灣 必去 博物館 美術館");
      queries.push("台灣 歷史古蹟 文化景點");
    }

    if (tag === "family") {
      queries.push("台灣 親子景點 動物園 水族館 遊樂園");
    }

    if (tag === "shopping") {
      queries.push("台灣 特色商圈 老街 市集");
    }

    if (tag === "food") {
      queries.push("台灣 夜市 老街 美食景點");
    }

    if (tag === "sightseeing") {
      queries.push("台灣 必去 景點");
      queries.push("台灣 熱門 觀光景點");
    }
  }

  return [...new Set(queries)].slice(0, 6);
}