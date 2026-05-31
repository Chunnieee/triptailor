import "dotenv/config";
import express from "express";
import cors from "cors";
import pool from "./db.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import attractionRoutes from "./routes/attractionRoutes.js";
import googleRoutes from "./routes/googleRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import favoriteRoutes from "./routes/favoriteRoutes.js";
import preferenceRoutes from "./routes/preferenceRoutes.js";
import recommendationRoutes from "./routes/recommendationRoutes.js";
import transportationRoutes from "./routes/transportationRoutes.js";
import locationRoutes from "./routes/locationRoutes.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("TripTailor backend is running");
});

app.get("/api/health", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({
      message: "Database connected successfully",
      result: rows
    });
  } catch (error) {
    res.status(500).json({
      message: "Database connection failed",
      error: error.message
    });
  }
});

app.use("/api", authRoutes);
app.use("/api", userRoutes);
app.use("/api", attractionRoutes);
app.use("/api", googleRoutes);
app.use("/api", reviewRoutes);
app.use("/api", favoriteRoutes);
app.use("/api", preferenceRoutes);
app.use("/api", recommendationRoutes);
app.use("/api", transportationRoutes);
app.use("/api", locationRoutes);

app.listen(PORT, () => {
  console.log(`TripTailor backend running at http://localhost:${PORT}`);
});