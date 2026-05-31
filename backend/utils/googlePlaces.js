import pool from "../db.js";

/*
  TripTailor Google Places helper
  目標：
  1. 從 Google Places 抓景點
  2. 過濾掉不像旅遊景點的普通店家
  3. 儲存 Google rating / 評論數 / 圖片 / 地址 / 經緯度
  4. 同步 categories
*/

const GOOGLE_TYPE_MAP = {
  // Food / travel food
  restaurant: "Food",
  food: "Food",
  cafe: "Food",
  bakery: "Food",
  meal_takeaway: "Food",
  bar: "Food",
  market: "Shopping",

  // Culture / museums
  museum: "Museums",
  art_gallery: "Museums",
  library: "Museums",
  cultural_landmark: "Culture",
  historical_landmark: "Culture",
  place_of_worship: "Culture",
  temple: "Culture",
  church: "Culture",

  // Nature / outdoor
  park: "Nature",
  national_park: "Nature",
  natural_feature: "Nature",
  beach: "Nature",
  hiking_area: "Nature",
  campground: "Nature",
  tourist_attraction: "Sightseeing",

  // Family / entertainment
  zoo: "Family",
  aquarium: "Family",
  amusement_park: "Entertainment",
  amusement_center: "Entertainment",

  // Shopping / city walk
  shopping_mall: "Shopping",
  store: "Shopping",
  point_of_interest: "Sightseeing"
};

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
  "bar",
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

const TRAVEL_NAME_KEYWORDS = [
  "景點",
  "公園",
  "博物館",
  "美術館",
  "紀念館",
  "文化",
  "文創",
  "古蹟",
  "老街",
  "夜市",
  "商圈",
  "寺",
  "廟",
  "宮",
  "步道",
  "山",
  "海",
  "海岸",
  "瀑布",
  "湖",
  "溫泉",
  "遊樂園",
  "動物園",
  "水族館",
  "觀光",
  "風景",
  "國家公園"
];

export const TAG_QUERY_MAP = {
  nature: "自然景點 風景 公園 海邊 山 步道",
  outdoor: "戶外景點 步道 公園 海邊 山",
  museums: "博物館 美術館 展覽",
  museum: "博物館 美術館 展覽",
  culture: "文化景點 古蹟 歷史建築 文創園區",
  history: "歷史景點 古蹟 老街",
  food: "夜市 老街 美食景點 特色市集",
  cafe: "特色咖啡廳 景觀咖啡廳",
  shopping: "商圈 老街 市集 購物景點",
  family: "親子景點 動物園 水族館 遊樂園",
  entertainment: "遊樂園 娛樂景點",
  sightseeing: "必去景點 熱門景點 觀光景點"
};

export function normalizeInterestTags(raw = "") {
  const text = String(raw).toLowerCase();
  const parts = text.split(/[,，、\s]+/).map(t => t.trim()).filter(Boolean);
  const normalized = new Set();

  for (const tag of parts) {
    if (["自然", "戶外", "風景", "山", "海", "公園", "步道", "nature"].some(k => tag.includes(k))) {
      normalized.add("nature");
    }

    if (["博物館", "美術館", "展覽", "museum", "museums", "art"].some(k => tag.includes(k))) {
      normalized.add("museums");
    }

    if (["文化", "歷史", "古蹟", "寺", "廟", "文創", "culture", "history"].some(k => tag.includes(k))) {
      normalized.add("culture");
    }

    if (["美食", "餐廳", "夜市", "小吃", "food"].some(k => tag.includes(k))) {
      normalized.add("food");
    }

    if (["咖啡", "cafe"].some(k => tag.includes(k))) {
      normalized.add("cafe");
    }

    if (["購物", "商圈", "市集", "老街", "shopping"].some(k => tag.includes(k))) {
      normalized.add("shopping");
    }

    if (["親子", "family", "動物", "zoo", "aquarium", "水族館"].some(k => tag.includes(k))) {
      normalized.add("family");
    }

    if (["娛樂", "遊樂", "entertainment"].some(k => tag.includes(k))) {
      normalized.add("entertainment");
    }

    if (["景點", "觀光", "熱門", "sightseeing"].some(k => tag.includes(k))) {
      normalized.add("sightseeing");
    }
  }

  if (normalized.size === 0) {
    normalized.add("sightseeing");
  }

  return [...normalized];
}

