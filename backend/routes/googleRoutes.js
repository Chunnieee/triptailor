import express from "express";
import pool from "../db.js";
import {
  searchGooglePlaces,
  saveGooglePlaceToDatabase,
  normalizeInterestTags,
  TAG_QUERY_MAP
} from "../utils/googlePlaces.js";

const router = express.Router();

/* =========================
   BUILD GOOGLE QUERY
========================= */
function buildGoogleQuery({ keyword, city, category }) {
  const tags = normalizeInterestTags(category || keyword || "");
  const categoryQuery = tags.map((t) => TAG_QUERY_MAP[t] || t).join(" ");

  return [
    city,
    keyword,
    categoryQuery || category,
    "旅遊景點"
  ]
    .filter(Boolean)
    .join(" ");
}

/* =========================
   GOOGLE SEARCH
   GET /api/google-search?keyword=故宮&city=台北&category=Culture

   搜尋時：
   1. 先去 Google 找符合 keyword / city / category 的旅遊景點
   2. 存進 DB
   3. 只回傳這次 Google 找到的結果
   4. 不混原本 DB 舊資料
========================= */
router.get("/google-search", async (req, res) => {
  try {
    const { keyword, city, category } = req.query;

    if (!keyword && !city && !category) {
      return res.status(400).json({
        message: "At least one of keyword, city, or category is required"
      });
    }

    const googleQuery = buildGoogleQuery({ keyword, city, category });

    const googlePlaces = await searchGooglePlaces(googleQuery, {
      maxResultCount: 15
    });

    const savedIds = [];

    for (const place of googlePlaces) {
      const attId = await saveGooglePlaceToDatabase(place);

      if (attId) {
        savedIds.push(attId);
      }
    }

    const uniqueIds = [...new Set(savedIds)];

    if (uniqueIds.length === 0) {
      return res.json({
        source: "google_places_only",
        keyword,
        city,
        category,
        google_query_used: googleQuery,
        google_count: googlePlaces.length,
        count: 0,
        results: []
      });
    }

    let sql = `
      SELECT 
        a.att_id,
        a.att_name,
        a.description,
        a.ticket_price,
        a.avg_rating,
        a.google_rating,
        COALESCE(a.google_rating, a.avg_rating) AS rating,
        a.image_url,
        a.formatted_address,
        a.latitude,
        a.longitude,
        a.source,
        l.city,
        l.district,
        GROUP_CONCAT(DISTINCT c.cate_name SEPARATOR ', ') AS categories
      FROM attractions a
      LEFT JOIN locations l ON a.location_id = l.location_id
      LEFT JOIN attraction_categories ac ON a.att_id = ac.att_id
      LEFT JOIN categories c ON ac.cate_id = c.cate_id
      WHERE a.att_id IN (?)
    `;

    const params = [uniqueIds];

    if (city) {
      sql += `
        AND (
          l.city = ?
          OR a.formatted_address LIKE ?
        )
      `;
      params.push(city, `%${city}%`);
    }

    sql += `
      GROUP BY a.att_id, l.city, l.district
      ORDER BY 
        COALESCE(a.google_rating, a.avg_rating, 0) DESC,
        a.att_id DESC
      LIMIT 30
    `;

    const [rows] = await pool.query(sql, params);

    res.json({
      source: "google_places_only",
      keyword,
      city,
      category,
      google_query_used: googleQuery,
      google_count: googlePlaces.length,
      count: rows.length,
      results: rows
    });
  } catch (error) {
    console.error("Google search error:", error);

    res.status(500).json({
      message: "Google search failed",
      error: error.message
    });
  }
});

