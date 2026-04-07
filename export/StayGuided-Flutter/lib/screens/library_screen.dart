import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../providers/app_providers.dart';
import '../widgets/series_card.dart';

class LibraryScreen extends ConsumerWidget {
  const LibraryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final savedAsync = ref.watch(savedSeriesProvider);
    final recentAsync = ref.watch(recentlyPlayedProvider);

    return Scaffold(
      backgroundColor: AppConfig.bgPrimary,
      appBar: AppBar(
        backgroundColor: AppConfig.bgPrimary,
        title: const Text('Library', style: TextStyle(fontWeight: FontWeight.bold)),
        automaticallyImplyLeading: false,
      ),
      body: DefaultTabController(
        length: 2,
        child: Column(
          children: [
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
              decoration: BoxDecoration(color: AppConfig.bgCard, borderRadius: BorderRadius.circular(12)),
              child: const TabBar(
                indicatorSize: TabBarIndicatorSize.tab,
                indicator: BoxDecoration(color: AppConfig.gold, borderRadius: BorderRadius.all(Radius.circular(10))),
                labelColor: Colors.black,
                unselectedLabelColor: AppConfig.textSecondary,
                tabs: [Tab(text: 'Saved'), Tab(text: 'Continue Listening')],
                labelStyle: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
              ),
            ),
            Expanded(
              child: TabBarView(
                children: [
                  // Saved
                  savedAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator(color: AppConfig.gold)),
                    error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppConfig.error))),
                    data: (series) => series.isEmpty
                        ? _emptyState(Icons.bookmark_outline, 'Saved series নেই', 'কোনো series এ bookmark icon চাপুন')
                        : GridView.builder(
                            padding: const EdgeInsets.all(20),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.78,
                            ),
                            itemCount: series.length,
                            itemBuilder: (_, i) => SeriesCard(series: series[i]),
                          ),
                  ),

                  // Continue Listening
                  recentAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator(color: AppConfig.gold)),
                    error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppConfig.error))),
                    data: (items) => items.isEmpty
                        ? _emptyState(Icons.headphones_outlined, 'এখনো কিছু শোনেননি', 'Home থেকে series শুরু করুন')
                        // recentlyPlayedProvider returns rows from listening_history:
                        // { content_id, series_id, title, series_name, duration_ms, listened_at }
                        : ListView.builder(
                            padding: const EdgeInsets.all(20),
                            itemCount: items.length,
                            itemBuilder: (_, i) {
                              final item = items[i];
                              final title = item['title']?.toString() ?? '';
                              final seriesName = item['series_name']?.toString() ?? '';
                              final seriesId = item['series_id']?.toString();
                              return ListTile(
                                contentPadding: const EdgeInsets.symmetric(vertical: 4),
                                leading: Container(
                                  width: 56,
                                  height: 56,
                                  decoration: BoxDecoration(
                                    color: AppConfig.bgCard,
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Icon(Icons.headphones_rounded, color: AppConfig.gold),
                                ),
                                title: Text(title, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                                subtitle: Text(seriesName, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 12)),
                                trailing: const Icon(Icons.play_circle_outline, color: AppConfig.gold),
                                onTap: () {
                                  if (seriesId != null) context.push('/series/$seriesId');
                                },
                              );
                            },
                          ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _emptyState(IconData icon, String title, String subtitle) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 56, color: AppConfig.textMuted),
        const SizedBox(height: 16),
        Text(title, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Text(subtitle, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 13), textAlign: TextAlign.center),
      ],
    ),
  );
}
