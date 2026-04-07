export interface HadithBook {
  id: string;
  name: string;
  arabicName: string;
  author: string;
  total: number;
  description: string;
  color: string;
}

export const HADITH_BOOKS: HadithBook[] = [
  {
    id: "eng-bukhari",
    name: "Sahih al-Bukhari",
    arabicName: "صحيح البخاري",
    author: "Imam al-Bukhari",
    total: 7277,
    description: "The most rigorously authenticated hadith collection in Islamic tradition, compiled by Imam al-Bukhari after decades of meticulous scholarship and verification.",
    color: "#1a4a2e",
  },
  {
    id: "eng-muslim",
    name: "Sahih Muslim",
    arabicName: "صحيح مسلم",
    author: "Imam Muslim ibn al-Hajjaj",
    total: 7368,
    description: "Second only to Sahih al-Bukhari in authority, this collection is distinguished by its systematic arrangement and exceptionally strict criteria for narrators.",
    color: "#1a2e4a",
  },
  {
    id: "eng-abudawud",
    name: "Sunan Abu Dawud",
    arabicName: "سنن أبي داود",
    author: "Imam Abu Dawud",
    total: 5276,
    description: "A foundational legal hadith collection containing 4,800 narrations selected from 500,000 reviewed by the author, covering Islamic law and daily practice.",
    color: "#2e1a4a",
  },
  {
    id: "eng-tirmidhi",
    name: "Jami at-Tirmidhi",
    arabicName: "جامع الترمذي",
    author: "Imam at-Tirmidhi",
    total: 4053,
    description: "A uniquely valuable collection that includes the scholarly grading of each hadith and records the legal opinions of the major schools of Islamic jurisprudence.",
    color: "#4a2e1a",
  },
  {
    id: "eng-nasai",
    name: "Sunan an-Nasai",
    arabicName: "سنن النسائي",
    author: "Imam an-Nasai",
    total: 5768,
    description: "Acclaimed for its exceptionally strict standards in evaluating narrators, making it one of the most critically assessed collections among the six canonical books.",
    color: "#1a3a2e",
  },
  {
    id: "eng-ibnmajah",
    name: "Sunan Ibn Majah",
    arabicName: "سنن ابن ماجه",
    author: "Imam Ibn Majah",
    total: 4345,
    description: "The sixth of the six canonical hadith collections, containing unique narrations not found elsewhere, organized into chapters covering all aspects of Islamic life.",
    color: "#2e3a1a",
  },
  {
    id: "eng-malik",
    name: "Muwatta Malik",
    arabicName: "موطأ مالك",
    author: "Imam Malik ibn Anas",
    total: 1848,
    description: "The earliest systematically compiled work of Islamic jurisprudence and hadith, written in Madinah and revered for over twelve centuries as a cornerstone of Islamic scholarship.",
    color: "#3a2e1a",
  },
  {
    id: "eng-musnadahmad",
    name: "Musnad Ahmad",
    arabicName: "مسند أحمد",
    author: "Imam Ahmad ibn Hanbal",
    total: 4346,
    description: "One of the largest hadith compilations in existence, containing over 27,000 narrations organized by Companion, representing a monumental achievement in Islamic scholarship.",
    color: "#2a3a4a",
  },
  {
    id: "eng-mishkat",
    name: "Mishkat al-Masabih",
    arabicName: "مشكاة المصابيح",
    author: "Al-Tabrizi",
    total: 4433,
    description: "An expanded and refined compilation widely used in Islamic seminaries worldwide, bringing together authenticated narrations across all fields of religious practice.",
    color: "#3a1a2e",
  },
  {
    id: "eng-riyadussalihin",
    name: "Riyad as-Salihin",
    arabicName: "رياض الصالحين",
    author: "Imam an-Nawawi",
    total: 1896,
    description: "Gardens of the Righteous — a timeless guide to piety and noble character, beloved by Muslims across generations for its accessible yet profound selection of hadiths.",
    color: "#1a3a4a",
  },
  {
    id: "eng-adabalmufrad",
    name: "Al-Adab Al-Mufrad",
    arabicName: "الأدب المفرد",
    author: "Imam al-Bukhari",
    total: 1326,
    description: "A dedicated collection of hadiths on Islamic manners and moral conduct, demonstrating that refinement of character is inseparable from the practice of the faith.",
    color: "#1a4a3a",
  },
  {
    id: "eng-nawawi40",
    name: "Al-Nawawi 40 Hadith",
    arabicName: "الأربعون النووية",
    author: "Imam an-Nawawi",
    total: 122,
    description: "Forty foundational narrations capturing the essential principles of Islam — a concise masterpiece studied by scholars and students worldwide for over eight centuries.",
    color: "#4a1a3a",
  },
  {
    id: "eng-shamailmuhammadiyyah",
    name: "Ash-Shama'il Al-Muhammadiyah",
    arabicName: "الشمائل المحمدية",
    author: "Imam at-Tirmidhi",
    total: 402,
    description: "A rare and intimate portrait of the Prophet Muhammad ﷺ — his appearance, habits, speech and worship — offering readers a deeply personal encounter with his blessed character.",
    color: "#4a3a1a",
  },
  {
    id: "eng-bulughalmaraml",
    name: "Bulugh al-Maram",
    arabicName: "بلوغ المرام",
    author: "Ibn Hajar al-Asqalani",
    total: 1767,
    description: "A concise yet comprehensive legal hadith compendium by Ibn Hajar al-Asqalani, widely studied in Islamic law courses and accompanied by scholarly grading of each narration.",
    color: "#1a2e3a",
  },
  {
    id: "eng-hisnalmuslim",
    name: "Hisn al-Muslim",
    arabicName: "حصن المسلم",
    author: "Said bin Ali al-Qahtani",
    total: 268,
    description: "Fortress of the Muslim — a treasury of authenticated supplications and remembrances from the Prophetic tradition, covering every moment of daily life from waking to sleep.",
    color: "#3a4a1a",
  },
];

export const BASE_HADITH_API =
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "") + "/hadith";