function looksLikeTravelPlace(place) {
  const types = place.types || [];
  const name = place.displayName?.text || "";
  const rating = Number(place.rating || 0);
  const userRatingCount = Number(place.userRatingCount || 0);

  const hasTourismType = types.some(type => TOURISM_TYPES.has(type));
  const hasBadType = types.some(type => BAD_TRAVEL_TYPES.has(type));
  const hasTravelKeyword = TRAVEL_NAME_KEYWORDS.some(keyword => name.includes(keyword));

  const isFoodButTravelRelated =
    hasBadType &&
    (
      name.includes("夜市") ||
      name.includes("老街") ||
      name.includes("市集") ||
      name.includes("商圈") ||
      name.includes("景觀") ||
      name.includes("觀光")
    );

  // rating 太低不要收
  if (rating > 0 && rating < 4.0) return false;

  // 評論數太少，通常不像正式旅遊景點
  if (userRatingCount > 0 && userRatingCount < 50 && !hasTravelKeyword) return false;

  // 普通餐廳、咖啡廳、店家不要收，除非它像夜市/老街/景觀咖啡這種旅遊點
  if (hasBadType && !hasTourismType && !hasTravelKeyword && !isFoodButTravelRelated) {
    return false;
  }

  // 沒有旅遊類型、也沒有旅遊關鍵字，而且評論數不到 800，通常不是旅遊景點
  if (!hasTourismType && !hasTravelKeyword && userRatingCount < 800) {
    return false;
  }

  return true;
}

function calculateGooglePlaceTravelScore(place) {
  const types = place.types || [];
  const rating = Number(place.rating || 0);
  const userRatingCount = Number(place.userRatingCount || 0);
  const photos = place.photos || [];
  const name = place.displayName?.text || "";

  let score = 40;

  if (rating >= 4.7) score += 20;
  else if (rating >= 4.4) score += 15;
  else if (rating >= 4.0) score += 8;

  if (userRatingCount >= 10000) score += 20;
  else if (userRatingCount >= 3000) score += 15;
  else if (userRatingCount >= 500) score += 10;
  else if (userRatingCount >= 100) score += 5;

  if (types.includes("tourist_attraction")) score += 18;

  if (
    types.includes("museum") ||
    types.includes("art_gallery") ||
    types.includes("historical_landmark") ||
    types.includes("cultural_landmark")
  ) {
    score += 12;
  }

  if (
    types.includes("park") ||
    types.includes("national_park") ||
    types.includes("natural_feature") ||
    types.includes("hiking_area")
  ) {
    score += 12;
  }

  if (
    types.includes("zoo") ||
    types.includes("aquarium") ||
    types.includes("amusement_park")
  ) {
    score += 8;
  }

  if (TRAVEL_NAME_KEYWORDS.some(keyword => name.includes(keyword))) {
    score += 10;
  }

  if (photos.length >= 3) score += 5;

  const hasBadType = types.some(type => BAD_TRAVEL_TYPES.has(type));
  const isTravelFoodPlace =
    name.includes("夜市") ||
    name.includes("老街") ||
    name.includes("市集") ||
    name.includes("商圈");

  if (hasBadType && !isTravelFoodPlace) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

async function syncCategories(attId, googleTypes) {
  if (!Array.isArray(googleTypes) || googleTypes.length === 0) {
    await pool.query(`INSERT IGNORE INTO categories (cate_name) VALUES (?)`, ["Sightseeing"]);

    const [[cat]] = await pool.query(
      `SELECT cate_id FROM categories WHERE cate_name = ?`,
      ["Sightseeing"]
    );

    await pool.query(
      `INSERT IGNORE INTO attraction_categories (att_id, cate_id) VALUES (?, ?)`,
      [attId, cat.cate_id]
    );

    return;
  }

  const matched = [...new Set(googleTypes.map(t => GOOGLE_TYPE_MAP[t]).filter(Boolean))];

  if (matched.length === 0) matched.push("Sightseeing");

  for (const cateName of matched) {
    await pool.query(`INSERT IGNORE INTO categories (cate_name) VALUES (?)`, [cateName]);

    const [[cat]] = await pool.query(
      `SELECT cate_id FROM categories WHERE cate_name = ?`,
      [cateName]
    );

    await pool.query(
      `INSERT IGNORE INTO attraction_categories (att_id, cate_id) VALUES (?, ?)`,
      [attId, cat.cate_id]
    );
  }
}

async function recalcAvgRating(attId, googleRating) {
  const [rows] = await pool.query(
    `SELECT COUNT(review_id) AS n, COALESCE(SUM(rating), 0) AS s FROM reviews WHERE att_id = ?`,
    [attId]
  );

  const gr = Number(googleRating) || 0;
  const n = Number(rows[0].n);
  const s = Number(rows[0].s);

  let avg = gr;

  if (gr > 0 && n > 0) {
    avg = (gr * 3 + s) / (3 + n);
  } else if (n > 0) {
    avg = s / n;
  }

  await pool.query(
    `UPDATE attractions SET avg_rating = ? WHERE att_id = ?`,
    [avg.toFixed(1), attId]
  );
}

function getGooglePlacesApiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;

  if (!key) {
    throw new Error("GOOGLE_PLACES_API_KEY is missing in .env");
  }

  return key;
}

