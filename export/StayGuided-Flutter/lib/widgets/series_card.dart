import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../models/models.dart';

class SeriesCard extends StatelessWidget {
  final Series series;
  const SeriesCard({super.key, required this.series});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/series/${series.id}'),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Cover
          Expanded(
            child: Stack(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: SizedBox.expand(
                    child: series.coverUrl != null
                        ? Image.network(series.coverUrl!, fit: BoxFit.cover, errorBuilder: (_, __, ___) => _placeholder())
                        : _placeholder(),
                  ),
                ),
                if (series.isPremium)
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(color: AppConfig.gold, borderRadius: BorderRadius.circular(5)),
                      child: const Text('PRO', style: TextStyle(color: Colors.black, fontSize: 9, fontWeight: FontWeight.bold)),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(series.title, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 13, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
          if (series.reciterName != null)
            Text(series.reciterName!, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _placeholder() => Container(
    color: AppConfig.bgCard,
    child: const Center(child: Icon(Icons.headphones_rounded, color: AppConfig.textMuted, size: 36)),
  );
}
