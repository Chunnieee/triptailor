import express from "express";
import pool from "../db.js";

const router = express.Router();

/* =========================
   GET ALL ATTRACTIONS
   GET /api/attractions
========================= */
router.get("/attractions", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        a.att_id,
        a.att_name,
        a.description,
        a.ticket_price,
        a.avg_rating,
        a.google_rating,
        a.image_url,
        a.formatted_address,
        a.latitude,
        a.longitude,
        a.source,
        l.city,
        l.district,
        GROUP_CONCAT(c.cate_name SEPARATOR ', ') AS categories
      FROM attractions a
      LEFT JOIN locations l ON a.location_id = l.location_id
      LEFT JOIN attraction_categories ac ON a.att_id = ac.att_id
      LEFT JOIN categories c ON ac.cate_id = c.cate_id
      GROUP BY 
        a.att_id,
        a.att_name,
        a.description,
        a.ticket_price,
        a.avg_rating,
        a.google_rating,
        a.image_url,
        a.formatted_address,
        a.latitude,
        a.longitude,
        a.source,
        l.city,
        l.district
      ORDER BY a.att_id ASC
    `);

    res.json(rows);
  } catch (error) {
    console.error("Failed to get attractions:", error);
    res.status(500).json({
      message: "Failed to get attractions",
      error: error.message
    });
  }
});

/* =========================
   SEARCH LOCAL DATABASE
   GET /api/search?keyword=台北101&city=台北市&category=Nature
========================= */
router.get("/search", async (req, res) => {
  try {
    const { keyword, city, category } = req.query;

    let sql = `
      SELECT 
        a.att_id,
        a.att_name,
        a.description,
        a.ticket_price,
        a.avg_rating,
        a.google_rating,
        a.image_url,
        a.formatted_address,
        a.latitude,
        a.longitude,
        a.source,
        l.city,
        l.district,
        GROUP_CONCAT(c.cate_name SEPARATOR ', ') AS categories
      FROM attractions a
      LEFT JOIN locations l ON a.location_id = l.location_id
      LEFT JOIN attraction_categories ac ON a.att_id = ac.att_id
      LEFT JOIN categories c ON ac.cate_id = c.cate_id
      WHERE 1 = 1
    `;

    const params = [];

    if (keyword) {
      sql += `
        AND (
          a.att_name LIKE ?
          OR a.description LIKE ?
          OR a.formatted_address LIKE ?
        )
      `;
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    if (city) {
      sql += ` AND l.city LIKE ?`;
      params.push(`%${city}%`);
    }

    if (category) {
      sql += ` AND c.cate_name LIKE ?`;
      params.push(`%${category}%`);
    }

    sql += `
      GROUP BY 
        a.att_id,
        a.att_name,
        a.description,
        a.ticket_price,
        a.avg_rating,
        a.google_rating,
        a.image_url,
        a.formatted_address,
        a.latitude,
        a.longitude,
        a.source,
        l.city,
        l.district
      ORDER BY a.att_id ASC
    `;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error("Search failed:", error);
    res.status(500).json({
      message: "Search failed",
      error: error.message
    });
  }
});

/* =========================
   GET ONE ATTRACTION DETAIL
   GET /api/attractions/:id
========================= */
router.get("/attractions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        a.att_id,
        a.att_name,
        a.description,
        a.ticket_price,
        a.avg_rating,
        a.google_rating,
        a.image_url,
        a.formatted_address,
        a.latitude,
        a.longitude,
        a.source,
        l.city,
        l.district,
        GROUP_CONCAT(c.cate_name SEPARATOR ', ') AS categories,
        (SELECT COUNT(*) FROM favorites f WHERE f.att_id = a.att_id) AS bookmark_count
      FROM attractions a
      LEFT JOIN locations l ON a.location_id = l.location_id
      LEFT JOIN attraction_categories ac ON a.att_id = ac.att_id
      LEFT JOIN categories c ON ac.cate_id = c.cate_id
      WHERE a.att_id = ?
      GROUP BY 
        a.att_id,
        a.att_name,
        a.description,
        a.ticket_price,
        a.avg_rating,
        a.google_rating,
        a.image_url,
        a.formatted_address,
        a.latitude,
        a.longitude,
        a.source,
        l.city,
        l.district
  `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Attraction not found"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Failed to get attraction detail:", error);
    res.status(500).json({
      message: "Failed to get attraction detail",
      error: error.message
    });
  }
});
// Google Routes API
router.get("/attractions/:id/directions", async (req, res) => {

  try {

    const { id } = req.params;
    const { lat, lng, mode } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        message: "User location is required"
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        att_id,
        att_name,
        latitude,
        longitude
      FROM attractions
      WHERE att_id = ?
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Attraction not found"
      });
    }

    const attraction = rows[0];

    if (!attraction.latitude || !attraction.longitude) {
      return res.status(400).json({
        message: "Attraction has no coordinates"
      });
    }

    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "X-Goog-Api-Key":
            process.env.GOOGLE_PLACES_API_KEY,

          "X-Goog-FieldMask":
  "routes.duration,routes.distanceMeters,routes.legs.steps.travelMode,routes.legs.steps.localizedValues,routes.legs.steps.transitDetails"
        },

        body: JSON.stringify({

          origin: {
            location: {
              latLng: {
                latitude: Number(lat),
                longitude: Number(lng)
              }
            }
          },

          destination: {
            location: {
              latLng: {
                latitude: Number(attraction.latitude),
                longitude: Number(attraction.longitude)
              }
            }
          },

          travelMode: mode || "TRANSIT"

        })
      }
    );

    const data = await response.json();

    if (!response.ok) {

      return res.status(500).json({
        message: "Google Routes API failed",
        error: data
      });
    }

    const route = data.routes?.[0];

    if (!route) {

      return res.status(404).json({
        message: "No route found"
      });
    }

    res.json({
      duration: route.duration,
      distance_meters: route.distanceMeters,
      steps: route.legs?.[0]?.steps || []
    });
  } catch (error) {

    res.status(500).json({
      message: "Failed to get directions",
      error: error.message
    });
  }
});
export default router;