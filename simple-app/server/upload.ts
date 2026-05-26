import multer from "multer";
import path from "path";
import { nanoid } from "nanoid";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), "uploads"));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${nanoid()  }${ext}`);
  },
});

export const uploadAncillary = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      ".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv",
      ".jpg", ".jpeg", ".png", ".heic", ".tiff", ".gif",
      ".mp3", ".m4a", ".wav", ".aac", ".ogg",
      ".mp4", ".mov", ".avi", ".mkv", ".webm",
    ];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("File type not supported"));
    }
  },
});

export function classifyFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if ([".pdf", ".docx", ".doc", ".xlsx", ".xls", ".csv"].includes(ext)) return "DOCUMENT";
  if ([".jpg", ".jpeg", ".png", ".heic", ".tiff", ".gif"].includes(ext)) return "IMAGE";
  if ([".mp3", ".m4a", ".wav", ".aac", ".ogg", ".mp4a"].includes(ext)) return "AUDIO";
  if ([".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext)) return "VIDEO";
  return "OTHER";
}

export const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".docx", ".doc"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF and DOCX files are supported"));
    }
  },
});
