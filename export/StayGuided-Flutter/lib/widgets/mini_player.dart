import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../providers/app_providers.dart';

class MiniPlayer extends ConsumerWidget {
  const MiniPlayer({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final audio = ref.watch(audioServiceProvider);
    if (!audio.hasAudio) return const SizedBox.shrink();

    final episode = audio.currentEpisode!;
    final series = audio.currentSeries;

    return GestureDetector(
      onTap: () => context.push('/player'),
      child: Container(
        height: 68,
        decoration: BoxDecoration(
          color: AppConfig.bgCard,
          border: Border(top: BorderSide(color: AppConfig.gold.withOpacity(0.2))),
        ),
        child: Column(
          children: [
            // Progress line
            LinearProgressIndicator(
              value: audio.progress,
              backgroundColor: AppConfig.bgElevated,
              valueColor: const AlwaysStoppedAnimation<Color>(AppConfig.gold),
              minHeight: 2,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    // Cover
                    ClipRRect(
                      borderRadius: BorderRadius.circular(6),
                      child: SizedBox(
                        width: 42,
                        height: 42,
                        child: series?.coverUrl != null
                            ? Image.network(series!.coverUrl!, fit: BoxFit.cover)
                            : Container(color: AppConfig.bgElevated, child: const Icon(Icons.headphones_rounded, color: AppConfig.textMuted, size: 20)),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Title
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(episode.title, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 13, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                          if (series != null)
                            Text(series.title, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                        ],
                      ),
                    ),

                    // Controls
                    IconButton(
                      icon: const Icon(Icons.replay_15_rounded, size: 22),
                      color: AppConfig.textSecondary,
                      onPressed: audio.skipBackward,
                      padding: const EdgeInsets.all(8),
                      constraints: const BoxConstraints(),
                    ),
                    IconButton(
                      icon: audio.isLoading
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2, color: AppConfig.gold))
                          : Icon(audio.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 28, color: AppConfig.gold),
                      onPressed: audio.togglePlay,
                      padding: const EdgeInsets.all(4),
                      constraints: const BoxConstraints(),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 20),
                      color: AppConfig.textMuted,
                      onPressed: audio.stop,
                      padding: const EdgeInsets.all(8),
                      constraints: const BoxConstraints(),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
