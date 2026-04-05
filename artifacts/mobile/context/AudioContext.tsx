import { Audio } from "expo-av";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import { addToHistory, addXp, saveProgress, updateHistoryDuration, updateStreak } from "@/lib/db";
import { SURAHS } from "@/constants/surahs";
import { useContent } from "@/context/ContentContext";

export interface NowPlaying {
  id: string;
  title: string;
  seriesName: string;
  episodeNum?: string;
  coverColor: string;
  coverUrl?: string;
  audioUrl: string;
  type: "quran" | "story";
  surahNumber?: number;
  seriesId?: string;
  episodeIndex?: number;
}

export type RepeatMode = "off" | "all" | "one";

interface AudioContextType {
  nowPlaying: NowPlaying | null;
  isPlaying: boolean;
  isLoading: boolean;
  position: number;
  duration: number;
  playbackSpeed: number;
  repeatMode: RepeatMode;
  setRepeatMode: (mode: RepeatMode) => void;
  play: (content: NowPlaying, userId?: string) => Promise<void>;
  pause: (userId?: string) => Promise<void>;
  resume: (userId?: string) => Promise<void>;
  stop: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  skipForward: () => Promise<void>;
  skipBack: () => Promise<void>;
  setSpeed: (speed: number) => Promise<void>;
  playNext: () => Promise<void>;
}

