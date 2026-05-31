import express from "express";
import bcrypt from "bcryptjs";
import pool from "../db.js";

const router = express.Router();

// 註冊
router.post("/register", async (req, res) => {
  try {
    const { name, email, phone_number, password, travel_freq } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Name, email, and password are required"
      });
    }

    const [existing] = await pool.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: "Email already exists"
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `
      INSERT INTO users
      (name, email, phone_number, password_hash, travel_freq)
      VALUES (?, ?, ?, ?, ?)
      `,
      [name, email, phone_number || null, password_hash, travel_freq || null]
    );

    res.status(201).json({
      message: "User registered successfully",
      user_id: result.insertId
    });
  } catch (error) {
    res.status(500).json({
      message: "Register failed",
      error: error.message
    });
  }
});

// 登入
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password"
      });
    }

    res.json({
      message: "Login successful",
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        phone_number: user.phone_number,
        travel_freq: user.travel_freq
      }
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: error.message
    });
  }
});

export default router;