/* =========================
   ADMIN IMPORT TAIWAN ATTRACTIONS
========================= */
router.post("/admin/import-taiwan-attractions", async (req, res) => {
  try {
    const queries = [
      "台北 必去 旅遊景點",
      "新北 必去 旅遊景點",
      "桃園 必去 旅遊景點",
      "新竹 必去 旅遊景點",
      "苗栗 必去 旅遊景點",
      "台中 必去 旅遊景點",
      "彰化 必去 旅遊景點",
      "南投 必去 旅遊景點",
      "雲林 必去 旅遊景點",
      "嘉義 必去 旅遊景點",
      "台南 必去 旅遊景點",
      "高雄 必去 旅遊景點",
      "屏東 必去 旅遊景點",
      "宜蘭 必去 旅遊景點",
      "花蓮 必去 旅遊景點",
      "台東 必去 旅遊景點",
      "澎湖 必去 旅遊景點",
      "基隆 必去 旅遊景點",
      "台灣 文化古蹟 景點",
      "台灣 博物館 美術館",
      "台灣 自然風景區",
      "台灣 老街 夜市 觀光"
    ];

    let totalGoogleResults = 0;
    const importedAttIds = [];

    for (const q of queries) {
      const places = await searchGooglePlaces(q, {
        maxResultCount: 12
      });

      totalGoogleResults += places.length;

      for (const place of places) {
        const attId = await saveGooglePlaceToDatabase(place);

        if (attId) {
          importedAttIds.push(attId);
        }
      }
    }

    const uniqueAttIds = [...new Set(importedAttIds)];

    res.json({
      message: "Taiwan travel attractions imported successfully",
      query_count: queries.length,
      google_result_count: totalGoogleResults,
      imported_unique_count: uniqueAttIds.length
    });
  } catch (error) {
    console.error("Import Taiwan attractions error:", error);

    res.status(500).json({
      message: "Failed to import Taiwan attractions",
      error: error.message
    });
  }
});

/* =========================
   RANDOM DISCOVER
   GET /api/discover/random
   GET /api/discover/random?city=高雄市

   目前 Home 推薦邏輯：
   只要有 city，就只推薦該縣市景點。
   不在這裡強制篩 category，避免太嚴格導致全部空白。
========================= */
const RANDOM_TRAVEL_QUERIES = [
  "台灣 必去 觀光景點",
  "台灣 熱門旅遊景點",
  "台灣 文化古蹟 景點",
  "台灣 博物館 美術館",
  "台灣 自然風景區",
  "台灣 國家公園 步道",
  "台灣 老街 夜市 觀光",
  "台灣 親子旅遊景點",
  "台灣 文創園區",
  "台灣 海邊 風景景點",
  "台灣 山景 步道 景點",
  "台灣 北部 必去景點",
  "台灣 中部 必去景點",
  "台灣 南部 必去景點",
  "台灣 東部 必去景點"
];

