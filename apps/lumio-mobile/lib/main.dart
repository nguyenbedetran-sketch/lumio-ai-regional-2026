import 'package:flutter/foundation.dart';
import 'package:flutter/cupertino.dart' show CupertinoPageTransitionsBuilder;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:path_provider/path_provider.dart';
import 'core/app_store.dart';
import 'core/repository.dart';
import 'ui/common.dart';
import 'ui/focus.dart';
import 'ui/home.dart';
import 'ui/library.dart';
import 'ui/settings.dart';
import 'ui/study_motion.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final repository = kIsWeb
      ? PreviewRepository()
      : LocalRepository(await getApplicationSupportDirectory());
  final store = AppStore(repository);
  runApp(LumioApp(store: store));
  await store.initialize();
}

ThemeData lumioTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(seedColor: ink, brightness: brightness)
      .copyWith(
        primary: dark ? mint : ink,
        onPrimary: dark ? ink : Colors.white,
        surface: dark ? const Color(0xff112720) : paper,
        surfaceContainerLow: dark ? const Color(0xff1c352c) : Colors.white,
        secondaryContainer: dark
            ? const Color(0xff344a32)
            : const Color(0xffe8f0df),
        tertiary: dark ? const Color(0xffb8a8ff) : violet,
        tertiaryContainer: dark
            ? const Color(0xff302743)
            : const Color(0xffede8ff),
        onTertiaryContainer: dark
            ? const Color(0xffe9dfff)
            : const Color(0xff39265f),
      );
  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: scheme.surface,
    brightness: brightness,
  );
  return base.copyWith(
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: LumioPageTransitions(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        TargetPlatform.windows: LumioPageTransitions(),
        TargetPlatform.linux: LumioPageTransitions(),
        TargetPlatform.macOS: LumioPageTransitions(),
      },
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: scheme.surface,
      foregroundColor: scheme.onSurface,
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      titleTextStyle: base.textTheme.titleLarge?.copyWith(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: scheme.onSurface,
      ),
    ),
    textTheme: base.textTheme.apply(
      bodyColor: scheme.onSurface,
      displayColor: scheme.onSurface,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.surfaceContainerLow,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      contentPadding: const EdgeInsets.all(18),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 17),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
        textStyle: base.textTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w700,
          fontSize: 14,
        ),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(17)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.surface,
      indicatorColor: scheme.secondaryContainer,
      height: 78,
      labelTextStyle: WidgetStatePropertyAll(
        base.textTheme.labelMedium?.copyWith(fontWeight: FontWeight.w700),
      ),
    ),
    dividerTheme: DividerThemeData(
      color: scheme.outlineVariant.withValues(alpha: .5),
    ),
  );
}

