import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addToHistory, addXp, saveProgress, updateHistoryDuration, updateStreak } from "@/lib/db";
import { SURAHS } from "@/constants/surahs";
import { useContent } from "@/context/ContentContext";
import { useAuth } from "@/context/AuthContext";

// ── Try to load react-native-track-player (production builds only, not Expo Go) ──
let _TrackPlayer: any = null;
let _Capability: any = null;
let _State: any = null;
let _Event: any = null;

const TRACK_PLAYER_AVAILABLE = (() => {
  if (Platform.OS === "web") return false;
  try {
    const tp = require("react-native-track-player");
    _TrackPlayer = tp.default;
    _Capability = tp.Capability;
    _State = tp.State;
    _Event = tp.Event;
    return true;
  } catch {
    return false;
  }
})();

// ── expo-av fallback (Expo Go) ─────────────────────────────────────────────────
let _Audio: any = null;
if (!TRACK_PLAYER_AVAILABLE && Platform.OS !== "web") {
  try {
    _Audio = require("expo-av").Audio;
  } catch {}
}

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

  const { user } = useAuth();
  const isPremiumRef = useRef(false);
  useEffect(() => {
    isPremiumRef.current = user?.isPremium ?? false;
  }, [user?.isPremium]);

  const soundRef = useRef<any>(null);
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
  const positionPollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const playNextRef = useRef<() => Promise<void>>(async () => {});

  const playSegmentStartRef = useRef<number | null>(null);
  const accListenedMsRef = useRef<number>(0);

  const getElapsedListenedMs = useCallback(() => {
    const segmentMs = playSegmentStartRef.current ? Date.now() - playSegmentStartRef.current : 0;
    return accListenedMsRef.current + segmentMs;
  }, []);

  const setRepeatMode = useCallback((mode: RepeatMode) => {
    repeatModeRef.current = mode;
    setRepeatModeState(mode);
  }, []);

  // ── Background playback gate: non-premium users get paused when app backgrounds ──
  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state: AppStateStatus) => {
      if (state !== "background") return;
      if (isPremiumRef.current) return;
      if (!isPlayingRef.current) return;
      try {
        if (TRACK_PLAYER_AVAILABLE) {
          await _TrackPlayer.pause();
        } else {
          await soundRef.current?.pauseAsync();
        }
        setIsPlaying(false);
        if (playSegmentStartRef.current) {
          accListenedMsRef.current += Date.now() - playSegmentStartRef.current;
          playSegmentStartRef.current = null;
        }
      } catch {}
    });
    return () => sub.remove();
  }, []);

  // ── Initialize audio engine ──────────────────────────────────────────────────
  useEffect(() => {
    if (TRACK_PLAYER_AVAILABLE) {
      const setup = async () => {
        try {
          await _TrackPlayer.setupPlayer({ maxCacheSize: 1024 * 5 });
          await _TrackPlayer.updateOptions({
            capabilities: [
              _Capability.Play,
              _Capability.Pause,
              _Capability.SkipToNext,
              _Capability.SeekTo,
              _Capability.JumpForward,
              _Capability.JumpBackward,
              _Capability.Stop,
            ],
            compactCapabilities: [
              _Capability.Play,
              _Capability.Pause,
              _Capability.SkipToNext,
            ],
            progressUpdateEventInterval: 2,
            jumpInterval: 10,
          });
        } catch {
          // Already initialized or not available
        }
      };
      setup();
    } else if (_Audio) {
      _Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
    }

    return () => {
      if (TRACK_PLAYER_AVAILABLE) {
        try { _TrackPlayer.stop(); } catch {}
        try { _TrackPlayer.reset(); } catch {}
      } else {
        soundRef.current?.unloadAsync().catch(() => {});
      }
      if (progressSaveTimer.current) clearInterval(progressSaveTimer.current);
      if (positionPollTimer.current) clearInterval(positionPollTimer.current);
    };
  }, []);

  // ── TrackPlayer: position polling ────────────────────────────────────────────
  const startPositionPolling = useCallback(() => {
    if (!TRACK_PLAYER_AVAILABLE) return;
    if (positionPollTimer.current) clearInterval(positionPollTimer.current);
    positionPollTimer.current = setInterval(async () => {
      try {
        const progress = await _TrackPlayer.getProgress();
        if (!progress) return;
        const posMs = (progress.position ?? 0) * 1000;
        const durMs = (progress.duration ?? 0) * 1000;
        setPosition(posMs);
        positionRef.current = posMs;
        if (durMs > 0) {
          setDuration(durMs);
          durationRef.current = durMs;
        }
      } catch {}
    }, 500);
  }, []);

  const stopPositionPolling = useCallback(() => {
    if (positionPollTimer.current) {
      clearInterval(positionPollTimer.current);
      positionPollTimer.current = null;
    }
  }, []);

  // ── TrackPlayer: playback state & queue ended events ─────────────────────────
  useEffect(() => {
    if (!TRACK_PLAYER_AVAILABLE) return;
    const sub1 = _TrackPlayer.addEventListener(_Event.PlaybackQueueEnded, async () => {
      if (repeatModeRef.current === "one") {
        try { await _TrackPlayer.seekTo(0); await _TrackPlayer.play(); } catch {}
      } else {
        await playNextRef.current();
      }
    });
    const sub2 = _TrackPlayer.addEventListener(_Event.PlaybackState, (state: any) => {
      const s = state?.state ?? state;
      const playing = s === _State.Playing;
      const loading = s === _State.Loading || s === _State.Buffering;
      setIsPlaying(playing);
      if (!playing && !loading) setIsLoading(false);
    });
    const sub3 = _TrackPlayer.addEventListener(_Event.PlaybackError, () => {
      setIsLoading(false);
      setIsPlaying(false);
    });
    return () => {
      sub1?.remove?.();
      sub2?.remove?.();
      sub3?.remove?.();
    };
  }, []);

  // ── Progress sync (save to DB every 15 s) ────────────────────────────────────
  const startProgressSync = useCallback((userId: string) => {
    if (progressSaveTimer.current) clearInterval(progressSaveTimer.current);
    progressSaveTimer.current = setInterval(async () => {
      const np = nowPlayingRef.current;
      if (!np) return;
      const contentType = np.type === "quran" ? "surah" : "episode";
      const contentId = np.surahNumber?.toString() ?? np.id;
      const pos = positionRef.current > 0 ? positionRef.current : getElapsedListenedMs();
      await saveProgress(userId, contentType, contentId, pos, durationRef.current);
      const listenedMs = getElapsedListenedMs();
      if (historyIdRef.current && listenedMs > 0) {
        updateHistoryDuration(historyIdRef.current, listenedMs);
      }
    }, 15000);
  }, [getElapsedListenedMs]);

  const stopProgressSync = useCallback(() => {
    if (progressSaveTimer.current) {
      clearInterval(progressSaveTimer.current);
      progressSaveTimer.current = null;
    }
  }, []);

  // ── play ─────────────────────────────────────────────────────────────────────
  const play = useCallback(async (content: NowPlaying, userId?: string) => {
    try {
      setIsLoading(true);
      stopProgressSync();
      setNowPlaying(content);
      nowPlayingRef.current = content;
      setPosition(0);
      positionRef.current = 0;
      setIsPlaying(false);
      historyIdRef.current = null;
      accListenedMsRef.current = 0;
      playSegmentStartRef.current = Date.now();

      const activeUserId = userId ?? userIdRef.current;
      if (activeUserId) {
        userIdRef.current = activeUserId;
        addToHistory(activeUserId, {
          contentType: content.type === "quran" ? "surah" : "episode",
          contentId: content.surahNumber?.toString() ?? content.id,
          title: content.title,
          seriesName: content.seriesName,
          seriesId: content.seriesId,
        }).then((id) => { historyIdRef.current = id; });
        addXp(activeUserId, 5, `Started: ${content.title}`);
        updateStreak(activeUserId);
        startProgressSync(activeUserId);
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
              if (info.exists) audioUri = localPath;
            }
          }
        } catch {}
      }

      if (TRACK_PLAYER_AVAILABLE) {
        await _TrackPlayer.reset();
        await _TrackPlayer.add({
          id: content.id,
          url: audioUri,
          title: content.title,
          artist: content.seriesName,
          artwork: content.coverUrl ?? undefined,
        });
        await _TrackPlayer.setRate(playbackSpeed);
        await _TrackPlayer.play();
        startPositionPolling();
        setIsPlaying(true);
      } else if (_Audio) {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        const { sound } = await _Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true, rate: playbackSpeed, isLooping: false },
          (status: any) => {
            if (status.isLoaded) {
              const pos = status.positionMillis ?? 0;
              setPosition(pos);
              positionRef.current = pos;
              const dur = status.durationMillis ?? 0;
              setDuration(dur);
              durationRef.current = dur;
              setIsPlaying(status.isPlaying ?? false);
              if (status.didJustFinish && !status.isLooping) {
                if (playSegmentStartRef.current) {
                  accListenedMsRef.current += Date.now() - playSegmentStartRef.current;
                  playSegmentStartRef.current = null;
                }
                const finalMs = accListenedMsRef.current > 0 ? accListenedMsRef.current : durationRef.current;
                if (historyIdRef.current && finalMs > 0) updateHistoryDuration(historyIdRef.current, finalMs);
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
      }
    } finally {
      setIsLoading(false);
    }
  }, [playbackSpeed, startProgressSync, stopProgressSync, startPositionPolling]);

  // ── pause ────────────────────────────────────────────────────────────────────
  const pause = useCallback(async (userId?: string) => {
    if (playSegmentStartRef.current) {
      accListenedMsRef.current += Date.now() - playSegmentStartRef.current;
      playSegmentStartRef.current = null;
    }
    if (TRACK_PLAYER_AVAILABLE) {
      stopPositionPolling();
      await _TrackPlayer.pause();
    } else {
      await soundRef.current?.pauseAsync();
    }
    setIsPlaying(false);
    if (userId && nowPlayingRef.current) {
      const np = nowPlayingRef.current;
      const contentType = np.type === "quran" ? "surah" : "episode";
      const pos = positionRef.current > 0 ? positionRef.current : accListenedMsRef.current;
      saveProgress(userId, contentType, np.surahNumber?.toString() ?? np.id, pos, durationRef.current);
    }
    if (historyIdRef.current && accListenedMsRef.current > 0) {
      updateHistoryDuration(historyIdRef.current, accListenedMsRef.current);
    }
  }, [stopPositionPolling]);

  // ── resume ───────────────────────────────────────────────────────────────────
  const resume = useCallback(async (userId?: string) => {
    playSegmentStartRef.current = Date.now();
    if (TRACK_PLAYER_AVAILABLE) {
      await _TrackPlayer.play();
      startPositionPolling();
    } else {
      await soundRef.current?.playAsync();
    }
    setIsPlaying(true);
    if (userId) startProgressSync(userId);
  }, [startProgressSync, startPositionPolling]);

  // ── stop ─────────────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    stopProgressSync();
    stopPositionPolling();
    if (playSegmentStartRef.current) {
      accListenedMsRef.current += Date.now() - playSegmentStartRef.current;
      playSegmentStartRef.current = null;
    }
    if (TRACK_PLAYER_AVAILABLE) {
      try { await _TrackPlayer.stop(); } catch {}
      try { await _TrackPlayer.reset(); } catch {}
    } else {
      await soundRef.current?.stopAsync().catch(() => {});
      await soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
    setNowPlaying(null);
    nowPlayingRef.current = null;
    setPosition(0);
    positionRef.current = 0;
    setDuration(0);
    durationRef.current = 0;
    accListenedMsRef.current = 0;
  }, [stopProgressSync, stopPositionPolling]);

  // ── seek ─────────────────────────────────────────────────────────────────────
  const seek = useCallback(async (positionMs: number) => {
    if (TRACK_PLAYER_AVAILABLE) {
      await _TrackPlayer.seekTo(positionMs / 1000);
    } else {
      await soundRef.current?.setPositionAsync(positionMs);
    }
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

  // ── setSpeed ─────────────────────────────────────────────────────────────────
  const setSpeed = useCallback(async (speed: number) => {
    setPlaybackSpeed(speed);
    if (TRACK_PLAYER_AVAILABLE) {
      await _TrackPlayer.setRate(speed);
    } else {
      await soundRef.current?.setRateAsync(speed, true);
    }
  }, []);

  // ── playNext ─────────────────────────────────────────────────────────────────
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
    <AudioCtx.Provider value={{
      nowPlaying, isPlaying, isLoading, position, duration, playbackSpeed,
      repeatMode, setRepeatMode, play, pause, resume, stop, seek,
      skipForward, skipBack, setSpeed, playNext,
    }}>
      {children}
    </AudioCtx.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
