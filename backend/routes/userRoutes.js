import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";

const router = express.Router();

/* =========================
   GET USER PROFILE
   GET /api/users/:userId
========================= */
router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        user_id,
        name,
        email,
        phone_number,
        gender,
        birthday,
        created_at
      FROM users
      WHERE user_id = ?
      `,
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Failed to get user profile:", error);

    res.status(500).json({
      message: "Failed to get user profile",
      error: error.message
    });
  }
});

/* =========================
   UPDATE USER PROFILE
   PUT /api/users/:userId

   Only update:
   - name
   - phone_number
   - password_hash

   Do NOT update:
   - gender
   - birthday
========================= */
router.put("/users/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, phone_number, password } = req.body;

    let passwordHash = null;

    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    await pool.query(
      `
      UPDATE users
      SET 
        name = COALESCE(?, name),
        phone_number = COALESCE(?, phone_number),
        password_hash = COALESCE(?, password_hash)
      WHERE user_id = ?
      `,
      [
        name || null,
        phone_number || null,
        passwordHash,
        userId
      ]
    );

    res.json({
      message: "User profile updated successfully"
    });
  } catch (error) {
    console.error("Failed to update user profile:", error);

    res.status(500).json({
      message: "Failed to update user profile",
      error: error.message
    });
  }
});

export default router;