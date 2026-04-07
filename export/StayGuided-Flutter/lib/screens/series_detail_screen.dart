import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../providers/app_providers.dart';
import '../services/supabase_service.dart';

class SeriesDetailScreen extends ConsumerStatefulWidget {
  final String seriesId;
  const SeriesDetailScreen({super.key, required this.seriesId});

  @override
  ConsumerState<SeriesDetailScreen> createState() => _SeriesDetailScreenState();
}

class _SeriesDetailScreenState extends ConsumerState<SeriesDetailScreen> {
  bool _saved = false;

  @override
  void initState() {
    super.initState();
    _checkSaved();
  }

  Future<void> _checkSaved() async {
    final saved = await SupabaseService().isSeriesSaved(widget.seriesId);
    if (mounted) setState(() => _saved = saved);
  }

  Future<void> _toggleSave() async {
    if (_saved) {
      await SupabaseService().unsaveSeries(widget.seriesId);
    } else {
      await SupabaseService().saveSeries(widget.seriesId);
    }
    setState(() => _saved = !_saved);
  }

  @override
  Widget build(BuildContext context) {
    final seriesAsync = ref.watch(seriesDetailProvider(widget.seriesId));
    final episodesAsync = ref.watch(episodesProvider(widget.seriesId));
    final audioService = ref.watch(audioServiceProvider);

    return Scaffold(
      backgroundColor: AppConfig.bgPrimary,
      body: seriesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppConfig.gold)),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppConfig.error))),
        data: (series) {
          if (series == null) return const Center(child: Text('Series পাওয়া যায়নি', style: TextStyle(color: AppConfig.textSecondary)));

          return CustomScrollView(
            slivers: [
              // Header image
              SliverAppBar(
                expandedHeight: 280,
                pinned: true,
                backgroundColor: AppConfig.bgPrimary,
                leading: IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(10)),
                    child: const Icon(Icons.arrow_back_ios_new, size: 18, color: Colors.white),
                  ),
                  onPressed: () => context.pop(),
                ),
                actions: [
                  IconButton(
                    icon: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: Colors.black45, borderRadius: BorderRadius.circular(10)),
                      child: Icon(_saved ? Icons.bookmark : Icons.bookmark_outline, size: 20, color: _saved ? AppConfig.gold : Colors.white),
                    ),
                    onPressed: _toggleSave,
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (series.coverUrl != null)
                        Image.network(series.coverUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => Container(color: AppConfig.bgCard))
                      else
                        Container(color: AppConfig.bgCard, child: const Icon(Icons.headphones_rounded, size: 80, color: AppConfig.textMuted)),
                      const DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [Colors.transparent, AppConfig.bgPrimary],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Series info
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (series.isPremium)
                        Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(color: AppConfig.gold.withOpacity(0.15), borderRadius: BorderRadius.circular(6), border: Border.all(color: AppConfig.gold.withOpacity(0.3))),
                          child: const Text('Premium Content', style: TextStyle(color: AppConfig.gold, fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      Text(series.title, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 22, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      if (series.reciterName != null)
                        Row(
                          children: [
                            const Icon(Icons.mic_rounded, size: 16, color: AppConfig.gold),
                            const SizedBox(width: 6),
                            Text(series.reciterName!, style: const TextStyle(color: AppConfig.gold, fontSize: 14)),
                          ],
                        ),
                      const SizedBox(height: 12),
                      Text(series.description, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 14, height: 1.6)),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          _stat(Icons.headphones_rounded, '${series.playCount}'),
                          const SizedBox(width: 20),
                          _stat(Icons.playlist_play, '${series.episodeCount} episodes'),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Episodes
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                  child: Text('Episodes', style: const TextStyle(color: AppConfig.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                ),
              ),

              episodesAsync.when(
                loading: () => const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: AppConfig.gold)))),
                error: (e, _) => SliverToBoxAdapter(child: Center(child: Text('Error: $e'))),
                data: (episodes) => SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) {
                      final ep = episodes[i];
                      final isCurrent = audioService.currentEpisode?.id == ep.id;
                      return ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                        leading: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: isCurrent ? AppConfig.gold : AppConfig.bgCard,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Icon(
                            isCurrent && audioService.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                            color: isCurrent ? Colors.black : AppConfig.textSecondary,
                          ),
                        ),
                        title: Text(
                          '${ep.episodeNumber}. ${ep.title}',
                          style: TextStyle(color: isCurrent ? AppConfig.gold : AppConfig.textPrimary, fontSize: 14, fontWeight: FontWeight.w500),
                          maxLines: 2,
                        ),
                        subtitle: Text(ep.formattedDuration, style: const TextStyle(color: AppConfig.textMuted, fontSize: 12)),
                        trailing: ep.isPremium ? const Icon(Icons.lock_rounded, size: 16, color: AppConfig.gold) : null,
                        onTap: () {
                          if (ep.audioUrl != null && ep.audioUrl!.isNotEmpty) {
                            audioService.play(ep, series);
                          }
                        },
                      );
                    },
                    childCount: episodes.length,
                  ),
                ),
              ),

              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          );
        },
      ),
    );
  }

  Widget _stat(IconData icon, String text) => Row(
    children: [
      Icon(icon, size: 15, color: AppConfig.textMuted),
      const SizedBox(width: 5),
      Text(text, style: const TextStyle(color: AppConfig.textMuted, fontSize: 13)),
    ],
  );
}
