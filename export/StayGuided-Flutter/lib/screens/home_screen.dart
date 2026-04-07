import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../providers/app_providers.dart';
import '../widgets/series_card.dart';
import '../widgets/section_header.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final featuredAsync = ref.watch(featuredSeriesProvider);
    final popularAsync = ref.watch(popularSeriesProvider);
    final newAsync = ref.watch(newSeriesProvider);
    final profileAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      backgroundColor: AppConfig.bgPrimary,
      body: CustomScrollView(
        slivers: [
          // App bar
          SliverAppBar(
            backgroundColor: AppConfig.bgPrimary,
            expandedHeight: 90,
            floating: true,
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              title: Row(
                children: [
                  const Icon(Icons.headphones_rounded, color: AppConfig.gold, size: 24),
                  const SizedBox(width: 10),
                  Expanded(
                    child: profileAsync.when(
                      data: (profile) => Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'সালাম, ${profile?.displayName ?? 'বন্ধু'} 👋',
                            style: const TextStyle(color: AppConfig.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                          ),
                          const Text(
                            'আজকে কী শুনবেন?',
                            style: TextStyle(color: AppConfig.textSecondary, fontSize: 11),
                          ),
                        ],
                      ),
                      loading: () => const Text(AppConfig.appName, style: TextStyle(color: AppConfig.textPrimary, fontSize: 16)),
                      error: (_, __) => const Text(AppConfig.appName, style: TextStyle(color: AppConfig.textPrimary, fontSize: 16)),
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              IconButton(
                icon: const Icon(Icons.search_rounded, color: AppConfig.textPrimary),
                onPressed: () => context.go('/search'),
              ),
            ],
          ),

          // Featured
          SliverToBoxAdapter(
            child: featuredAsync.when(
              data: (series) => series.isEmpty ? const SizedBox() : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(20, 8, 20, 12),
                    child: Text('Featured', style: TextStyle(color: AppConfig.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
                  ),
                  SizedBox(
                    height: 220,
                    child: PageView.builder(
                      padEnds: false,
                      controller: PageController(viewportFraction: 0.88),
                      itemCount: series.length,
                      itemBuilder: (_, i) => Padding(
                        padding: const EdgeInsets.only(left: 20, right: 8),
                        child: FeaturedCard(series: series[i]),
                      ),
                    ),
                  ),
                ],
              ),
              loading: () => const SizedBox(height: 220, child: Center(child: CircularProgressIndicator(color: AppConfig.gold))),
              error: (_, __) => const SizedBox(),
            ),
          ),

          // Popular
          SliverToBoxAdapter(
            child: popularAsync.when(
              data: (series) => series.isEmpty ? const SizedBox() : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SectionHeader(title: 'Popular', onTap: () {}),
                  SizedBox(
                    height: 190,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: series.length,
                      itemBuilder: (_, i) => Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: SeriesCard(series: series[i]),
                      ),
                    ),
                  ),
                ],
              ),
              loading: () => const SizedBox(height: 190, child: Center(child: CircularProgressIndicator(color: AppConfig.gold))),
              error: (_, __) => const SizedBox(),
            ),
          ),

          // New Releases
          SliverToBoxAdapter(
            child: newAsync.when(
              data: (series) => series.isEmpty ? const SizedBox() : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SectionHeader(title: 'New Releases', onTap: () {}),
                  ...series.map((s) => Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                    child: _HorizontalSeriesRow(series: s),
                  )),
                ],
              ),
              loading: () => const SizedBox(height: 150, child: Center(child: CircularProgressIndicator(color: AppConfig.gold))),
              error: (_, __) => const SizedBox(),
            ),
          ),

          const SliverToBoxAdapter(child: SizedBox(height: 24)),
        ],
      ),
    );
  }
}

class FeaturedCard extends StatelessWidget {
  final dynamic series;
  const FeaturedCard({super.key, required this.series});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/series/${series.id}'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: AppConfig.bgCard,
          borderRadius: BorderRadius.circular(16),
          image: series.coverUrl != null
              ? DecorationImage(image: NetworkImage(series.coverUrl!), fit: BoxFit.cover, colorFilter: ColorFilter.mode(Colors.black.withOpacity(0.4), BlendMode.darken))
              : null,
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.3), blurRadius: 12, offset: const Offset(0, 4))],
        ),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (series.isPremium)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(color: AppConfig.gold, borderRadius: BorderRadius.circular(6)),
                  child: const Text('Premium', style: TextStyle(color: Colors.black, fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              const SizedBox(height: 6),
              Text(series.title, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold), maxLines: 2, overflow: TextOverflow.ellipsis),
              const SizedBox(height: 4),
              if (series.reciterName != null)
                Text(series.reciterName!, style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 13)),
            ],
          ),
        ),
      ),
    );
  }
}

class _HorizontalSeriesRow extends StatelessWidget {
  final dynamic series;
  const _HorizontalSeriesRow({required this.series});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/series/${series.id}'),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: AppConfig.bgCard,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: SizedBox(
                width: 60,
                height: 60,
                child: series.coverUrl != null
                    ? Image.network(series.coverUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _placeholder())
                    : _placeholder(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(series.title, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 14, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                  const SizedBox(height: 4),
                  if (series.reciterName != null)
                    Text(series.reciterName!, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 12)),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.play_circle_outline, color: AppConfig.gold, size: 14),
                      const SizedBox(width: 4),
                      Text('${series.playCount} plays', style: const TextStyle(color: AppConfig.textMuted, fontSize: 11)),
                      if (series.episodeCount > 0) ...[
                        const SizedBox(width: 8),
                        Text('${series.episodeCount} ep', style: const TextStyle(color: AppConfig.textMuted, fontSize: 11)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppConfig.textMuted),
          ],
        ),
      ),
    );
  }

  Widget _placeholder() => Container(
    color: AppConfig.bgElevated,
    child: const Icon(Icons.headphones_rounded, color: AppConfig.textMuted),
  );
}
