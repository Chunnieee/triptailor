import express from "express";
import pool from "../db.js";

const router = express.Router();

// 所有地點
router.get("/locations", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM locations ORDER BY location_id ASC"
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get locations",
      error: error.message
    });
  }
});

// 新增地點
router.post("/locations", async (req, res) => {
  try {
    const { city, district } = req.body;

    if (!city) {
      return res.status(400).json({
        message: "City is required"
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO locations (city, district)
      VALUES (?, ?)
      `,
      [city, district || null]
    );

    res.status(201).json({
      message: "Location created successfully",
      location_id: result.insertId
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create location",
      error: error.message
    });
  }
});

export default router;