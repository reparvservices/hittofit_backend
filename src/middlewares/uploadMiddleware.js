import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const UPLOADS_DIR = path.join(__dirname, "../../uploads");

const FOLDER_MAP = {
  products: "products",
  gyms: "gyms",
  profiles: "profiles",
  stores: "stores",
  general: "general",
};

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureDir(UPLOADS_DIR);
Object.values(FOLDER_MAP).forEach((folder) => {
  ensureDir(path.join(UPLOADS_DIR, folder));
});

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folderKey = String(req.query.folder || req.body?.folder || "general");
    const folder = FOLDER_MAP[folderKey] || FOLDER_MAP.general;
    const dest = path.join(UPLOADS_DIR, folder);
    ensureDir(dest);
    req.uploadFolder = folder;
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
      ? ext
      : ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${safeExt}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!file.mimetype?.startsWith("image/")) {
    cb(new Error("Only image files are allowed"));
    return;
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 8,
  },
});

export const buildPublicUrl = (req, folder, filename) => {
  const base =
    process.env.PUBLIC_BASE_URL ||
    `${req.protocol}://${req.get("host")}`;
  return `${base.replace(/\/$/, "")}/uploads/${folder}/${filename}`;
};