const AudioCtx = createContext<AudioContextType | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const { series: contentSeries } = useContent();
  const contentSeriesRef = useRef(contentSeries);
  contentSeriesRef.current = contentSeries;
  const soundRef = useRef<Audio.Sound | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [repeatMode, setRepeatModeState] = useState<RepeatMode>("off");
  const repeatModeRef = useRef<RepeatMode>("off");
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const nowPlayingRef = useRef<NowPlaying | null>(null);
  const userIdRef = useRef<string | undefined>(undefined);
  const historyIdRef = useRef<string | null>(null);
  const progressSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playNextRef = useRef<() => Promise<void>>(async () => {});

  const setRepeatMode = useCallback((mode: RepeatMode) => {
    repeatModeRef.current = mode;
    setRepeatModeState(mode);
  }, []);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    return () => {
      soundRef.current?.unloadAsync();
      if (progressSaveTimer.current) clearInterval(progressSaveTimer.current);
    };
  }, []);

  const startProgressSync = useCallback((userId: string) => {
    if (progressSaveTimer.current) clearInterval(progressSaveTimer.current);
    progressSaveTimer.current = setInterval(async () => {
      const np = nowPlayingRef.current;
      if (!np || positionRef.current === 0) return;
      const contentType = np.type === "quran" ? "surah" : "episode";
      const contentId = np.surahNumber?.toString() ?? np.id;
      await saveProgress(userId, contentType, contentId, positionRef.current, durationRef.current);
      if (historyIdRef.current && positionRef.current > 0) {
        updateHistoryDuration(historyIdRef.current, positionRef.current);
      }
    }, 15000);
  }, []);

  const stopProgressSync = useCallback(() => {
    if (progressSaveTimer.current) {
      clearInterval(progressSaveTimer.current);
      progressSaveTimer.current = null;
    }
  }, []);

  const play = useCallback(async (content: NowPlaying, userId?: string) => {
    try {
      setIsLoading(true);
      stopProgressSync();
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      setNowPlaying(content);
      nowPlayingRef.current = content;
      setPosition(0);
      positionRef.current = 0;
      setIsPlaying(false);

      historyIdRef.current = null;
      if (userId) {
        userIdRef.current = userId;
        addToHistory(userId, {
          contentType: content.type === "quran" ? "surah" : "episode",
          contentId: content.surahNumber?.toString() ?? content.id,
          title: content.title,
          seriesName: content.seriesName,
          seriesId: content.seriesId,
        }).then((id) => { historyIdRef.current = id; });
        addXp(userId, 5, `Started: ${content.title}`);
        updateStreak(userId);
        startProgressSync(userId);
      } else if (userIdRef.current) {
        // playNext() calls play() without userId — reuse the stored one
        const uid = userIdRef.current;
        addToHistory(uid, {
          contentType: content.type === "quran" ? "surah" : "episode",
          contentId: content.surahNumber?.toString() ?? content.id,
          title: content.title,
          seriesName: content.seriesName,
          seriesId: content.seriesId,
        }).then((id) => { historyIdRef.current = id; });
        addXp(uid, 5, `Started: ${content.title}`);
        updateStreak(uid);
        startProgressSync(uid);
      }

      if (!content.audioUrl) {
        setNowPlaying(null);
        nowPlayingRef.current = null;
        throw new Error("Audio not available yet. This episode will be released soon, inshallah.");
      }

      let audioUri = content.audioUrl;
      if (Platform.OS !== "web") {
        try {
          const pathsRaw = await AsyncStorage.getItem("user_download_paths");
          if (pathsRaw) {
            const paths = JSON.parse(pathsRaw) as Record<string, string>;
            const localPath = paths[content.id];
            if (localPath) {
              const legacy = await import("expo-file-system/legacy");
              const info = await legacy.getInfoAsync(localPath);
              if (info.exists) {
                audioUri = localPath;
              }
            }
          }
        } catch {}
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, rate: playbackSpeed, isLooping: false },
        (status) => {
          if (status.isLoaded) {
            const pos = status.positionMillis ?? 0;
            setPosition(pos);
            positionRef.current = pos;
            const dur = status.durationMillis ?? 0;
            setDuration(dur);
            durationRef.current = dur;
            setIsPlaying(status.isPlaying ?? false);
            if (status.didJustFinish && !status.isLooping) {
              if (historyIdRef.current && durationRef.current > 0) {
                updateHistoryDuration(historyIdRef.current, durationRef.current);
              }
              if (repeatModeRef.current === "one") {
                soundRef.current?.setPositionAsync(0).then(() => soundRef.current?.playAsync());
              } else {
                playNextRef.current();
              }
            }
          }
        }
      );
      soundRef.current = sound;
      setIsPlaying(true);
    } finally {
      setIsLoading(false);
    }
  }, [playbackSpeed, startProgressSync, stopProgressSync]);

  const pause = useCallback(async (userId?: string) => {
    await soundRef.current?.pauseAsync();
    setIsPlaying(false);
    if (userId && nowPlayingRef.current) {
      const np = nowPlayingRef.current;
      const contentType = np.type === "quran" ? "surah" : "episode";
      saveProgress(userId, contentType, np.surahNumber?.toString() ?? np.id, positionRef.current, durationRef.current);
    }
    if (historyIdRef.current && positionRef.current > 0) {
      updateHistoryDuration(historyIdRef.current, positionRef.current);
    }
  }, []);

  const resume = useCallback(async (userId?: string) => {
    await soundRef.current?.playAsync();
    setIsPlaying(true);
    if (userId) startProgressSync(userId);
  }, [startProgressSync]);

  const stop = useCallback(async () => {
    stopProgressSync();
    await soundRef.current?.stopAsync();
    await soundRef.current?.unloadAsync();
    soundRef.current = null;
    setIsPlaying(false);
    setNowPlaying(null);
    nowPlayingRef.current = null;
    setPosition(0);
    positionRef.current = 0;
    setDuration(0);
    durationRef.current = 0;
  }, [stopProgressSync]);

  const seek = useCallback(async (positionMs: number) => {
    await soundRef.current?.setPositionAsync(positionMs);
    setPosition(positionMs);
    positionRef.current = positionMs;
  }, []);

  const skipForward = useCallback(async () => {
    const newPos = Math.min(positionRef.current + 10000, durationRef.current);
    await seek(newPos);
  }, [seek]);

  const skipBack = useCallback(async () => {
    const newPos = Math.max(positionRef.current - 10000, 0);
    await seek(newPos);
  }, [seek]);

  const setSpeed = useCallback(async (speed: number) => {
    setPlaybackSpeed(speed);
    await soundRef.current?.setRateAsync(speed, true);
  }, []);

  const playNext = useCallback(async () => {
    const np = nowPlayingRef.current;
    if (!np) return;

    if (np.type === "quran") {
      const surahNum = np.surahNumber ?? 1;
      if (surahNum < 114) {
        const nextNum = surahNum + 1;
        const nextSurah = SURAHS.find((s) => s.number === nextNum);
        if (nextSurah) {
          await play({
            id: `surah_${nextNum}`,
            title: nextSurah.nameSimple,
            seriesName: `Surah ${nextNum}`,
            coverColor: "#0a2018",
            audioUrl: `https://cdn.islamic.network/quran/audio-surah/128/ar.alafasy/${nextNum}.mp3`,
            type: "quran",
            surahNumber: nextNum,
          });
        }
      }
    } else {
      const allSeries = contentSeriesRef.current;
      const series = np.seriesId
        ? allSeries.find((s) => s.id === np.seriesId)
        : allSeries.find((s) => s.episodes.some((ep) => ep.id === np.id));
      if (!series) return;
      const epIdx = np.episodeIndex ?? series.episodes.findIndex((ep) => ep.id === np.id);
      const safeIdx = epIdx >= 0 ? epIdx : 0;
      // Find the next episode that actually has audio
      let nextEp = null;
      let nextIdx = safeIdx + 1;
      while (nextIdx < series.episodes.length) {
        if (series.episodes[nextIdx].hasAudio) {
          nextEp = series.episodes[nextIdx];
          break;
        }
        nextIdx++;
      }
      if (nextEp) {
        await play({
          id: nextEp.id,
          title: nextEp.title,
          seriesName: series.title,
          episodeNum: `Episode ${nextEp.number}`,
          coverColor: series.coverColor,
          coverUrl: nextEp.coverUrl || series.coverUrl,
          audioUrl: nextEp.audioUrl,
          type: "story",
          seriesId: series.id,
          episodeIndex: nextIdx,
        });
      }
    }
  }, [play]);

  useEffect(() => { playNextRef.current = playNext; }, [playNext]);

  return (
    <AudioCtx.Provider value={{ nowPlaying, isPlaying, isLoading, position, duration, playbackSpeed, repeatMode, setRepeatMode, play, pause, resume, stop, seek, skipForward, skipBack, setSpeed, playNext }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
