import express from "express";
import pool from "../db.js";
import bcrypt from "bcrypt";

const router = express.Router();
// 取得使用者資料
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT user_id, name, email, phone_number, travel_freq, created_at
      FROM users
      WHERE user_id = ?
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get user profile",
      error: error.message
    });
  }
});

// 修改使用者資料
router.put("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, phone_number, travel_freq, new_password } = req.body;

    // 更新基本資料
    await pool.query(
      `
      UPDATE users
      SET name = COALESCE(?, name),
          phone_number = COALESCE(?, phone_number),
          travel_freq = COALESCE(?, travel_freq)
      WHERE user_id = ?
      `,
      [name || null, phone_number || null, travel_freq || null, userId]
    );

    // 如果有傳新密碼才更新
    if (new_password) {
      const hashed = await bcrypt.hash(new_password, 10);
      await pool.query(
        `UPDATE users SET password = ? WHERE user_id = ?`,
        [hashed, userId]
      );
    }

    res.json({ message: "User profile updated successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update user profile",
      error: error.message
    });
  }
});

export default router;