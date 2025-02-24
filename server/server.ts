import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import cors from "cors";
import { v4 as uuidv4 } from "uuid"; // ✅ Import UUID generator

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Enable CORS
app.use(cors({
    origin: "http://localhost:3000",
    methods: "GET, POST",
    allowedHeaders: ["Content-Type"],
    credentials: true
}));

app.use(express.json());

// ✅ Set file storage location to D:/FS
const uploadDir = "D:/FS"; 

// ✅ Ensure 'D:/FS' directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`📁 Created upload directory at ${uploadDir}`);
} else {
    console.log(`📁 Upload directory exists: ${uploadDir}`);
}

// ✅ Connect to MySQL
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

// ✅ Multer Storage (Saves to D:/FS)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir); // ✅ Store files in D:/FS
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });

// ✅ Upload Route (Generates Random Link)
app.post("/upload", upload.single("file"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        // ✅ Generate a unique ID for the file
        const fileId = uuidv4();
        const fileUrl = `http://localhost:${PORT}/download/${fileId}`;

        // ✅ Store in MySQL with new storage path
        await db.query(
            "INSERT INTO files (id, filename, path, url, upload_date) VALUES (?, ?, ?, ?, NOW())",
            [fileId, req.file.filename, path.join(uploadDir, req.file.filename), fileUrl]
        );

        console.log(`✅ File uploaded: ${req.file.filename} → ${fileUrl}`);
        res.json({ fileUrl });
    } catch (err) {
        console.error("❌ Upload Error:", err);
        res.status(500).json({ error: "Database error" });
    }
});

// ✅ Download Route (Using UUID Instead of Filename)
app.get("/download/:fileId", async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [rows]: any = await db.query("SELECT path FROM files WHERE id = ?", [req.params.fileId]);

        if (rows.length === 0) {
            res.status(404).json({ error: "File not found" });
            return;
        }

        const filePath = rows[0].path;
        res.download(filePath);
    } catch (err) {
        console.error("❌ Download Error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
