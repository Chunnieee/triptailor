import express from "express";
import pool from "../db.js";

const router = express.Router();

// 所有交通工具
router.get("/transportations", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM transportations ORDER BY trans_id ASC"
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get transportations",
      error: error.message
    });
  }
});

// 取得某景點交通資訊
router.get("/attractions/:id/transportation", async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `
      SELECT 
        ti.trans_info_id,
        ti.station_name,
        ti.walking_time,
        ti.parking,
        t.trans_id,
        t.trans_type
      FROM trans_info ti
      JOIN transportations t ON ti.trans_id = t.trans_id
      WHERE ti.att_id = ?
      `,
      [id]
    );

    res.json(rows);
  } catch (error) {
    res.status(500).json({
      message: "Failed to get transportation info",
      error: error.message
    });
  }
});

// 新增交通資訊
router.post("/transportation-info", async (req, res) => {
  try {
    const { att_id, trans_id, station_name, walking_time, parking } = req.body;

    if (!att_id || !trans_id) {
      return res.status(400).json({
        message: "att_id and trans_id are required"
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO trans_info
      (att_id, trans_id, station_name, walking_time, parking)
      VALUES (?, ?, ?, ?, ?)
      `,
      [
        att_id,
        trans_id,
        station_name || null,
        walking_time || null,
        parking || null
      ]
    );

    res.status(201).json({
      message: "Transportation info created successfully",
      trans_info_id: result.insertId
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create transportation info",
      error: error.message
    });
  }
});

export default router;