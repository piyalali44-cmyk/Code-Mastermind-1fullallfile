export interface Episode {
  id: string;
  number: number;
  title: string;
  description: string;
  duration: string;
  durationSecs: number;
  isPremium: boolean;
  progress: number;
  audioUrl: string;
  hasAudio: boolean;
  coverUrl?: string;
}

export interface Series {
  id: string;
  title: string;
  description: string;
  coverColor: string;
  coverUrl?: string;
  category: string;
  episodeCount: number;
  totalHours: string;
  isFeatured: boolean;
  isNew: boolean;
  playCount: number;
  episodes: Episode[];
}

export interface JourneyChapter {
  id: string;
  number: number;
  title: string;
  era: string;
  description: string;
  episodeCount: number;
  progress: number;
  seriesId: string;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  displayName: string;
  score: number;
  country: string;
  change: number;
  isCurrentUser?: boolean;
}

export const MOCK_SERIES: Series[] = [
  {
    id: "s1",
    title: "The Life of the Prophet ﷺ",
    description: "A comprehensive audio journey through the life of Muhammad ﷺ, from his blessed birth in Makkah to his final days — told with historical accuracy, depth, and reverence.",
    coverColor: "#1a3a2a",
    category: "Seerah",
    episodeCount: 48,
    totalHours: "24 hrs",
    isFeatured: true,
    isNew: false,
    playCount: 0,
    episodes: [
      { id: "e1", number: 1, title: "Arabia Before Islam", description: "The state of Arabia before the birth of the Prophet ﷺ", duration: "32 min", durationSecs: 1920, isPremium: false, progress: 100, audioUrl: "", hasAudio: false },
      { id: "e2", number: 2, title: "The Year of the Elephant", description: "The miraculous event that marked the birth year of the Prophet ﷺ", duration: "28 min", durationSecs: 1680, isPremium: false, progress: 75, audioUrl: "", hasAudio: false },
      { id: "e3", number: 3, title: "The Birth of Muhammad ﷺ", description: "The blessed birth and early childhood of the Prophet ﷺ", duration: "35 min", durationSecs: 2100, isPremium: false, progress: 0, audioUrl: "", hasAudio: false },
      { id: "e4", number: 4, title: "Childhood and Youth", description: "Growing up as an orphan — the trials and blessings of his early years", duration: "30 min", durationSecs: 1800, isPremium: true, progress: 0, audioUrl: "", hasAudio: false },
      { id: "e5", number: 5, title: "Al-Amin — The Trustworthy", description: "How he earned the title of the most trustworthy man in Makkah", duration: "27 min", durationSecs: 1620, isPremium: true, progress: 0, audioUrl: "", hasAudio: false },
    ],
  },
  {
    id: "s2",
    title: "Stories of the Prophets",
    description: "From Adam (AS) to Isa (AS) — every Prophet's story narrated in vivid detail, drawn from the Qur'an, authentic hadith, and classical Islamic scholarship.",
    coverColor: "#1a2a3a",
    category: "Prophets",
    episodeCount: 32,
    totalHours: "16 hrs",
    isFeatured: true,
    isNew: false,
    playCount: 0,
    episodes: [
      { id: "e6", number: 1, title: "Adam (AS) — The First Human", description: "The creation of Adam, Jannah, and the descent to Earth", duration: "40 min", durationSecs: 2400, isPremium: false, progress: 50, audioUrl: "", hasAudio: false },
      { id: "e7", number: 2, title: "Nuh (AS) — The Great Flood", description: "900 years of prophethood and the great ark", duration: "38 min", durationSecs: 2280, isPremium: false, progress: 0, audioUrl: "", hasAudio: false },
      { id: "e8", number: 3, title: "Ibrahim (AS) — Father of Prophets", description: "The trials of Ibrahim, the Kaaba, and sacrifice", duration: "45 min", durationSecs: 2700, isPremium: true, progress: 0, audioUrl: "", hasAudio: false },
    ],
  },
  {
    id: "s3",
    title: "Companions of the Prophet ﷺ",
    description: "The remarkable lives of the Sahabah — those who walked alongside the Prophet ﷺ, sacrificed everything for Islam, and shaped the world we live in today.",
    coverColor: "#2a1a3a",
    category: "Sahaba",
    episodeCount: 24,
    totalHours: "12 hrs",
    isFeatured: true,
    isNew: true,
    playCount: 0,
    episodes: [
      { id: "e9", number: 1, title: "Abu Bakr As-Siddiq (RA)", description: "The most beloved companion — his faith, sacrifice, and leadership", duration: "42 min", durationSecs: 2520, isPremium: false, progress: 0, audioUrl: "", hasAudio: false },
      { id: "e10", number: 2, title: "Umar ibn Al-Khattab (RA)", description: "From fierce opponent to the second caliph of Islam", duration: "38 min", durationSecs: 2280, isPremium: false, progress: 0, audioUrl: "", hasAudio: false },
      { id: "e11", number: 3, title: "Uthman ibn Affan (RA)", description: "The man of two lights — his generosity and martyrdom", duration: "35 min", durationSecs: 2100, isPremium: true, progress: 0, audioUrl: "", hasAudio: false },
    ],
  },
  {
    id: "s4",
    title: "Islamic History: The Golden Age",
    description: "The rise of Islamic civilization — science, philosophy, medicine, architecture — when the Muslim world led humanity's intellectual advancement.",
    coverColor: "#3a2a1a",
    category: "History",
    episodeCount: 20,
    totalHours: "10 hrs",
    isFeatured: true,
    isNew: true,
    playCount: 0,
    episodes: [
      { id: "e12", number: 1, title: "The Abbasid Caliphate", description: "Baghdad: the city of peace and center of world knowledge", duration: "36 min", durationSecs: 2160, isPremium: false, progress: 0, audioUrl: "", hasAudio: false },
      { id: "e13", number: 2, title: "House of Wisdom", description: "Bayt al-Hikmah — where Greek, Persian, and Indian knowledge met Islam", duration: "32 min", durationSecs: 1920, isPremium: true, progress: 0, audioUrl: "", hasAudio: false },
    ],
  },
  {
    id: "s5",
    title: "Qur'anic Stories",
    description: "The timeless stories mentioned in the Holy Qur'an, explored in depth — from the People of the Cave to the Queen of Sheba.",
    coverColor: "#1a3a3a",
    category: "Qur'an",
    episodeCount: 16,
    totalHours: "8 hrs",
    isFeatured: true,
    isNew: false,
    playCount: 0,
    episodes: [
      { id: "e14", number: 1, title: "Ashab Al-Kahf", description: "The People of the Cave — faith in the face of oppression", duration: "33 min", durationSecs: 1980, isPremium: false, progress: 0, audioUrl: "", hasAudio: false },
      { id: "e15", number: 2, title: "The Story of Yusuf (AS)", description: "The most beautiful story in the Qur'an — complete retelling", duration: "55 min", durationSecs: 3300, isPremium: false, progress: 0, audioUrl: "", hasAudio: false },
    ],
  },
];

