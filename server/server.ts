import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Updated CORS: Allow only your production domain
app.use(cors({
    origin: "https://share.birdie.codes",
    methods: "GET, POST",
    exposedHeaders: ["Content-Disposition"]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = "D:/FS";

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection()
    .then(() => console.log("Connected to MySQL"))
    .catch(err => console.error("MySQL connection error:", err));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

// Helper to render a styled password prompt page
const renderPasswordPrompt = (fileId: string, errorMessage?: string): string => `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Required</title>
      <style>
          body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              margin: 0;
              padding: 0;
              background: #f7f7f7;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
          }
          .container {
              background: #fff;
              padding: 40px;
              border-radius: 8px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              text-align: center;
              width: 300px;
          }
          h2 {
              margin-bottom: 20px;
              color: #333;
          }
          input[type="password"] {
              width: 100%;
              padding: 10px;
              margin-bottom: 20px;
              border: 1px solid #ccc;
              border-radius: 4px;
          }
          button {
              background-color: #4CAF50;
              color: white;
              padding: 10px 20px;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 16px;
          }
          button:hover {
              background-color: #45a049;
          }
          .error {
              color: red;
              margin-bottom: 10px;
          }
      </style>
  </head>
  <body>
      <div class="container">
          <h2>Password Required</h2>
          ${errorMessage ? `<p class="error">${errorMessage}</p>` : ""}
          <form method="POST" action="/download/${fileId}">
              <input type="password" name="password" placeholder="Enter password" required>
              <button type="submit">Submit</button>
          </form>
      </div>
  </body>
  </html>
`;

app.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
    const connection = await db.getConnection();

    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const fileId = uuidv4();
        const { password } = req.body;
        let passwordHash = null;

        if (password) {
            const saltRounds = 10;
            passwordHash = await bcrypt.hash(password, saltRounds);
        }

        // Updated fileUrl to use production domain
        const fileUrl = `https://share.birdie.codes/download/${fileId}`;
        await connection.beginTransaction();
        await connection.query(
            "INSERT INTO files (id, filename, path, url, password_hash, upload_date) VALUES (?, ?, ?, ?, ?, NOW())",
            [fileId, req.file.filename, path.resolve(uploadDir, req.file.filename), fileUrl, passwordHash]
        );

        await connection.commit();
        res.json({ fileUrl });
    } catch (err) {
        await connection.rollback();
        console.error("Upload Error:", err);
        res.status(500).json({ error: "Database error" });
    } finally {
        connection.release();
    }
});

app.get("/download/:fileId", async (req: Request, res: Response) => {
    console.log(`GET /download/${req.params.fileId} route hit`);
    try {
        const [rows]: any = await db.query(
            "SELECT filename, path, password_hash FROM files WHERE id = ?",
            [req.params.fileId]
        );
        if (rows.length === 0) {
            res.status(404).send("File not found");
            return;
        }
        const file = rows[0];
        if (file.password_hash) {
            res.send(renderPasswordPrompt(req.params.fileId));
        } else {
            const filePath = file.path;
            const originalFilename = file.filename;
            if (!fs.existsSync(filePath)) {
                res.status(404).send("File not found on server");
                return;
            }
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(originalFilename)}"`);
            res.setHeader("Content-Type", "application/octet-stream");
            res.download(filePath, originalFilename);
        }
    } catch (err) {
        console.error("GET /download error:", err);
        res.status(500).send("Internal server error");
    }
});

app.post("/download/:fileId", async (req: Request, res: Response): Promise<void> => {
    console.log(`POST /download/${req.params.fileId} route hit`);
    try {
        const { password } = req.body;
        const [rows]: any = await db.query(
            "SELECT filename, path, password_hash FROM files WHERE id = ?",
            [req.params.fileId]
        );
        if (rows.length === 0) {
            res.status(404).send("File not found");
            return;
        }
        const file = rows[0];
        if (!file.password_hash) {
            res.status(403).send("This file does not require a password. Use GET request.");
            return;
        }
        const passwordMatch = await bcrypt.compare(password, file.password_hash);
        if (!passwordMatch) {
            res.send(renderPasswordPrompt(req.params.fileId, "Invalid password. Please try again."));
            return;
        }
        const filePath = file.path;
        const originalFilename = file.filename;
        if (!fs.existsSync(filePath)) {
            res.status(404).send("File not found on server");
            return;
        }
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(originalFilename)}"`);
        res.setHeader("Content-Type", "application/octet-stream");
        res.download(filePath, originalFilename, (err) => {
            if (err) {
                res.status(500).send("Internal server error");
            }
        });
    } catch (err) {
        console.error("POST /download error:", err);
        res.status(500).send("Internal server error");
    }
});

app.get("/check-password/:fileId", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query("SELECT password_hash FROM files WHERE id = ?", [req.params.fileId]);
        if (rows.length === 0) {
            res.status(404).json({ error: "File not found" });
            return;
        }
        res.json({ requiresPassword: !!rows[0].password_hash });
    } catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
