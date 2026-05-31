import express from "express";
import pool from "../db.js";

const router = express.Router();

/* =========================
   GET USER PREFERENCES
   GET /api/users/:userId/preferences
========================= */
router.get("/users/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT *
      FROM preference_profiles
      WHERE user_id = ?
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Preference profile not found"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Get preferences error:", error);

    res.status(500).json({
      message: "Failed to get preferences",
      error: error.message
    });
  }
});

/* =========================
   CREATE OR UPDATE PREFERENCES
   POST /api/users/:userId/preferences
========================= */
router.post("/users/:userId/preferences", async (req, res) => {
  try {
    const { userId } = req.params;

    const {
      budget,
      prefer_transportation,
      interest_tag,
      preferred_city
    } = req.body;

    const [existing] = await pool.query(
      `
      SELECT profile_id
      FROM preference_profiles
      WHERE user_id = ?
      `,
      [userId]
    );

    if (existing.length > 0) {
      await pool.query(
        `
        UPDATE preference_profiles
        SET budget = ?,
            prefer_transportation = ?,
            interest_tag = ?,
            preferred_city = ?
        WHERE user_id = ?
        `,
        [
          budget || null,
          prefer_transportation || null,
          interest_tag || null,
          preferred_city || null,
          userId
        ]
      );

      return res.json({
        message: "Preferences updated successfully"
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO preference_profiles
      (user_id, budget, prefer_transportation, interest_tag, preferred_city)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        userId,
        budget || null,
        prefer_transportation || null,
        interest_tag || null,
        preferred_city || null
      ]
    );

    res.status(201).json({
      message: "Preferences created successfully",
      profile_id: result.insertId
    });
  } catch (error) {
    console.error("Save preferences error:", error);

    res.status(500).json({
      message: "Failed to save preferences",
      error: error.message
    });
  }
});

export default router;