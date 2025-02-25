"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const uuid_1 = require("uuid");
const bcrypt_1 = __importDefault(require("bcrypt"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)({
    origin: "http://localhost:3000",
    methods: "GET, POST",
    exposedHeaders: ["Content-Disposition"]
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const uploadDir = "D:/FS";
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const db = promise_1.default.createPool({
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
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${(0, uuid_1.v4)()}-${file.originalname}`;
        cb(null, uniqueName);
    }
});
const upload = (0, multer_1.default)({ storage });
const renderPasswordPrompt = (fileId, errorMessage) => `
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
app.post("/upload", upload.single("file"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const connection = yield db.getConnection();
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const fileId = (0, uuid_1.v4)();
        const { password } = req.body;
        let passwordHash = null;
        if (password) {
            const saltRounds = 10;
            passwordHash = yield bcrypt_1.default.hash(password, saltRounds);
        }
        const filePath = path_1.default.resolve(uploadDir, req.file.filename);
        const fileUrl = `http://localhost:${PORT}/download/${fileId}`;
        yield connection.beginTransaction();
        yield connection.query("INSERT INTO files (id, filename, path, url, password_hash, upload_date) VALUES (?, ?, ?, ?, ?, NOW())", [fileId, req.file.filename, filePath, fileUrl, passwordHash]);
        yield connection.commit();
        res.json({ fileUrl });
    }
    catch (err) {
        yield connection.rollback();
        console.error("Upload Error:", err);
        res.status(500).json({ error: "Database error" });
    }
    finally {
        connection.release();
    }
}));
app.get("/download/:fileId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`GET /download/${req.params.fileId} route hit`);
    try {
        const [rows] = yield db.query("SELECT filename, path, password_hash FROM files WHERE id = ?", [req.params.fileId]);
        if (rows.length === 0) {
            res.status(404).send("File not found");
            return;
        }
        const file = rows[0];
        if (file.password_hash) {
            res.send(renderPasswordPrompt(req.params.fileId));
        }
        else {
            const filePath = file.path;
            const originalFilename = file.filename;
            if (!fs_1.default.existsSync(filePath)) {
                res.status(404).send("File not found on server");
                return;
            }
            res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(originalFilename)}"`);
            res.setHeader("Content-Type", "application/octet-stream");
            res.download(filePath, originalFilename);
        }
    }
    catch (err) {
        console.error("GET /download error:", err);
        res.status(500).send("Internal server error");
    }
}));
app.post("/download/:fileId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`POST /download/${req.params.fileId} route hit`);
    try {
        const { password } = req.body;
        const [rows] = yield db.query("SELECT filename, path, password_hash FROM files WHERE id = ?", [req.params.fileId]);
        if (rows.length === 0) {
            res.status(404).send("File not found");
            return;
        }
        const file = rows[0];
        if (!file.password_hash) {
            res.status(403).send("This file does not require a password. Use GET request.");
            return;
        }
        const passwordMatch = yield bcrypt_1.default.compare(password, file.password_hash);
        if (!passwordMatch) {
            res.send(renderPasswordPrompt(req.params.fileId, "Invalid password. Please try again."));
            return;
        }
        const filePath = file.path;
        const originalFilename = file.filename;
        if (!fs_1.default.existsSync(filePath)) {
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
    }
    catch (err) {
        console.error("POST /download error:", err);
        res.status(500).send("Internal server error");
    }
}));
app.get("/check-password/:fileId", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const [rows] = yield db.query("SELECT password_hash FROM files WHERE id = ?", [req.params.fileId]);
        if (rows.length === 0) {
            res.status(404).json({ error: "File not found" });
            return;
        }
        res.json({ requiresPassword: !!rows[0].password_hash });
    }
    catch (err) {
        res.status(500).json({ error: "Internal server error" });
    }
}));
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
