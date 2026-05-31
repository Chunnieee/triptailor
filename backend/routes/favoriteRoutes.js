import express from "express";
import pool from "../db.js";

const router = express.Router();

// 取得使用者收藏
router.get("/users/:userId/favorites", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        f.favorite_id,
        f.favorite_name,
        f.created_at,
        a.att_id,
        a.att_name,
        a.description,
        a.avg_rating,
        a.google_rating,
        a.formatted_address,
        a.ticket_price,
        a.source,
        l.city,
        l.district
      FROM favorites f
      JOIN attractions a ON f.att_id = a.att_id
      LEFT JOIN locations l ON a.location_id = l.location_id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get favorites",
      error: error.message
    });
  }
});

// 加入收藏，重複收藏不報錯
router.post("/favorites", async (req, res) => {
  try {
    const { user_id, att_id, favorite_name } = req.body;

    if (!user_id || !att_id) {
      return res.status(400).json({
        message: "user_id and att_id are required"
      });
    }

    await pool.query(
      `
      INSERT IGNORE INTO favorites (user_id, att_id, favorite_name)
      VALUES (?, ?, ?)
      `,
      [user_id, att_id, favorite_name || "My Favorite"]
    );

    res.status(201).json({
      message: "Favorite saved successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to add favorite",
      error: error.message
    });
  }
});

// 用 favorite_id 移除收藏
router.delete("/favorites/:favoriteId", async (req, res) => {
  try {
    const { favoriteId } = req.params;

    await pool.query(
      "DELETE FROM favorites WHERE favorite_id = ?",
      [favoriteId]
    );

    res.json({
      message: "Favorite removed successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to remove favorite",
      error: error.message
    });
  }
});

// 用 user_id + att_id 移除收藏
router.delete("/users/:userId/favorites/:attId", async (req, res) => {
  try {
    const { userId, attId } = req.params;

    await pool.query(
      `
      DELETE FROM favorites
      WHERE user_id = ? AND att_id = ?
      `,
      [userId, attId]
    );

    res.json({
      message: "Favorite removed successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to remove favorite",
      error: error.message
    });
  }
});

export default router;