export const JOURNEY_CHAPTERS: JourneyChapter[] = [
  { id: "j1", number: 1, title: "In the Beginning", era: "Before Time", description: "Creation of the universe, angels, the Throne, the heavens", episodeCount: 4, progress: 100, seriesId: "s2" },
  { id: "j2", number: 2, title: "Adam & Eve", era: "The Garden", description: "Adam (AS): creation, Jannah, the fall, and the first family", episodeCount: 6, progress: 60, seriesId: "s2" },
  { id: "j3", number: 3, title: "Early Humanity", era: "Ancient Times", description: "Habil and Qabil, the first generations, spread of humanity", episodeCount: 3, progress: 0, seriesId: "s2" },
  { id: "j4", number: 4, title: "Idris & Nuh (AS)", era: "Ancient Prophets", description: "Prophet Idris, Prophet Nuh and the great flood", episodeCount: 5, progress: 0, seriesId: "s2" },
  { id: "j5", number: 5, title: "Hud & Salih (AS)", era: "Ancient Arabia", description: "Prophets of the ancient Arab tribes, 'Ad and Thamud", episodeCount: 4, progress: 0, seriesId: "s2" },
  { id: "j6", number: 6, title: "Ibrahim (AS)", era: "The Patriarch", description: "Father of monotheism — his trials, Kaaba, the sacrifice", episodeCount: 8, progress: 0, seriesId: "s2" },
  { id: "j7", number: 7, title: "Ismail & Ishaq (AS)", era: "The Two Sons", description: "The two sons and their diverging prophetic lines", episodeCount: 4, progress: 0, seriesId: "s2" },
  { id: "j8", number: 8, title: "Yusuf (AS)", era: "Egypt", description: "The most beautiful story in the Qur'an — in full detail", episodeCount: 6, progress: 0, seriesId: "s2" },
  { id: "j9", number: 9, title: "Musa & Bani Israel", era: "Egypt & Sinai", description: "The Exodus, the miracles, the Torah, the wandering", episodeCount: 10, progress: 0, seriesId: "s2" },
  { id: "j10", number: 10, title: "Dawud & Sulaiman (AS)", era: "The Golden Age", description: "The Israelite kingdom — power, wisdom, and wealth", episodeCount: 6, progress: 0, seriesId: "s2" },
  { id: "j11", number: 11, title: "Isa (AS)", era: "The Holy Land", description: "Prophet Jesus — his birth, miracles, mission, and ascension", episodeCount: 5, progress: 0, seriesId: "s2" },
  { id: "j12", number: 12, title: "Pre-Islamic Arabia", era: "Jahiliyyah", description: "The Quraysh, Arabian tribes, the Ka'bah before Islam", episodeCount: 4, progress: 0, seriesId: "s1" },
  { id: "j13", number: 13, title: "Birth of the Prophet ﷺ", era: "Makkah", description: "Early life of Muhammad ﷺ — the trustworthy one", episodeCount: 5, progress: 0, seriesId: "s1" },
  { id: "j14", number: 14, title: "The Revelation Begins", era: "Cave of Hira", description: "First revelation, early Muslims, the beginning of Islam", episodeCount: 6, progress: 0, seriesId: "s1" },
  { id: "j15", number: 15, title: "The Makkan Period", era: "Persecution", description: "13 years of trials, perseverance, and spiritual formation", episodeCount: 8, progress: 0, seriesId: "s1" },
  { id: "j16", number: 16, title: "The Hijra", era: "Migration", description: "The migration to Madinah — the turning point", episodeCount: 5, progress: 0, seriesId: "s1" },
  { id: "j17", number: 17, title: "The Madinan Period", era: "State-Building", description: "Building the ummah, battles, treaties, diplomacy", episodeCount: 10, progress: 0, seriesId: "s1" },
  { id: "j18", number: 18, title: "The Final Years", era: "Conquest", description: "Conquest of Makkah, Farewell Hajj, passing of the Prophet ﷺ", episodeCount: 6, progress: 0, seriesId: "s1" },
  { id: "j19", number: 19, title: "The Khulafa Rashidun", era: "The Caliphate", description: "Abu Bakr, Umar, Uthman, Ali — the rightly guided caliphs", episodeCount: 8, progress: 0, seriesId: "s3" },
  { id: "j20", number: 20, title: "Lessons & Legacy", era: "Eternal", description: "The eternal message of Islam and its impact on civilisation", episodeCount: 4, progress: 0, seriesId: "s4" },
];

