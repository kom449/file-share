import express, { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:3000", methods: "GET, POST" }));
app.use(express.json());

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
    .then(() => console.log("✅ Connected to MySQL"))
    .catch(err => console.error("❌ MySQL connection error:", err));

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${uuidv4()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});

const upload = multer({ storage });

app.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
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

        const filePath = path.join(uploadDir, req.file.filename);
        const fileUrl = `http://localhost:${PORT}/download/${fileId}`;

        await db.query(
            "INSERT INTO files (id, filename, path, url, password_hash, upload_date) VALUES (?, ?, ?, ?, ?, NOW())",
            [fileId, req.file.filename, filePath, fileUrl, passwordHash]
        );

        res.json({ fileUrl });
    } catch (err) {
        console.error("❌ Upload Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

app.get("/check-password/:fileId", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query("SELECT password_hash FROM files WHERE id = ?", [req.params.fileId]);

        if (rows.length === 0) {
            console.error(`❌ File ID not found in database: ${req.params.fileId}`);
            res.status(404).json({ error: "File not found" });
            return;
        }

        res.json({ requiresPassword: !!rows[0].password_hash });
    } catch (err) {
        console.error("❌ Check Password Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.get("/download/:fileId", async (req: Request, res: Response) => {
    try {
        const [rows]: any = await db.query("SELECT path, password_hash FROM files WHERE id = ?", [req.params.fileId]);

        if (rows.length === 0) {
            console.error(`❌ File ID not found in database: ${req.params.fileId}`);
            res.status(404).json({ error: "File not found" });
            return;
        }

        if (rows[0].password_hash) {
            res.status(403).json({ error: "Password required" });
            return;
        }

        const filePath = rows[0].path;

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File missing on disk: ${filePath}`);
            res.status(404).json({ error: "File not found on server" });
            return;
        }

        res.download(filePath);
    } catch (err) {
        console.error("❌ Download Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post("/download/:fileId", async (req: Request, res: Response) => {
    try {
        const { password } = req.body;
        const [rows]: any = await db.query("SELECT path, password_hash FROM files WHERE id = ?", [req.params.fileId]);

        if (rows.length === 0) {
            console.error(`❌ File ID not found in database: ${req.params.fileId}`);
            res.status(404).json({ error: "File not found" });
            return;
        }

        if (!rows[0].password_hash) {
            res.status(403).json({ error: "This file does not require a password. Use GET request." });
            return;
        }

        const passwordMatch = await bcrypt.compare(password, rows[0].password_hash);
        if (!passwordMatch) {
            res.status(403).json({ error: "Invalid password" });
            return;
        }

        const filePath = rows[0].path;

        if (!fs.existsSync(filePath)) {
            console.error(`❌ File missing on disk: ${filePath}`);
            res.status(404).json({ error: "File not found on server" });
            return;
        }

        res.download(filePath);
    } catch (err) {
        console.error("❌ Download Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
