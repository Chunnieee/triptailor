import express from "express";
import pool from "../db.js";
import {
  searchGooglePlaces,
  saveGooglePlaceToDatabase
} from "../utils/googlePlaces.js";
import {
  normalizePreferenceTags,
  buildTravelQueriesFromPreference,
  calculateTravelScore
} from "../utils/travelScoring.js";

const router = express.Router();

router.post("/users/:userId/recommendations/generate", async (req, res) => {
  try {
    const { userId } = req.params;

    const [profiles] = await pool.query(
      "SELECT * FROM preference_profiles WHERE user_id = ?",
      [userId]
    );

    if (profiles.length === 0) {
      return res.status(404).json({
        message: "Preference profile not found"
      });
    }

    const profile = profiles[0];
    const preferenceTags = normalizePreferenceTags(profile.interest_tag || "");
    const queries = buildTravelQueriesFromPreference(profile);

    const importedAttIds = [];

    for (const q of queries) {
      const places = await searchGooglePlaces(q, {
        maxResultCount: 15
      });

      for (const place of places) {
        const travelScore = calculateTravelScore(place, preferenceTags);

        if (travelScore.score < 65) {
          continue;
        }

        const attId = await saveGooglePlaceToDatabase(place);

        if (attId) {
          importedAttIds.push(attId);
        }
      }
    }

    await pool.query(
      "DELETE FROM recommendations WHERE profile_id = ?",
      [profile.profile_id]
    );

    const [attractions] = await pool.query(
      `
      SELECT 
        a.att_id,
        a.att_name,
        a.description,
        a.avg_rating,
        a.google_rating,
        COALESCE(a.google_rating, a.avg_rating, 0) AS rating,
        a.ticket_price,
        a.source,
        a.image_url,
        a.formatted_address,
        GROUP_CONCAT(DISTINCT c.cate_name SEPARATOR ',') AS categories
      FROM attractions a
      LEFT JOIN attraction_categories ac ON a.att_id = ac.att_id
      LEFT JOIN categories c ON ac.cate_id = c.cate_id
      GROUP BY a.att_id
      `
    );

    for (const att of attractions) {
      let score = 40;
      const reasons = [];

      const rating = Number(att.rating || 0);
      const categories = String(att.categories || "").toLowerCase();
      const name = String(att.att_name || "").toLowerCase();

      if (rating >= 4.7) {
        score += 20;
        reasons.push("高 Google 評分");
      } else if (rating >= 4.4) {
        score += 15;
        reasons.push("Google 評分良好");
      } else if (rating >= 4.0) {
        score += 8;
        reasons.push("評分達標");
      }

      for (const tag of preferenceTags) {
        if (tag === "nature" && categories.includes("nature")) {
          score += 20;
          reasons.push("符合自然景點偏好");
        }

        if (tag === "culture" && (categories.includes("culture") || categories.includes("museums"))) {
          score += 20;
          reasons.push("符合文化景點偏好");
        }

        if (tag === "family" && categories.includes("family")) {
          score += 20;
          reasons.push("符合親子旅遊偏好");
        }

        if (tag === "shopping" && categories.includes("shopping")) {
          score += 20;
          reasons.push("符合購物旅遊偏好");
        }

        if (tag === "food" && categories.includes("food")) {
          score += 12;
          reasons.push("符合美食偏好");
        }

        if (tag === "sightseeing" && categories.includes("sightseeing")) {
          score += 18;
          reasons.push("符合觀光景點偏好");
        }
      }

      if (importedAttIds.includes(att.att_id)) {
        score += 15;
        reasons.push("根據你的最新偏好從 Google 找到");
      }

      if (att.image_url) {
        score += 5;
        reasons.push("有景點圖片");
      }

      if (profile.budget !== null) {
  const budget = Number(profile.budget);
  const price = Number(att.ticket_price || 0);
  const isFree = price === 0;
  const isLowPrice = price > 0 && price <= 150;
  const isMidPrice = price > 150 && price <= 350;
  const isHighPrice = price > 350;

  if (budget <= 500) {
    if (isFree) {
      score += 25;
      reasons.push("免費景點，符合低預算");
    } else if (isLowPrice) {
      score += 5;
      reasons.push("票價尚可");
    } else {
      score -= 25;
      reasons.push("票價超出低預算範圍");
    }
  } else if (budget <= 1000) {
    if (isFree) {
      score += 20;
      reasons.push("免費入場");
    } else if (isLowPrice) {
      score += 15;
      reasons.push("票價實惠");
    } else if (isMidPrice) {
      score += 5;
      reasons.push("票價尚可");
    } else {
      score -= 15;
      reasons.push("票價偏高");
    }
  } else if (budget <= 2000) {
    if (isFree) {
      score += 15;
      reasons.push("免費入場");
    } else if (isLowPrice || isMidPrice) {
      score += 15;
      reasons.push("在預算內");
    } else if (isHighPrice) {
      score += 8;
      reasons.push("票價在可接受範圍");
    }
  } else {
    if (isFree) {
      score += 10;
      reasons.push("免費入場");
    } else {
      score += 15;
      reasons.push("在預算內");
    }
  }
}
      if (!preferenceTags.includes("food")) {
        if (
          categories.includes("food") ||
          name.includes("咖啡") ||
          name.includes("cafe") ||
          name.includes("餐廳")
        ) {
          score -= 30;
          reasons.push("較偏一般餐飲店，降低推薦權重");
        }
      }

      if (!preferenceTags.includes("family")) {
        if (
          name.includes("動物園") ||
          name.includes("zoo")
        ) {
          score -= 15;
          reasons.push("親子景點但非主要偏好，降低權重");
        }
      }

      score = Math.max(0, Math.min(100, Math.round(score)));

      if (score >= 60) {
        await pool.query(
          `
          INSERT INTO recommendations
          (profile_id, att_id, rec_score, reason)
          VALUES (?, ?, ?, ?)
          `,
          [
            profile.profile_id,
            att.att_id,
            score,
            reasons.join("; ") || "根據你的旅遊偏好推薦"
          ]
        );
      }
    }

    const [results] = await pool.query(
      `
      SELECT 
        rec.rec_id,
        rec.rec_score,
        rec.reason,
        a.att_id,
        a.att_name,
        a.description,
        a.avg_rating,
        a.google_rating,
        COALESCE(a.google_rating, a.avg_rating) AS rating,
        a.image_url,
        a.formatted_address,
        a.ticket_price,
        a.source,
        GROUP_CONCAT(DISTINCT c.cate_name SEPARATOR ', ') AS categories
      FROM recommendations rec
      JOIN attractions a ON rec.att_id = a.att_id
      LEFT JOIN attraction_categories ac ON a.att_id = ac.att_id
      LEFT JOIN categories c ON ac.cate_id = c.cate_id
      WHERE rec.profile_id = ?
      GROUP BY rec.rec_id, a.att_id
      ORDER BY rec.rec_score DESC, rating DESC
      LIMIT 30
      `,
      [profile.profile_id]
    );

    res.json({
      message: "Travel-style recommendations generated successfully",
      preference_tags: preferenceTags,
      google_queries_used: queries,
      imported_google_candidates: [...new Set(importedAttIds)].length,
      recommendations: results
    });
  } catch (error) {
    console.error("Generate travel recommendations error:", error);

    res.status(500).json({
      message: "Failed to generate travel recommendations",
      error: error.message
    });
  }
});

export default router;