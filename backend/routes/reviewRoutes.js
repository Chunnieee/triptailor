import express from "express";
import pool from "../db.js";

const router = express.Router();

async function updateAttractionAvgRating(attId) {
  const [rows] = await pool.query(
    `
    SELECT
      a.google_rating,
      COUNT(r.review_id)          AS review_count,
      COALESCE(SUM(r.rating), 0)  AS review_sum
    FROM attractions a
    LEFT JOIN reviews r ON r.att_id = a.att_id
    WHERE a.att_id = ?
    GROUP BY a.att_id, a.google_rating
    `,
    [attId]
  );

  if (rows.length === 0) return;

  const gr = Number(rows[0].google_rating) || 0;
  const n = Number(rows[0].review_count);
  const s = Number(rows[0].review_sum);

  let avg;
  if (gr > 0 && n > 0) {
    avg = (gr * 3 + s) / (3 + n);
  } else if (n > 0) {
    avg = s / n;
  } else {
    avg = gr;
  }

  await pool.query(
    `UPDATE attractions SET avg_rating = ? WHERE att_id = ?`,
    [avg.toFixed(1), attId]
  );
}

// 取得某景點評論
router.get("/attractions/:id/reviews", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        r.review_id,
        r.user_id,
        u.name AS user_name,
        r.att_id,
        r.rating,
        r.comment,
        r.create_at,
        r.edit_date
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.att_id = ?
      ORDER BY r.create_at DESC
      `,
      [id]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get reviews",
      error: error.message
    });
  }
});

// 取得某使用者所有評論
router.get("/users/:userId/reviews", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        r.review_id,
        r.rating,
        r.comment,
        r.create_at,
        r.edit_date,
        a.att_id,
        a.att_name
      FROM reviews r
      JOIN attractions a ON r.att_id = a.att_id
      WHERE r.user_id = ?
      ORDER BY r.create_at DESC
      `,
      [userId]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get user reviews",
      error: error.message
    });
  }
});

// 新增評論，若已存在則更新
router.post("/reviews", async (req, res) => {
  try {
    const { user_id, att_id, rating, comment } = req.body;

    if (!user_id || !att_id || !rating) {
      return res.status(400).json({
        message: "user_id, att_id, and rating are required"
      });
    }

    await pool.query(
      `
      INSERT INTO reviews (user_id, att_id, rating, comment)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        rating = VALUES(rating),
        comment = VALUES(comment),
        edit_date = CURRENT_TIMESTAMP
      `,
      [user_id, att_id, rating, comment || null]
    );

    await updateAttractionAvgRating(att_id);

    res.status(201).json({
      message: "Review saved successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to save review",
      error: error.message
    });
  }
});

// 修改評論
router.put("/reviews/:reviewId", async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    const [reviewRows] = await pool.query(
      "SELECT att_id FROM reviews WHERE review_id = ?",
      [reviewId]
    );

    if (reviewRows.length === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    const attId = reviewRows[0].att_id;

    await pool.query(
      `
      UPDATE reviews
      SET rating = COALESCE(?, rating),
          comment = COALESCE(?, comment),
          edit_date = CURRENT_TIMESTAMP
      WHERE review_id = ?
      `,
      [rating ?? null, comment !== undefined ? comment : null, reviewId]
    );

    await updateAttractionAvgRating(attId);

    res.json({
      message: "Review updated successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update review",
      error: error.message
    });
  }
});

// 刪除評論
router.delete("/reviews/:reviewId", async (req, res) => {
  try {
    const { reviewId } = req.params;

    const [reviewRows] = await pool.query(
      "SELECT att_id FROM reviews WHERE review_id = ?",
      [reviewId]
    );

    if (reviewRows.length === 0) {
      return res.status(404).json({ message: "Review not found" });
    }

    const attId = reviewRows[0].att_id;

    await pool.query(
      "DELETE FROM reviews WHERE review_id = ?",
      [reviewId]
    );

    await updateAttractionAvgRating(attId);

    res.json({
      message: "Review deleted successfully"
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete review",
      error: error.message
    });
  }
});

export default router;