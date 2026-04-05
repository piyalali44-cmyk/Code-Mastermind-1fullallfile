import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { useAuth } from "@/context/AuthContext";
import {
  addBookmark, addDownload, addFavourite,
  getBookmarks, getDownloads, getFavourites,
  removeBookmark, removeDownload, removeFavourite,
} from "@/lib/db";

export interface DownloadProgress {
  episodeId: string;
  progress: number;
}

interface UserActionsState {
  favourites: Set<string>;
  bookmarks: Set<string>;
  downloads: Set<string>;
  downloadProgress: Map<string, number>;
  toggleFavourite: (id: string, meta?: { title?: string; coverColor?: string }) => boolean;
  toggleBookmark: (id: string, meta?: { title?: string; coverColor?: string }) => boolean;
  toggleDownload: (id: string, meta?: { title?: string; audioUrl?: string }) => boolean;
  startDownload: (id: string, audioUrl: string, meta?: { title?: string }) => Promise<void>;
  removeDownloadedFile: (id: string) => Promise<void>;
  getLocalFilePath: (id: string) => Promise<string | null>;
  isFavourite: (id: string) => boolean;
  isBookmarked: (id: string) => boolean;
  isDownloaded: (id: string) => boolean;
  refreshFromStorage: () => Promise<void>;
}

const UserActionsContext = createContext<UserActionsState>({
  favourites: new Set(),
  bookmarks: new Set(),
  downloads: new Set(),
  downloadProgress: new Map(),
  toggleFavourite: () => false,
  toggleBookmark: () => false,
  toggleDownload: () => false,
  startDownload: async () => {},
  removeDownloadedFile: async () => {},
  getLocalFilePath: async () => null,
  isFavourite: () => false,
  isBookmarked: () => false,
  isDownloaded: () => false,
  refreshFromStorage: async () => {},
});

const STORAGE_KEYS = {
  favourites: "user_favourites",
  bookmarks: "user_bookmarks",
  downloads: "user_downloads",
  downloadPaths: "user_download_paths",
};

function parseId(id: string): { contentType: "surah" | "episode" | "series"; contentId: string } {
  const parts = id.split(":");
  if (parts.length === 2) {
    return { contentType: parts[0] as any, contentId: parts[1] };
  }
  return { contentType: "episode", contentId: id };
}