function pickBestPhoto(photos = []) {
  if (!Array.isArray(photos) || photos.length === 0) return null;

  const scored = photos
    .filter(p => p?.name)
    .map(p => {
      const w = Number(p.widthPx || 0);
      const h = Number(p.heightPx || 0);
      const area = w * h;
      const isLandscape = w >= h;
      const notTooNarrow = h === 0 || w / h < 2.6;
      const notTooTall = w === 0 || h / w < 2.2;

      const score =
        area +
        (isLandscape ? 1_000_000 : 0) +
        (notTooNarrow ? 300_000 : 0) +
        (notTooTall ? 200_000 : 0);

      return {
        name: p.name,
        score
      };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.name || null;
}

function buildGooglePhotoUrl(photoName) {
  if (!photoName) return null;

  return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=900&maxWidthPx=1400&key=${getGooglePlacesApiKey()}`;
}

function extractCityFromAddress(address) {
  if (!address) return "台灣";

  const cities = [
    "台北市",
    "臺北市",
    "新北市",
    "桃園市",
    "台中市",
    "臺中市",
    "台南市",
    "臺南市",
    "高雄市",
    "基隆市",
    "新竹市",
    "新竹縣",
    "苗栗縣",
    "彰化縣",
    "南投縣",
    "雲林縣",
    "嘉義市",
    "嘉義縣",
    "屏東縣",
    "宜蘭縣",
    "花蓮縣",
    "台東縣",
    "臺東縣",
    "澎湖縣"
  ];

  const found = cities.find(c => address.includes(c));

  if (!found) return "台灣";

  return found.replace("臺", "台");
}

async function getOrCreateLocationId(address) {
  const city = extractCityFromAddress(address);
  const district = null;

  const [existing] = await pool.query(
    `SELECT location_id FROM locations WHERE city = ? AND district <=> ? LIMIT 1`,
    [city, district]
  );

  if (existing.length > 0) {
    return existing[0].location_id;
  }

  const [result] = await pool.query(
    `INSERT INTO locations (city, district) VALUES (?, ?)`,
    [city, district]
  );

  return result.insertId;
}

export async function searchGooglePlaces(textQuery, options = {}) {
  const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Missing GOOGLE_PLACES_API_KEY in .env");
  }

  const cleanQuery = String(textQuery || "").trim();

  if (!cleanQuery) {
    return [];
  }

  const maxResultCount = options.maxResultCount || 20;

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.location",
          "places.rating",
          "places.userRatingCount",
          "places.photos",
          "places.types",
          "places.websiteUri",
          "places.googleMapsUri"
        ].join(",")
      },
      body: JSON.stringify({
        textQuery: cleanQuery,
        languageCode: "zh-TW",
        regionCode: "TW",
        maxResultCount: maxResultCount,
        locationBias: {
          rectangle: {
            low: {
              latitude: 21.8,
              longitude: 119.3
            },
            high: {
              latitude: 25.4,
              longitude: 122.1
            }
          }
        }
      })
    }
  );

  const data = await response.json();

  console.log("Google Places API status:", response.status);
  console.log("Google Places API response:", JSON.stringify(data, null, 2));

  if (!response.ok) {
    throw new Error(
      data.error?.message || "Google Places Text Search request failed"
    );
  }

  return data.places || [];
}

export async function saveGooglePlaceToDatabase(place) {
  if (!place || !place.id) {
    return null;
  }

  // 第二層保護：不適合旅遊的 place 不存進資料庫
  if (!looksLikeTravelPlace(place)) {
    return null;
  }

  const travelScore = calculateGooglePlaceTravelScore(place);

  // 分數太低也不要收
  if (travelScore < 55) {
    return null;
  }

  const googlePlaceId = place.id;
  const attName = place.displayName?.text || "Unnamed Place";
  const address = place.formattedAddress || null;
  const lat = place.location?.latitude || null;
  const lng = place.location?.longitude || null;
  const googleRating = Number(place.rating) || 0;
  const googleTypes = place.types || [];
  const description = place.editorialSummary?.text || address || "Google Places result";
  const googleUserRatingCount = Number(place.userRatingCount) || 0;

  const photoName = pickBestPhoto(place.photos);
  const imageUrl = buildGooglePhotoUrl(photoName);
  const locationId = await getOrCreateLocationId(address);

  const [existing] = await pool.query(
    `SELECT att_id FROM attractions WHERE google_place_id = ? LIMIT 1`,
    [googlePlaceId]
  );

  if (existing.length > 0) {
    const attId = existing[0].att_id;

    await pool.query(
      `
      UPDATE attractions
      SET att_name = ?,
          description = ?,
          formatted_address = ?,
          latitude = ?,
          longitude = ?,
          google_rating = ?,
          google_user_rating_count = ?,
          location_id = ?,
          image_url = COALESCE(?, image_url),
          source = 'google'
      WHERE att_id = ?
      `,
      [
        attName,
        description,
        address,
        lat,
        lng,
        googleRating,
        googleUserRatingCount,
        locationId,
        imageUrl,
        attId
      ]
    );

    await recalcAvgRating(attId, googleRating);
    await syncCategories(attId, googleTypes);

    return attId;
  }

  const [result] = await pool.query(
    `
    INSERT INTO attractions
    (
      att_name,
      description,
      ticket_price,
      avg_rating,
      location_id,
      google_place_id,
      formatted_address,
      latitude,
      longitude,
      google_rating,
      google_user_rating_count,
      image_url,
      source
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      attName,
      description,
      0,
      googleRating,
      locationId,
      googlePlaceId,
      address,
      lat,
      lng,
      googleRating,
      googleUserRatingCount,
      imageUrl,
      "google"
    ]
  );

  await syncCategories(result.insertId, googleTypes);

  return result.insertId;
}

export function getPlaceTravelScoreForDebug(place) {
  return {
    travelScore: calculateGooglePlaceTravelScore(place),
    isTravelWorthy: looksLikeTravelPlace(place),
    types: place.types || [],
    rating: place.rating || null,
    userRatingCount: place.userRatingCount || 0,
    name: place.displayName?.text || null
  };
}