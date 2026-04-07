import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../config/app_config.dart';
import '../providers/app_providers.dart';
import '../services/supabase_service.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      backgroundColor: AppConfig.bgPrimary,
      appBar: AppBar(
        backgroundColor: AppConfig.bgPrimary,
        title: const Text('Profile', style: TextStyle(fontWeight: FontWeight.bold)),
        automaticallyImplyLeading: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppConfig.textSecondary),
            onPressed: () => _confirmLogout(context, ref),
          ),
        ],
      ),
      body: profileAsync.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppConfig.gold)),
        error: (e, _) => Center(child: Text('Error: $e', style: const TextStyle(color: AppConfig.error))),
        data: (profile) {
          if (profile == null) {
            return Center(
              child: ElevatedButton(
                onPressed: () => context.go('/login'),
                child: const Text('Login করুন'),
              ),
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                // Avatar
                Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: AppConfig.bgCard,
                    shape: BoxShape.circle,
                    border: Border.all(color: AppConfig.gold.withOpacity(0.4), width: 2),
                  ),
                  child: profile.avatarUrl != null
                      ? ClipOval(child: Image.network(profile.avatarUrl!, fit: BoxFit.cover))
                      : Center(
                          child: Text(
                            profile.displayNameOrEmail.substring(0, 1).toUpperCase(),
                            style: const TextStyle(color: AppConfig.gold, fontSize: 36, fontWeight: FontWeight.bold),
                          ),
                        ),
                ),
                const SizedBox(height: 12),
                Text(profile.displayNameOrEmail, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 20, fontWeight: FontWeight.bold)),
                Text(profile.email, style: const TextStyle(color: AppConfig.textSecondary, fontSize: 13)),
                const SizedBox(height: 8),
                if (profile.isPremium)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(colors: [AppConfig.gold, AppConfig.goldLight]),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.star_rounded, size: 14, color: Colors.black),
                        SizedBox(width: 4),
                        Text('Premium', style: TextStyle(color: Colors.black, fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),

                const SizedBox(height: 24),

                // Stats
                Row(
                  children: [
                    _StatCard(icon: Icons.bolt_rounded, value: profile.xp.toString(), label: 'XP'),
                    const SizedBox(width: 12),
                    _StatCard(icon: Icons.local_fire_department_rounded, value: profile.streak.toString(), label: 'Streak'),
                    const SizedBox(width: 12),
                    _StatCard(
                      icon: Icons.headphones_rounded,
                      // totalListeningHours is in the profiles table (NUMERIC, hours)
                      value: profile.formattedListeningTime,
                      label: 'Listened',
                    ),
                  ],
                ),

                const SizedBox(height: 28),
                const Divider(color: AppConfig.bgElevated),
                const SizedBox(height: 8),

                // Menu items
                _MenuItem(icon: Icons.bookmark_rounded, title: 'Saved Series', onTap: () => context.go('/library')),
                _MenuItem(icon: Icons.history_rounded, title: 'Listening History', onTap: () {}),
                _MenuItem(icon: Icons.settings_rounded, title: 'Settings', onTap: () {}),
                _MenuItem(icon: Icons.help_outline_rounded, title: 'Help & Support', onTap: () {}),
                const SizedBox(height: 8),
                const Divider(color: AppConfig.bgElevated),
                const SizedBox(height: 8),
                _MenuItem(icon: Icons.logout_rounded, title: 'Logout', color: AppConfig.error, onTap: () => _confirmLogout(context, ref)),
              ],
            ),
          );
        },
      ),
    );
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppConfig.bgCard,
        title: const Text('Logout', style: TextStyle(color: AppConfig.textPrimary)),
        content: const Text('আপনি কি logout করতে চান?', style: TextStyle(color: AppConfig.textSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel', style: TextStyle(color: AppConfig.textSecondary))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppConfig.error),
            onPressed: () async {
              Navigator.pop(ctx);
              await SupabaseService().signOut();
              if (context.mounted) context.go('/login');
            },
            child: const Text('Logout', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatCard({required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) => Expanded(
    child: Container(
      padding: const EdgeInsets.symmetric(vertical: 14),
      decoration: BoxDecoration(color: AppConfig.bgCard, borderRadius: BorderRadius.circular(12)),
      child: Column(
        children: [
          Icon(icon, color: AppConfig.gold, size: 20),
          const SizedBox(height: 6),
          Text(value, style: const TextStyle(color: AppConfig.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
          Text(label, style: const TextStyle(color: AppConfig.textMuted, fontSize: 11)),
        ],
      ),
    ),
  );
}

class _MenuItem extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;
  final Color? color;

  const _MenuItem({required this.icon, required this.title, required this.onTap, this.color});

  @override
  Widget build(BuildContext context) => ListTile(
    contentPadding: EdgeInsets.zero,
    leading: Icon(icon, color: color ?? AppConfig.textSecondary, size: 22),
    title: Text(title, style: TextStyle(color: color ?? AppConfig.textPrimary, fontSize: 15)),
    trailing: color == null ? const Icon(Icons.chevron_right, color: AppConfig.textMuted, size: 18) : null,
    onTap: onTap,
  );
}
