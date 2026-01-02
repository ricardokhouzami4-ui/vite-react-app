// backend/index.js
import express from "express";
import dotenv from "dotenv";
import path from "path";
import db from "./db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Load .env based on NODE_ENV, inside backend folder
dotenv.config({
  path: path.resolve(
    "./backend",
    process.env.NODE_ENV === "production"
      ? ".env.production"
      : ".env.development"
  ),
});

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

// -------------------
// Middleware to protect routes
// -------------------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer <token>
  if (!token) return res.status(401).json({ error: "Access denied: No token" });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user; // store decoded token info
    next();
  });
};

// -------------------
// Test DB connection
// -------------------
app.get("/test-db", (req, res) => {
  db.query("SELECT 1", (err) => {
    if (err) return res.status(500).json({ error: "Database not connected" });
    res.json({ message: "Database connected successfully" });
  });
});

// -------------------
// Register API
// -------------------
app.post("/register", async (req, res) => {
  const { username, email, password, phone } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: "Missing fields" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql =
      "INSERT INTO users (username, email, password, phone) VALUES (?, ?, ?, ?)";
    db.query(sql, [username, email, hashedPassword, phone], (err) => {
      if (err) {
        if (err.code === "ER_DUP_ENTRY") {
          return res
            .status(400)
            .json({ error: "Username or email already exists" });
        }
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: "User registered successfully" });
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------
// Login API
// -------------------
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Missing email or password" });
  }

  const sql = "SELECT * FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect password" });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ message: "Login successful", token });
  });
});

// -------------------
// Profile Management
// -------------------
// GET /profile
app.get("/profile", authenticateToken, (req, res) => {
  const sql = "SELECT id, username, email, phone FROM users WHERE id = ?";
  db.query(sql, [req.user.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ error: "User not found" });
    res.json(results[0]);
  });
});

// PUT /profile
app.put("/profile", authenticateToken, (req, res) => {
  const { username, email, phone } = req.body;
  const sql = "UPDATE users SET username = ?, email = ?, phone = ? WHERE id = ?";
  db.query(sql, [username, email, phone, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Profile updated successfully" });
  });
});

// -------------------
// Password Management
// -------------------
// PUT /change-password
app.put("/change-password", authenticateToken, async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword)
    return res.status(400).json({ error: "Missing old or new password" });

  const sql = "SELECT password FROM users WHERE id = ?";
  db.query(sql, [req.user.id], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, results[0].password);
    if (!isMatch)
      return res.status(400).json({ error: "Old password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateSql = "UPDATE users SET password = ? WHERE id = ?";
    db.query(updateSql, [hashedPassword, req.user.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Password changed successfully" });
    });
  });
});

// -------------------
// Start server
// -------------------
app.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on port ${PORT}`
  );
});
