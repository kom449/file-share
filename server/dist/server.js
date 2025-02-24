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
const mysql2_1 = __importDefault(require("mysql2"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Ensure the 'uploads' directory exists
const uploadDir = path_1.default.join(__dirname, "uploads");
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Configure MySQL Database
const db = mysql2_1.default.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
});
db.connect((err) => {
    if (err) {
        console.error("MySQL connection error:", err);
    }
    else {
        console.log("Connected to MySQL");
    }
});
// Multer Storage
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
    },
});
const upload = (0, multer_1.default)({ storage });
// ✅ Corrected Upload File Route
app.post("/upload", upload.single("file"), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
    }
    const fileUrl = `http://localhost:${PORT}/download/${req.file.filename}`;
    try {
        yield db.promise().query("INSERT INTO files (filename, path, url, upload_date) VALUES (?, ?, ?, NOW())", [req.file.filename, req.file.path, fileUrl]);
        res.json({ fileUrl });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
}));
// ✅ Corrected Download File Route
app.get("/download/:fileName", (req, res, next) => {
    const filePath = path_1.default.join(uploadDir, req.params.fileName);
    if (!fs_1.default.existsSync(filePath)) {
        res.status(404).json({ error: "File not found" });
        return;
    }
    res.download(filePath);
});
// Start Server
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
