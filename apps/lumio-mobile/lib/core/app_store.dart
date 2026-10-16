import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api.dart';
import 'models.dart';
import 'motion.dart';
import 'repository.dart';
import 'paid_intents.dart';

class AppStore extends ChangeNotifier {
  AppStore(
    this.repository, {
    FlutterSecureStorage? secureStorage,
    LumioApi Function(Uri, String?)? apiFactory,
  }) : secure = secureStorage ?? const FlutterSecureStorage(),
       _apiFactory =
           apiFactory ?? ((url, token) => LumioApi(url, token: token));
  final LumioApi Function(Uri, String?) _apiFactory;
  final LocalRepository repository;
  final FlutterSecureStorage secure;
  late final PaidIntentRegistry _paidIntents = PaidIntentRegistry.secure(
    secure,
  );
  LibraryData data = const LibraryData();
  MobileSession? session;
  String language = 'vi', server = 'https://lumio-ai-demo.onrender.com';
  ThemeMode themeMode = ThemeMode.system;
  MotionPreference motionPreference = MotionPreference.auto;
  bool onboarded = false,
      ready = false,
      saving = false,
      switchingAccount = false;
  String? error;
  Map<String, dynamic>? accountInfo;
  double alarmVolume = .6;
  String alarm = 'bell';
  Future<void> _writes = Future.value();
  Future<void> _settingsWrites = Future.value();
  String get scope => session?.scope ?? 'guest';
  String t(String vi, String en) => language == 'vi' ? vi : en;
  LumioApi get api {
    final current = session;
    final api = _apiFactory(
      validateServer(current?.origin ?? server),
      current?.token,
    );
    api.bindCanonicalUser(
      current?.id,
      paidIntents: _paidIntents,
      sessionCurrent: () =>
          current != null &&
          session?.scope == current.scope &&
          session?.token == current.token &&
          authenticated,
    );
    return api;
  }

  bool get authenticated =>
      session != null && session!.expiresAt.isAfter(DateTime.now());
  bool get canAI =>
      authenticated && accountInfo?['capabilities']?['ai'] == true;
  bool get canVoice =>
      authenticated && accountInfo?['capabilities']?['voice'] == true;
  bool canTask(String task) =>
      authenticated &&
      (accountInfo?['capabilities']?[task == 'summary' ? 'summary' : 'tutor'] ??
              accountInfo?['capabilities']?['ai']) ==
          true;
  bool get canTranscribe =>
      authenticated &&
      (accountInfo?['capabilities']?['transcription'] ??
              accountInfo?['capabilities']?['voice']) ==
          true;
  bool get canSpeak =>
      authenticated &&
      (accountInfo?['capabilities']?['speech'] ??
              accountInfo?['capabilities']?['voice']) ==
          true;
  int get dueCount => data.items
      .expand((i) => i.cards)
      .where((c) => !c.due.isAfter(DateTime.now()))
      .length;
  int get streak => studyStreak(data.events, DateTime.now());

  Future<void> initialize() async {
    try {
      final settings = await repository.readSettings();
      language = settings['language'] == 'en' ? 'en' : 'vi';
      themeMode = ThemeMode.values.firstWhere(
        (v) => v.name == settings['theme'],
        orElse: () => ThemeMode.system,
      );
      onboarded = settings['onboarded'] == true;
      motionPreference = readMotionPreference(settings['motion']);
      server = settings['server'] ?? server;
      alarmVolume = ((settings['alarmVolume'] as num?)?.toDouble() ?? .6).clamp(
        0,
        1,
      );
      alarm = settings['alarm'] ?? 'bell';
      final raw = kIsWeb
          ? null
          : await secure.read(key: 'lumio.mobile.session.v1');
      if (raw != null) {
        session = MobileSession.fromJson(object(jsonDecode(raw)));
      }
      data = await repository.load(scope);
      ready = true;
      error = repository.recoveredBackup
          ? t(
              'Đã khôi phục bản lưu trước. Kiểm tra dữ liệu và xuất bản sao.',
              'Recovered the previous save. Review your data and export a backup.',
            )
          : null;
    } catch (_) {
      error = t(
        'Không đọc được dữ liệu. Bản gốc được giữ nguyên; hãy thử tải lại.',
        'Could not read your data. Original files are preserved; try reloading.',
      );
    }
    notifyListeners();
    if (ready && authenticated) unawaited(refreshAccount());
  }

  Future<void> settings({
    String? locale,
    ThemeMode? theme,
    bool? welcome,
    String? origin,
    String? alarmSound,
    double? volume,
    MotionPreference? motion,
  }) async {
    if (locale != null) language = locale;
    if (theme != null) themeMode = theme;
    if (motion != null) motionPreference = motion;
    if (welcome != null) onboarded = welcome;
    if (origin != null) server = validateServer(origin).toString();
    if (alarmSound != null) alarm = alarmSound;
    if (volume != null) alarmVolume = volume.clamp(0, 1);
    notifyListeners();
    final snapshot = <String, dynamic>{
      'language': language,
      'theme': themeMode.name,
      'onboarded': onboarded,
      'server': server,
      'alarm': alarm,
      'alarmVolume': alarmVolume,
      'motion': motionPreference.name,
    };
    final pending = _settingsWrites
        .catchError((Object _) {})
        .then((_) => repository.saveSettings(snapshot));
    _settingsWrites = pending;
    await pending;
  }

