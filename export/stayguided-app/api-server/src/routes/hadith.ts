import { Router } from "express";
import path from "node:path";
import fs from "node:fs";

const router = Router();

const VALID_BOOKS = new Set([
  "eng-bukhari",
  "eng-muslim",
  "eng-nasai",
  "eng-abudawud",
  "eng-tirmidhi",
  "eng-ibnmajah",
  "eng-malik",
  "eng-riyadussalihin",
  "eng-nawawi40",
  "eng-musnadahmad",
  "eng-mishkat",
  "eng-adabalmufrad",
  "eng-shamailmuhammadiyyah",
  "eng-bulughalmaraml",
  "eng-hisnalmuslim",
]);

interface HadithItem {
  hadithnumber: number;
  narrator: string;
  body: string;
  arabic: string;
  grades: { grade: string; graded_by: string }[];
  reference: string;
}

interface HadithCollection {
  total: number;
  hadiths: HadithItem[];
}

const cache = new Map<string, HadithCollection>();

function loadBook(book: string): HadithCollection | null {
  if (cache.has(book)) return cache.get(book)!;
  const dataDir = path.resolve(process.cwd(), "data/hadiths");
  const filePath = path.join(dataDir, `${book}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as HadithCollection;
    cache.set(book, data);
    return data;
  } catch {
    return null;
  }
}

/**
 * GET /api/hadith/:book?page=1&limit=50
 * Returns paginated hadiths for the requested book.
 * Response: { total: number, page: number, limit: number, hadiths: HadithItem[] }
 */
router.get("/hadith/:book", (req, res) => {
  const { book } = req.params;
  const page  = Math.max(1, parseInt(String(req.query.page  ?? 1)));
  const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? 50))));
  const offset = (page - 1) * limit;

  if (!VALID_BOOKS.has(book)) {
    return res.status(404).json({ error: `Unknown book: ${book}` });
  }

  const collection = loadBook(book);
  if (!collection) {
    return res.status(404).json({ error: `Data not found for: ${book}` });
  }

  const slice = collection.hadiths.slice(offset, offset + limit);

  return res.json({
    total: collection.total,
    page,
    limit,
    hadiths: slice,
  });
});

/**
 * GET /api/hadith/:book/all  — returns entire book in one shot (for initial load)
 */
router.get("/hadith/:book/all", (req, res) => {
  const { book } = req.params;

  if (!VALID_BOOKS.has(book)) {
    return res.status(404).json({ error: `Unknown book: ${book}` });
  }

  const collection = loadBook(book);
  if (!collection) {
    return res.status(404).json({ error: `Data not found for: ${book}` });
  }

  return res.json(collection);
});

export default router;
