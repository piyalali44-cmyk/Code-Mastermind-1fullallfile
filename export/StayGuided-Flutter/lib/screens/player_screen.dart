import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../providers/app_providers.dart';

class PlayerScreen extends ConsumerStatefulWidget {
  const PlayerScreen({super.key});

  @override
  ConsumerState<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends ConsumerState<PlayerScreen> {
  final List<double> _speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  @override
  Widget build(BuildContext context) {
    final audio = ref.watch(audioServiceProvider);
    final episode = audio.currentEpisode;
    final series = audio.currentSeries;

    if (episode == null) {
      return Scaffold(
        backgroundColor: AppConfig.bgPrimary,
        appBar: AppBar(backgroundColor: AppConfig.bgPrimary),
        body: const Center(child: Text('কোনো audio চলছে না', style: TextStyle(color: AppConfig.textSecondary))),
      );
    }

    return Scaffold(
      backgroundColor: AppConfig.bgPrimary,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 28),
          onPressed: () => context.pop(),
        ),
        title: const Text('Now Playing', style: TextStyle(fontSize: 14, color: AppConfig.textSecondary)),
        actions: [
          IconButton(
            icon: const Icon(Icons.more_vert, color: AppConfig.textSecondary),
            onPressed: () => _showSpeedSelector(context, audio),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 28),
        child: Column(
          children: [
            const SizedBox(height: 20),

            // Cover Art
            Expanded(
              flex: 4,
              child: Hero(
                tag: 'player_cover',
                child: Container(
                  decoration: BoxDecoration(
                    color: AppConfig.bgCard,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [BoxShadow(color: AppConfig.gold.withOpacity(0.15), blurRadius: 40, spreadRadius: 5)],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: series?.coverUrl != null
                      ? Image.network(series!.coverUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _coverPlaceholder())
                      : _coverPlaceholder(),
                ),
              ),
            ),

            const SizedBox(height: 32),

            // Title and artist
            Column(
              children: [
                Text(
                  episode.title,
                  style: const TextStyle(color: AppConfig.textPrimary, fontSize: 20, fontWeight: FontWeight.bold),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 6),
                if (series != null)
                  Text(series.title, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 14)),
              ],
            ),

            const SizedBox(height: 32),

            // Progress bar
            Column(
              children: [
                SliderTheme(
                  data: SliderTheme.of(context).copyWith(
                    activeTrackColor: AppConfig.gold,
                    inactiveTrackColor: AppConfig.bgElevated,
                    thumbColor: AppConfig.gold,
                    overlayColor: AppConfig.gold.withOpacity(0.15),
                    thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 8),
                    trackHeight: 4,
                  ),
                  child: Slider(
                    value: audio.progress,
                    onChanged: (val) {
                      final target = Duration(milliseconds: (audio.duration.inMilliseconds * val).toInt());
                      audio.seekTo(target);
                    },
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(_formatDuration(audio.position), style: const TextStyle(color: AppConfig.textMuted, fontSize: 12)),
                      Text(_formatDuration(audio.duration), style: const TextStyle(color: AppConfig.textMuted, fontSize: 12)),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // Controls
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                // Speed
                GestureDetector(
                  onTap: () => _showSpeedSelector(context, audio),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(color: AppConfig.bgCard, borderRadius: BorderRadius.circular(8)),
                    child: Text(
                      '${audio.speed}x',
                      style: const TextStyle(color: AppConfig.gold, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ),
                ),

                // Skip back 15s
                IconButton(
                  icon: const Icon(Icons.replay_15_rounded, size: 36),
                  color: AppConfig.textPrimary,
                  onPressed: audio.skipBackward,
                ),

                // Play/Pause
                GestureDetector(
                  onTap: audio.togglePlay,
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppConfig.gold, AppConfig.goldLight], begin: Alignment.topLeft, end: Alignment.bottomRight),
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: AppConfig.gold.withOpacity(0.4), blurRadius: 20, spreadRadius: 2)],
                    ),
                    child: audio.isLoading
                        ? const Center(child: SizedBox(width: 28, height: 28, child: CircularProgressIndicator(color: Colors.black, strokeWidth: 3)))
                        : Icon(audio.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded, size: 38, color: Colors.black),
                  ),
                ),

                // Skip forward 30s
                IconButton(
                  icon: const Icon(Icons.forward_30_rounded, size: 36),
                  color: AppConfig.textPrimary,
                  onPressed: audio.skipForward,
                ),

                const SizedBox(width: 44),
              ],
            ),

            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _coverPlaceholder() => Container(
    color: AppConfig.bgElevated,
    child: const Center(child: Icon(Icons.headphones_rounded, size: 80, color: AppConfig.textMuted)),
  );

  String _formatDuration(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes % 60;
    final s = d.inSeconds % 60;
    if (h > 0) return '${h}:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    return '${m}:${s.toString().padLeft(2, '0')}';
  }

  void _showSpeedSelector(BuildContext context, dynamic audio) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppConfig.bgCard,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Playback Speed', style: TextStyle(color: AppConfig.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Wrap(
              spacing: 10,
              children: _speeds.map((s) => ChoiceChip(
                label: Text('${s}x'),
                selected: audio.speed == s,
                onSelected: (_) { audio.setSpeed(s); Navigator.pop(context); },
                selectedColor: AppConfig.gold,
                backgroundColor: AppConfig.bgElevated,
                labelStyle: TextStyle(color: audio.speed == s ? Colors.black : AppConfig.textPrimary, fontWeight: FontWeight.bold),
              )).toList(),
            ),
            const SizedBox(height: 10),
          ],
        ),
      ),
    );
  }
}