export const LEADERBOARD_GLOBAL: LeaderboardEntry[] = [
  { id: "l1", rank: 1, displayName: "Ahmad Al-Rashid", score: 12480, country: "UK", change: 0 },
  { id: "l2", rank: 2, displayName: "Fatimah Zahra", score: 11250, country: "USA", change: 1 },
  { id: "l3", rank: 3, displayName: "Omar Farouq", score: 10890, country: "Canada", change: -1 },
  { id: "l4", rank: 4, displayName: "Khadijah M.", score: 9750, country: "Australia", change: 2 },
  { id: "l5", rank: 5, displayName: "Yusuf Ibrahim", score: 9200, country: "Germany", change: 0 },
  { id: "l6", rank: 6, displayName: "Aisha Rahman", score: 8900, country: "France", change: -2 },
  { id: "l7", rank: 7, displayName: "Hassan Ali", score: 8450, country: "UAE", change: 3 },
  { id: "l8", rank: 8, displayName: "Maryam S.", score: 7980, country: "Malaysia", change: 1 },
  { id: "l9", rank: 9, displayName: "Ibrahim J.", score: 7650, country: "Saudi Arabia", change: -1 },
  { id: "l10", rank: 10, displayName: "Zainab T.", score: 7200, country: "Egypt", change: 0 },
  { id: "lme", rank: 142, displayName: "You", score: 2340, country: "Your Country", change: 5, isCurrentUser: true },
];

export const CATEGORIES = [
  { id: "c1", name: "All", icon: "book" },
  { id: "c2", name: "Seerah", icon: "star" },
  { id: "c3", name: "Prophets", icon: "users" },
  { id: "c4", name: "Qur'an", icon: "book-open" },
  { id: "c5", name: "Sahaba", icon: "heart" },
  { id: "c6", name: "History", icon: "clock" },
  { id: "c7", name: "Fiqh", icon: "layers" },
];

export const RECITERS = [
  { id: "r1", name: "Mishary Rashid Alafasy", style: "Murattal" },
  { id: "r2", name: "Abdul Rahman Al-Sudais", style: "Murattal" },
  { id: "r3", name: "Mahmoud Khalil Al-Hussary", style: "Murattal" },
  { id: "r4", name: "Saud Al-Shuraim", style: "Murattal" },
  { id: "r5", name: "Abdul Basit Abdus Samad", style: "Mujawwad" },
];
