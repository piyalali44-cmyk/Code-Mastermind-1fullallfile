import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../providers/app_providers.dart';
import '../widgets/series_card.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _ctrl = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final resultsAsync = ref.watch(searchResultsProvider(_query));
    final categoriesAsync = ref.watch(categoriesProvider);

    return Scaffold(
      backgroundColor: AppConfig.bgPrimary,
      appBar: AppBar(
        backgroundColor: AppConfig.bgPrimary,
        title: const Text('Search', style: TextStyle(fontWeight: FontWeight.bold)),
        automaticallyImplyLeading: false,
      ),
      body: Column(
        children: [
          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: TextField(
              controller: _ctrl,
              style: const TextStyle(color: AppConfig.textPrimary),
              onChanged: (v) => setState(() => _query = v.trim()),
              decoration: InputDecoration(
                hintText: 'Series, Reciter search করুন...',
                prefixIcon: const Icon(Icons.search_rounded, color: AppConfig.textMuted),
                suffixIcon: _query.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear, color: AppConfig.textMuted, size: 18),
                        onPressed: () { _ctrl.clear(); setState(() => _query = ''); },
                      )
                    : null,
              ),
            ),
          ),

          Expanded(
            child: _query.isEmpty
                ? _BrowseCategories(categoriesAsync: categoriesAsync)
                : resultsAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator(color: AppConfig.gold)),
                    error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppConfig.error))),
                    data: (results) => results.isEmpty
                        ? Center(
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.search_off, size: 48, color: AppConfig.textMuted),
                                const SizedBox(height: 12),
                                Text('"$_query" পাওয়া যায়নি', style: const TextStyle(color: AppConfig.textSecondary)),
                              ],
                            ),
                          )
                        : GridView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2, mainAxisSpacing: 12, crossAxisSpacing: 12, childAspectRatio: 0.78,
                            ),
                            itemCount: results.length,
                            itemBuilder: (_, i) => SeriesCard(series: results[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _BrowseCategories extends ConsumerWidget {
  final AsyncValue<dynamic> categoriesAsync;
  const _BrowseCategories({required this.categoriesAsync});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return categoriesAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppConfig.gold)),
      error: (_, __) => const SizedBox(),
      data: (categories) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Text('Browse Categories', style: TextStyle(color: AppConfig.textPrimary, fontSize: 16, fontWeight: FontWeight.bold)),
          ),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: 2.2,
              ),
              itemCount: categories.length,
              itemBuilder: (_, i) => GestureDetector(
                onTap: () {},
                child: Container(
                  decoration: BoxDecoration(
                    color: AppConfig.bgCard,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppConfig.bgElevated),
                  ),
                  child: Center(
                    child: Text(
                      categories[i].name,
                      style: const TextStyle(color: AppConfig.textPrimary, fontSize: 14, fontWeight: FontWeight.w500),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
