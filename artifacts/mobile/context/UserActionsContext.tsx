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

  useEffect(() => {
    const load = async () => {
      try {
        const [fav, bk, dl, dp] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.favourites),
          AsyncStorage.getItem(STORAGE_KEYS.bookmarks),
          AsyncStorage.getItem(STORAGE_KEYS.downloads),
          AsyncStorage.getItem(STORAGE_KEYS.downloadPaths),
        ]);
        if (fav) setFavourites(new Set(JSON.parse(fav)));
        if (bk) setBookmarks(new Set(JSON.parse(bk)));
        if (dl) setDownloads(new Set(JSON.parse(dl)));
        if (dp) setDownloadPaths(JSON.parse(dp));
      } catch (_) {}

      if (userId) {
        try {
          const [favData, bkData, dlData] = await Promise.all([
            getFavourites(userId),
            getBookmarks(userId),
            getDownloads(userId),
          ]);
          if (favData.length > 0) {
            const favSet = new Set(favData.map((r: any) => `${r.content_type}:${r.content_id}`));
            setFavourites(favSet);
            await AsyncStorage.setItem(STORAGE_KEYS.favourites, JSON.stringify([...favSet]));
          }
          if (bkData.length > 0) {
            const bkSet = new Set(bkData.map((r: any) => `${r.content_type}:${r.content_id}`));
            setBookmarks(bkSet);
            await AsyncStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify([...bkSet]));
          }
          if (dlData.length > 0) {
            const dlSet = new Set(dlData.map((r: any) => `${r.content_type}:${r.content_id}`));
            setDownloads(dlSet);
            await AsyncStorage.setItem(STORAGE_KEYS.downloads, JSON.stringify([...dlSet]));
          }
        } catch (_) {}
      }
      loadedRef.current = true;
    };
    load();
  }, [userId]);

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

  const startDownload = useCallback(async (id: string, audioUrl: string, meta?: { title?: string }) => {
    setDownloadProgress((prev) => new Map(prev).set(id, 0));

    try {
      if (Platform.OS !== "web" && audioUrl) {
        const legacy = await import("expo-file-system/legacy");
        const docDir = legacy.documentDirectory;
        if (docDir) {
          const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
          const ext = audioUrl.includes(".mp3") ? ".mp3" : ".m4a";
          const destUri = docDir + "downloads/" + safeId + ext;

          await legacy.makeDirectoryAsync(docDir + "downloads/", { intermediates: true }).catch(() => {});

          const downloadResumable = legacy.createDownloadResumable(
            audioUrl,
            destUri,
            {},
            (dp) => {
              if (dp.totalBytesExpectedToWrite > 0) {
                const pct = dp.totalBytesWritten / dp.totalBytesExpectedToWrite;
                setDownloadProgress((prev) => new Map(prev).set(id, pct));
              }
            }
          );

          const result = await downloadResumable.downloadAsync();

          if (result && result.uri) {
            setDownloadProgress((prev) => new Map(prev).set(id, 1));
            setDownloads((prev) => {
              const next = new Set(prev);
              next.add(id);
              persistLocal(STORAGE_KEYS.downloads, next);
              return next;
            });
            setDownloadPaths((prev) => {
              const next = { ...prev, [id]: result.uri };
              persistDownloadPaths(next);
              return next;
            });
            if (userId) {
              const { contentType, contentId } = parseId(id);
              addDownload(userId, { contentType: contentType as "surah" | "episode", contentId, title: meta?.title ?? contentId });
            }
          }
        }
      } else if (Platform.OS === "web") {
        setDownloads((prev) => {
          const next = new Set(prev);
          next.add(id);
          persistLocal(STORAGE_KEYS.downloads, next);
          return next;
        });
        if (userId) {
          const { contentType, contentId } = parseId(id);
          addDownload(userId, { contentType: contentType as "surah" | "episode", contentId, title: meta?.title ?? contentId });
        }
      }
    } catch (err) {
      console.error("[startDownload] Failed:", err);
    } finally {
      setDownloadProgress((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
    }
  }, [userId]);

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
    } else if (meta?.audioUrl) {
      startDownload(id, meta.audioUrl, { title: meta.title });
    } else if (Platform.OS === "web") {
      setDownloads((prev) => {
        const next = new Set(prev);
        next.add(id);
        persistLocal(STORAGE_KEYS.downloads, next);
        return next;
      });
      if (userId) {
        const { contentType, contentId } = parseId(id);
        addDownload(userId, { contentType: contentType as "surah" | "episode", contentId, title: meta?.title ?? contentId });
      }
    }

    return added;
  }, [userId, downloads, startDownload, removeDownloadedFile]);

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
      }}
    >
      {children}
    </UserActionsContext.Provider>
  );
}

export const useUserActions = () => useContext(UserActionsContext);