class LumioApp extends StatelessWidget {
  const LumioApp({super.key, required this.store, this.monitorFocus = true});
  final AppStore store;
  final bool monitorFocus;
  @override
  Widget build(BuildContext context) => StoreScope(
    store: store,
    child: AnimatedBuilder(
      animation: store,
      builder: (context, _) => MaterialApp(
        key: ValueKey(store.scope),
        title: 'Lumio AI',
        debugShowCheckedModeBanner: false,
        theme: lumioTheme(Brightness.light),
        darkTheme: lumioTheme(Brightness.dark),
        themeMode: store.themeMode,
        locale: Locale(store.language),
        supportedLocales: const [Locale('vi'), Locale('en')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        builder: (context, child) {
          final content = Stack(
            children: [
              AbsorbPointer(absorbing: store.switchingAccount, child: child!),
              if (store.switchingAccount)
                Positioned.fill(
                  child: ColoredBox(
                    color: Colors.black.withValues(alpha: .3),
                    child: const Center(child: CircularProgressIndicator()),
                  ),
                ),
            ],
          );
          return MotionScope(
            preference: store.motionPreference,
            child: monitorFocus
                ? FocusMonitor(store: store, child: content)
                : content,
          );
        },
        home: !store.ready
            ? LoadingPage(store: store)
            : !store.onboarded
            ? const WelcomePage()
            : const HomeShell(),
      ),
    ),
  );
}

class LoadingPage extends StatelessWidget {
  const LoadingPage({super.key, required this.store});
  final AppStore store;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset('assets/brand.png', width: 130),
            const SizedBox(height: 26),
            if (store.error == null)
              const CircularProgressIndicator()
            else ...[
              Text(store.error!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: store.initialize,
                child: Text(store.t('Thử tải lại', 'Try again')),
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class WelcomePage extends StatelessWidget {
  const WelcomePage({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: ScreenBody(
        children: [
          const SizedBox(height: 20),
          Align(
            alignment: Alignment.centerLeft,
            child: Image.asset('assets/brand.png', height: 100),
          ),
          const SizedBox(height: 22),
          Text(
            context.tr(
              'Không chỉ đọc.\nHiểu thật sâu.',
              'Beyond reading.\nInto understanding.',
            ),
            style: Theme.of(context).textTheme.displaySmall?.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: -1.1,
              height: 1.15,
            ),
          ),
          const SizedBox(height: 18),
          Text(
            context.tr(
              'Mang học liệu của bạn vào một không gian yên tĩnh. Tự ghi chú, luyện nhớ và hỏi Lumio khi cần.',
              'Bring your material into a quieter space. Take notes, practise recall and ask Lumio when you need help.',
            ),
            style: Theme.of(
              context,
            ).textTheme.titleMedium?.copyWith(height: 1.6),
          ),
          const SizedBox(height: 30),
          ...[
            (
              Icons.auto_stories_outlined,
              context.tr('Học ngay, kể cả ngoại tuyến', 'Learn, even offline'),
            ),
            (
              Icons.psychology_outlined,
              context.tr(
                'Ôn tập theo trí nhớ của bạn',
                'Review at your own pace',
              ),
            ),
            (
              Icons.shield_outlined,
              context.tr(
                'Bạn quyết định nội dung gửi AI',
                'You choose what to send to AI',
              ),
            ),
          ].map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Surface(
                child: Row(
                  children: [
                    Icon(
                      entry.$1,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Text(
                        entry.$2,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 22),
          FilledButton.icon(
            onPressed: () =>
                runAction(context, () => context.store.settings(welcome: true)),
            icon: const Icon(Icons.arrow_forward),
            label: Text(
              context.tr(
                'Bắt đầu không cần tài khoản',
                'Start without an account',
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            context.tr(
              'Bạn có thể ghép tài khoản AI sau trong Cài đặt.',
              'You can pair an AI account later in Settings.',
            ),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          TextButton(
            onPressed: () => runAction(
              context,
              () => context.store.settings(
                locale: context.store.language == 'vi' ? 'en' : 'vi',
              ),
            ),
            child: Text(
              context.store.language == 'vi' ? 'English' : 'Tiếng Việt',
            ),
          ),
        ],
      ),
    ),
  );
}

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int selected = 0;
  final visited = <int>{0};
  @override
  Widget build(BuildContext context) {
    final store = context.store;
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset('assets/brand.png', width: 42, height: 42),
            const SizedBox(width: 6),
            const Text('Lumio', style: TextStyle(fontWeight: FontWeight.w800)),
            const Padding(
              padding: EdgeInsets.only(left: 5, bottom: 9),
              child: Text(
                'AI',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800),
              ),
            ),
          ],
        ),
        actions: [
          if (store.saving)
            const Padding(
              padding: EdgeInsets.all(18),
              child: SizedBox(
                width: 15,
                height: 15,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          IconButton(
            tooltip: context.tr('Tập trung', 'Focus'),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const FocusPage()),
            ),
            icon: const Icon(Icons.timer_outlined),
          ),
          IconButton(
            tooltip: context.tr('Cài đặt', 'Settings'),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsPage()),
            ),
            icon: const Icon(Icons.tune_rounded),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          if (kIsWeb)
            MaterialBanner(
              content: Text(
                context.tr(
                  'Bản xem giao diện Flutter: dữ liệu tạm thời, không ghép tài khoản. Dùng APK để kiểm tra đầy đủ.',
                  'Flutter UI preview: temporary data, no pairing. Use the APK for full testing.',
                ),
              ),
              actions: const [SizedBox.shrink()],
            ),
          if (store.error != null)
            MaterialBanner(
              content: Text(store.error!),
              actions: [
                TextButton(
                  onPressed: () =>
                      runAction(context, () => store.save(store.data)),
                  child: Text(context.tr('Thử lưu', 'Retry save')),
                ),
              ],
            ),
          Expanded(
            child: IndexedStack(
              index: selected,
              children: List.generate(
                3,
                (i) => TickerMode(
                  enabled: selected == i,
                  child: !visited.contains(i)
                      ? const SizedBox.shrink()
                      : TabReveal(
                          active: selected == i,
                          child: switch (i) {
                            0 => const HomePage(),
                            1 => const LibraryPage(),
                            _ => const ProgressPage(),
                          },
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selected,
        onDestinationSelected: (value) {
          HapticFeedback.selectionClick();
          FocusManager.instance.primaryFocus?.unfocus();
          if (selected != value) {
            setState(() {
              visited.add(value);
              selected = value;
            });
          }
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home_rounded),
            label: context.tr('Hôm nay', 'Today'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.auto_stories_outlined),
            selectedIcon: const Icon(Icons.auto_stories),
            label: context.tr('Thư viện', 'Library'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.bar_chart_outlined),
            selectedIcon: const Icon(Icons.bar_chart),
            label: context.tr('Tiến độ', 'Progress'),
          ),
        ],
      ),
    );
  }
}