  Future<void> save(LibraryData next) async {
    if (!ready || switchingAccount) {
      throw StateError('Library is not available during account transition');
    }
    final account = scope, snapshot = next.encode();
    data = next;
    saving = true;
    error = null;
    notifyListeners();
    final pending = _writes
        .catchError((Object _) {})
        .then((_) => repository.save(account, snapshot));
    _writes = pending;
    try {
      await pending;
      if (identical(data, next)) saving = false;
    } catch (_) {
      if (scope == account) {
        saving = false;
        error = t(
          'Chưa lưu được trên thiết bị. Bản nháp còn trong ứng dụng; thử lại hoặc xuất bản sao.',
          'Could not save on this device. Your draft is still in the app; retry or export a backup.',
        );
      }
      rethrow;
    } finally {
      notifyListeners();
    }
  }

  LibraryData copy({
    List<StudyItem>? items,
    List<StudyEvent>? events,
    FocusSession? focus,
    bool clearFocus = false,
  }) => LibraryData(
    items: items ?? data.items,
    events: events ?? data.events,
    focus: clearFocus ? null : focus ?? data.focus,
  );
  Future<void> upsert(StudyItem item) =>
      save(copy(items: [item, ...data.items.where((i) => i.id != item.id)]));
  Future<void> deleteItem(String id) =>
      save(copy(items: data.items.where((i) => i.id != id).toList()));
  StudyItem? item(String id) {
    for (final item in data.items) {
      if (item.id == id) return item;
    }
    return null;
  }

  Future<void> activity(
    String kind, {
    String itemId = '',
    int minutes = 0,
    String? id,
  }) async {
    final now = DateTime.now();
    final eventId = id ?? '$kind:$itemId:${dayKey(now)}';
    if (data.events.any((e) => e.id == eventId)) return;
    await save(
      copy(
        events: [
          ...data.events,
          StudyEvent(
            id: eventId,
            kind: kind,
            at: now,
            itemId: itemId,
            minutes: minutes,
          ),
        ].reversed.take(10000).toList().reversed.toList(),
      ),
    );
  }

  Future<void> review(String itemId, String cardId, ReviewRating rating) async {
    final value = item(itemId);
    if (value == null) return;
    final now = DateTime.now();
    final cards = value.cards
        .map((c) => c.id == cardId ? c.rated(rating, now) : c)
        .toList();
    final updated = value.copyWith(cards: cards);
    await save(
      copy(
        items: data.items.map((i) => i.id == itemId ? updated : i).toList(),
        events: [
          ...data.events,
          StudyEvent(id: newId(), kind: 'review', at: now, itemId: itemId),
        ],
      ),
    );
  }

  Future<void> finishQuiz(String itemId, QuizAttempt attempt) async {
    final value = item(itemId);
    if (value == null || value.attempts.any((a) => a.id == attempt.id)) return;
    await save(
      copy(
        items: data.items
            .map(
              (i) => i.id == itemId
                  ? i.copyWith(attempts: [...i.attempts, attempt])
                  : i,
            )
            .toList(),
        events: [
          ...data.events,
          StudyEvent(
            id: attempt.id,
            kind: 'quiz',
            at: attempt.at,
            itemId: itemId,
          ),
        ],
      ),
    );
  }

  Future<void> focusStart(int minutes) => save(
    copy(
      focus: FocusSession(
        id: newId(),
        totalSeconds: minutes * 60,
        remainingSeconds: minutes * 60,
      ).resume(DateTime.now()),
    ),
  );
  Future<void> focusPause() async {
    final f = data.focus;
    if (f != null) await save(copy(focus: f.pause(DateTime.now())));
  }

  Future<void> focusResume() async {
    final f = data.focus;
    if (f != null) await save(copy(focus: f.resume(DateTime.now())));
  }

  Future<void> focusCancel() => save(copy(clearFocus: true));
  Future<bool> focusComplete(DateTime now) async {
    final f = data.focus;
    if (f == null || f.endsAt == null || f.remaining(now) > 0) return false;
    final seen = data.events.any((e) => e.id == 'focus:${f.id}');
    await save(
      copy(
        clearFocus: true,
        events: seen
            ? data.events
            : [
                ...data.events,
                StudyEvent(
                  id: 'focus:${f.id}',
                  kind: 'focus',
                  at: f.endsAt!,
                  minutes: f.totalSeconds ~/ 60,
                ),
              ],
      ),
    );
    return !seen;
  }

  Future<void> refreshAccount() async {
    if (!authenticated) return;
    final current = scope;
    try {
      final result = await api.account();
      if (scope == current) {
        accountInfo = result;
        notifyListeners();
      }
    } catch (_) {
      if (scope == current) {
        accountInfo = null;
        notifyListeners();
      }
    }
  }

  Future<void> pair(String origin, String code) async {
    if (switchingAccount) throw StateError('Account transition in progress');
    switchingAccount = true;
    notifyListeners();
    try {
      await _writes;
      final parsed = validateServer(origin);
      final connected = await _apiFactory(
        parsed,
        null,
      ).pair(code, 'Lumio mobile');
      final library = await repository.load(connected.scope);
      await secure.write(
        key: 'lumio.mobile.session.v1',
        value: jsonEncode(connected.toJson()),
      );
      session = connected;
      data = library;
      accountInfo = null;
      server = parsed.toString();
      await settings(origin: server);
      await refreshAccount();
    } finally {
      switchingAccount = false;
      notifyListeners();
    }
  }

  Future<void> disconnect({bool revoke = true}) async {
    if (switchingAccount) throw StateError('Account transition in progress');
    switchingAccount = true;
    notifyListeners();
    try {
      await _writes;
      if (revoke && authenticated) await api.revoke();
      final guest = await repository.load('guest');
      await secure.delete(key: 'lumio.mobile.session.v1');
      session = null;
      accountInfo = null;
      data = guest;
      error = null;
    } finally {
      switchingAccount = false;
      notifyListeners();
    }
  }
}