function pickRandomItems(arr, count = 3) {
  return [...arr]
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function normalizeCity(city = "") {
  const value = String(city || "").trim();

  const map = {
    台北: "台北市",
    臺北: "台北市",
    台北市: "台北市",
    臺北市: "台北市",

    新北: "新北市",
    新北市: "新北市",

    桃園: "桃園市",
    桃園市: "桃園市",

    台中: "台中市",
    臺中: "台中市",
    台中市: "台中市",
    臺中市: "台中市",

    台南: "台南市",
    臺南: "台南市",
    台南市: "台南市",
    臺南市: "台南市",

    高雄: "高雄市",
    高雄市: "高雄市",

    基隆: "基隆市",
    基隆市: "基隆市",

    新竹: "新竹市",
    新竹市: "新竹市",
    新竹縣: "新竹縣",

    苗栗: "苗栗縣",
    苗栗縣: "苗栗縣",

    彰化: "彰化縣",
    彰化縣: "彰化縣",

    南投: "南投縣",
    南投縣: "南投縣",

    雲林: "雲林縣",
    雲林縣: "雲林縣",

    嘉義: "嘉義市",
    嘉義市: "嘉義市",
    嘉義縣: "嘉義縣",

    屏東: "屏東縣",
    屏東縣: "屏東縣",

    宜蘭: "宜蘭縣",
    宜蘭縣: "宜蘭縣",

    花蓮: "花蓮縣",
    花蓮縣: "花蓮縣",

    台東: "台東縣",
    臺東: "台東縣",
    台東縣: "台東縣",
    臺東縣: "台東縣",

    澎湖: "澎湖縣",
    澎湖縣: "澎湖縣"
  };

  return map[value] || value;
}

function buildRandomTravelQueries(city) {
  const cleanCity = normalizeCity(city);

  if (cleanCity) {
    return [
      `${cleanCity} 必去景點`,
      `${cleanCity} 熱門旅遊景點`,
      `${cleanCity} 觀光景點`,
      `${cleanCity} 自然景點`,
      `${cleanCity} 文化景點`
    ];
  }

  return pickRandomItems(RANDOM_TRAVEL_QUERIES, 3);
}

async function queryAttractionsFromDb({ city = "", ids = [] }) {
  let sql = `
    SELECT 
      a.att_id,
      a.att_name,
      a.description,
      a.ticket_price,
      a.avg_rating,
      a.google_rating,
      COALESCE(a.google_rating, a.avg_rating) AS rating,
      a.image_url,
      a.formatted_address,
      a.latitude,
      a.longitude,
      a.source,
      l.city,
      l.district,
      GROUP_CONCAT(DISTINCT c.cate_name SEPARATOR ', ') AS categories
    FROM attractions a
    LEFT JOIN locations l ON a.location_id = l.location_id
    LEFT JOIN attraction_categories ac ON a.att_id = ac.att_id
    LEFT JOIN categories c ON ac.cate_id = c.cate_id
    WHERE 1 = 1
  `;

  const params = [];

  if (Array.isArray(ids) && ids.length > 0) {
    sql += ` AND a.att_id IN (?) `;
    params.push(ids);
  }

  if (city) {
    sql += `
      AND (
        l.city = ?
        OR a.formatted_address LIKE ?
      )
    `;
    params.push(city, `%${city}%`);
  }

  sql += `
    GROUP BY a.att_id, l.city, l.district
    ORDER BY 
      COALESCE(a.google_rating, a.avg_rating, 0) DESC,
      RAND()
    LIMIT 12
  `;

  const [rows] = await pool.query(sql, params);
  return rows;
}

router.get("/discover/random", async (req, res) => {
  try {
    const city = normalizeCity(req.query.city || "");
    const queries = buildRandomTravelQueries(city);

    const savedIds = [];

    for (const q of queries) {
      const places = await searchGooglePlaces(q, {
        maxResultCount: 10
      });

      for (const place of places) {
        const attId = await saveGooglePlaceToDatabase(place);

        if (attId) {
          savedIds.push(attId);
        }
      }
    }

    const uniqueIds = [...new Set(savedIds)];

    let rows = [];

    if (uniqueIds.length > 0) {
      rows = await queryAttractionsFromDb({
        city,
        ids: uniqueIds
      });
    }

    /*
      如果 Google 這次抓回來的結果被篩光，
      就改用資料庫裡已經有的同縣市景點。
      這樣選高雄市、台北市，不會整區空白。
    */
    if (rows.length === 0 && city) {
      rows = await queryAttractionsFromDb({
        city,
        ids: []
      });
    }

    /*
      如果沒有選城市，或資料庫真的沒有該城市資料，
      就回傳全台熱門景點，避免 Popular Attractions 空白。
    */
    if (rows.length === 0 && !city) {
      rows = await queryAttractionsFromDb({
        city: "",
        ids: uniqueIds
      });
    }

    res.json({
      source: "random_google_travel_discover",
      message: rows.length > 0
        ? "Random travel places generated successfully"
        : "No matching travel places found",
      city: city || null,
      queries_used: queries,
      google_saved_count: uniqueIds.length,
      count: rows.length,
      results: rows
    });
  } catch (error) {
    console.error("Random discover error:", error);

    res.status(500).json({
      message: "Failed to generate random travel places",
      error: error.message
    });
  }
});
export default router;