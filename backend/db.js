// backend/db.js
import mysql from "mysql2";
import dotenv from "dotenv";
import path from "path";

// Load .env based on NODE_ENV
dotenv.config({
  path: path.resolve(
    "./backend",
    process.env.NODE_ENV === "production"
      ? ".env.production"
      : ".env.development"
  ),
});

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,        
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error("Database connection error:", err);
  } else {
    console.log("MySQL connected successfully");
  }
});

export default db;