export function UserActionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [downloads, setDownloads] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Map<string, number>>(new Map());
  const [downloadPaths, setDownloadPaths] = useState<Record<string, string>>({});
  const loadedRef = useRef(false);

  // Core loader: reads AsyncStorage then merges with Supabase (never discards local-only items)
  const loadFromStorageAndDB = useCallback(async (uid: string | null) => {
    try {
      const [fav, bk, dl, dp] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.favourites),
        AsyncStorage.getItem(STORAGE_KEYS.bookmarks),
        AsyncStorage.getItem(STORAGE_KEYS.downloads),
        AsyncStorage.getItem(STORAGE_KEYS.downloadPaths),
      ]);
      const localFav: string[] = fav ? JSON.parse(fav) : [];
      const localBk: string[]  = bk  ? JSON.parse(bk)  : [];
      const localDl: string[]  = dl  ? JSON.parse(dl)   : [];

      // Start with local data so nothing is ever lost
      const mergedFav = new Set<string>(localFav);
      const mergedBk  = new Set<string>(localBk);
      const mergedDl  = new Set<string>(localDl);

      if (dp) setDownloadPaths(JSON.parse(dp));

      if (uid) {
        try {
          const [favData, bkData, dlData] = await Promise.all([
            getFavourites(uid),
            getBookmarks(uid),
            getDownloads(uid),
          ]);
          // MERGE: add DB items into local set (never wipe local-only items)
          favData.forEach((r: any) => mergedFav.add(`${r.content_type}:${r.content_id}`));
          bkData.forEach((r: any)  => mergedBk.add(`${r.content_type}:${r.content_id}`));
          dlData.forEach((r: any)  => mergedDl.add(`${r.content_type}:${r.content_id}`));
        } catch (_) {}
      }

      setFavourites(mergedFav);
      setBookmarks(mergedBk);
      setDownloads(mergedDl);

      // Persist the merged result back to AsyncStorage
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.favourites, JSON.stringify([...mergedFav])),
        AsyncStorage.setItem(STORAGE_KEYS.bookmarks,  JSON.stringify([...mergedBk])),
        AsyncStorage.setItem(STORAGE_KEYS.downloads,  JSON.stringify([...mergedDl])),
      ]);
    } catch (_) {}
    loadedRef.current = true;
  }, []);

  useEffect(() => {
    loadFromStorageAndDB(userId);
  }, [userId, loadFromStorageAndDB]);

  // Exposed so Library (and other screens) can force a refresh when navigating back
  const refreshFromStorage = useCallback(async () => {
    await loadFromStorageAndDB(userId);
  }, [userId, loadFromStorageAndDB]);

  const persistLocal = async (key: string, set: Set<string>) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify([...set]));
    } catch (_) {}
  };

  const persistDownloadPaths = async (paths: Record<string, string>) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.downloadPaths, JSON.stringify(paths));
    } catch (_) {}
  };

  const toggleFavourite = useCallback((id: string, meta?: { title?: string; coverColor?: string }) => {
    const currentlyFav = favourites.has(id);
    const added = !currentlyFav;

    setFavourites((prev) => {
      const next = new Set(prev);
      if (currentlyFav) next.delete(id);
      else next.add(id);
      persistLocal(STORAGE_KEYS.favourites, next);
      return next;
    });

    if (userId) {
      const { contentType, contentId } = parseId(id);
      if (added) {
        addFavourite(userId, { contentType, contentId, title: meta?.title ?? contentId, coverColor: meta?.coverColor });
      } else {
        removeFavourite(userId, contentType, contentId);
      }
    }

    return added;
  }, [userId, favourites]);

  const toggleBookmark = useCallback((id: string, meta?: { title?: string; coverColor?: string }) => {
    const currentlyBk = bookmarks.has(id);
    const added = !currentlyBk;

    setBookmarks((prev) => {
      const next = new Set(prev);
      if (currentlyBk) next.delete(id);
      else next.add(id);
      persistLocal(STORAGE_KEYS.bookmarks, next);
      return next;
    });

    if (userId) {
      const { contentType, contentId } = parseId(id);
      if (added) {
        addBookmark(userId, { contentType, contentId, title: meta?.title ?? contentId, coverColor: meta?.coverColor });
      } else {
        removeBookmark(userId, contentType, contentId);
      }
    }

    return added;
  }, [userId, bookmarks]);

  // Helper: mark id as downloaded in state + AsyncStorage + Supabase
  const markDownloaded = useCallback(async (id: string, localUri?: string, meta?: { title?: string }) => {
    setDownloads((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistLocal(STORAGE_KEYS.downloads, next);
      return next;
    });
    if (localUri) {
      setDownloadPaths((prev) => {
        const next = { ...prev, [id]: localUri };
        persistDownloadPaths(next);
        return next;
      });
    }
    if (userId) {
      try {
        const { contentType, contentId } = parseId(id);
        addDownload(userId, { contentType: contentType as "surah" | "episode", contentId, title: meta?.title ?? contentId });
      } catch (_) {}
    }
  }, [userId]);

  const startDownload = useCallback(async (id: string, audioUrl: string, meta?: { title?: string }) => {
    if (!audioUrl) {
      console.warn("[startDownload] No audio URL for", id);
      return;
    }

    setDownloadProgress((prev) => new Map(prev).set(id, 0.01));

    const clearProgress = () => {
      setDownloadProgress((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    };

    try {
      if (Platform.OS === "web") {
        // ── Web: fetch with progress then trigger browser Save dialog ────────
        let response: Response;
        try {
          response = await fetch(audioUrl, { mode: "cors" });
        } catch {
          // CORS blocked — open in new tab so browser handles the download
          (window as any).open(audioUrl, "_blank");
          await markDownloaded(id, undefined, meta);
          clearProgress();
          return;
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const contentLength = parseInt(response.headers.get("content-length") ?? "0");
        const reader = response.body!.getReader();
        const chunks: BlobPart[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (contentLength > 0) {
              setDownloadProgress((prev) => new Map(prev).set(id, received / contentLength));
            }
          }
        }

        const ext = audioUrl.includes(".mp3") ? "mp3" : "m4a";
        const safeName = (meta?.title ?? id).replace(/[^\w\s-]/g, "").trim();
        const filename = `${safeName || "audio"}.${ext}`;

        const blob = new Blob(chunks, { type: "audio/mpeg" });
        const blobUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

        await markDownloaded(id, undefined, meta);

      } else {
        // ── Native: use expo-file-system ─────────────────────────────────────
        const fs = await import("expo-file-system/legacy");
        const docDir = fs.documentDirectory;
        if (!docDir) throw new Error("No documentDirectory available");

        const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
        const ext = audioUrl.toLowerCase().includes(".mp3") ? ".mp3" : ".m4a";
        const destUri = `${docDir}downloads/${safeId}${ext}`;

        await fs.makeDirectoryAsync(`${docDir}downloads/`, { intermediates: true }).catch(() => {});

        const dl = fs.createDownloadResumable(
          audioUrl,
          destUri,
          {},
          ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
            if (totalBytesExpectedToWrite > 0) {
              setDownloadProgress((prev) =>
                new Map(prev).set(id, totalBytesWritten / totalBytesExpectedToWrite)
              );
            }
          }
        );

        const result = await dl.downloadAsync();
        if (!result?.uri) throw new Error("Download returned no URI");

        await markDownloaded(id, result.uri, meta);
      }
    } catch (err) {
      console.error("[startDownload] Error:", err);
      // Last resort: still mark as downloaded so UI stays consistent
      await markDownloaded(id, undefined, meta);
    } finally {
      clearProgress();
    }
  }, [userId, markDownloaded]);

  const removeDownloadedFile = useCallback(async (id: string) => {
    const localPath = downloadPaths[id];
    if (localPath && Platform.OS !== "web") {
      try {
        const legacy = await import("expo-file-system/legacy");
        const info = await legacy.getInfoAsync(localPath);
        if (info.exists) {
          await legacy.deleteAsync(localPath, { idempotent: true });
        }
      } catch {}
    }

    setDownloads((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistLocal(STORAGE_KEYS.downloads, next);
      return next;
    });
    setDownloadPaths((prev) => {
      const next = { ...prev };
      delete next[id];
      persistDownloadPaths(next);
      return next;
    });

    if (userId) {
      const { contentType, contentId } = parseId(id);
      removeDownload(userId, contentType, contentId);
    }
  }, [userId, downloadPaths]);

  const toggleDownload = useCallback((id: string, meta?: { title?: string; audioUrl?: string }) => {
    const currentlyDl = downloads.has(id);
    const added = !currentlyDl;

    if (currentlyDl) {
      removeDownloadedFile(id);
    } else {
      // startDownload handles both web and native, and guards against missing audioUrl
      startDownload(id, meta?.audioUrl ?? "", { title: meta?.title });
    }

    return added;
  }, [downloads, startDownload, removeDownloadedFile]);

  const getLocalFilePath = useCallback(async (id: string): Promise<string | null> => {
    const path = downloadPaths[id];
    if (!path || Platform.OS === "web") return null;
    try {
      const { File } = await import("expo-file-system");
      const file = new File(path);
      return file.exists ? path : null;
    } catch {
      return null;
    }
  }, [downloadPaths]);

  const isFavourite = useCallback((id: string) => favourites.has(id), [favourites]);
  const isBookmarked = useCallback((id: string) => bookmarks.has(id), [bookmarks]);
  const isDownloaded = useCallback((id: string) => downloads.has(id), [downloads]);

  return (
    <UserActionsContext.Provider
      value={{
        favourites, bookmarks, downloads, downloadProgress,
        toggleFavourite, toggleBookmark, toggleDownload,
        startDownload, removeDownloadedFile, getLocalFilePath,
        isFavourite, isBookmarked, isDownloaded,
        refreshFromStorage,
      }}
    >
      {children}
    </UserActionsContext.Provider>
  );
}

export const useUserActions = () => useContext(UserActionsContext);
