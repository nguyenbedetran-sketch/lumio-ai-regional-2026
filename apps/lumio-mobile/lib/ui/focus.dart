import 'dart:async';
import 'dart:io';
import 'dart:math' as math;
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import '../core/app_store.dart';
import 'common.dart';
import 'study_motion.dart';

Future<void> playAlarm(AudioPlayer player, AppStore store) async {
  await player.stop();
  await player.setVolume(store.alarmVolume);
  if (store.alarm.startsWith('/')) {
    await player.setFilePath(store.alarm);
  } else {
    await player.setAsset(
      'assets/${store.alarm == 'chime' ? 'chime' : 'bell'}.wav',
    );
  }
  unawaited(player.play());
}

class FocusMonitor extends StatefulWidget {
  const FocusMonitor({super.key, required this.store, required this.child});
  final AppStore store;
  final Widget child;
  @override
  State<FocusMonitor> createState() => _FocusMonitorState();
}

class _FocusMonitorState extends State<FocusMonitor>
    with WidgetsBindingObserver {
  final player = AudioPlayer();
  Timer? ticker;
  bool checking = false, active = true;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    ticker = Timer.periodic(const Duration(seconds: 1), (_) => check());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    active = state == AppLifecycleState.resumed;
    if (active) unawaited(check());
  }

  Future<void> check() async {
    if (!active ||
        checking ||
        !widget.store.ready ||
        widget.store.data.focus?.endsAt == null) {
      return;
    }
    if (widget.store.data.focus!.remaining(DateTime.now()) > 0) return;
    checking = true;
    try {
      if (await widget.store.focusComplete(DateTime.now())) {
        await playAlarm(player, widget.store);
        HapticFeedback.mediumImpact();
      }
    } catch (_) {
      if (mounted) {
        notice(
          context,
          widget.store.t(
            'Không phát được chuông. Hãy kiểm tra âm lượng trong Phòng tập trung.',
            'Could not play the alarm. Check sound settings in Focus.',
          ),
        );
      }
    } finally {
      checking = false;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    ticker?.cancel();
    player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class FocusPage extends StatefulWidget {
  const FocusPage({super.key});
  @override
  State<FocusPage> createState() => _FocusPageState();
}

class _FocusPageState extends State<FocusPage> {
  int minutes = 25;
  final player = AudioPlayer();
  Timer? timer;
  bool busy = false;
  String? observedSession, completedSession;
  int completedMinutes = 0;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = context.store, session = context.store.data.focus;
    if (session != null) {
      observedSession = session.id;
    } else if (observedSession != null &&
        !store.saving &&
        store.error == null) {
      for (final event in store.data.events) {
        if (event.id == 'focus:$observedSession') {
          completedSession = event.id;
          completedMinutes = event.minutes;
          break;
        }
      }
      observedSession = null;
    }
  }

  @override
  void initState() {
    super.initState();
    timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted &&
          ModalRoute.of(context)?.isCurrent == true &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed &&
          context.store.data.focus?.endsAt != null) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    timer?.cancel();
    player.dispose();
    super.dispose();
  }

  Future<void> customSound() async {
    final store = context.store;
    try {
      final result = await FilePicker.pickFile(type: FileType.audio);
      if (result == null) return;
      final chosen = result;
      if ((await chosen.length() ?? 5300000) > 5 * 1024 * 1024) {
        throw const FormatException();
      }
      final directory = await getApplicationSupportDirectory();
      final extension = chosen.extension?.toLowerCase() ?? 'wav';
      if (!['mp3', 'm4a', 'wav', 'aac', 'ogg'].contains(extension)) {
        throw const FormatException();
      }
      final target = File(
        '${directory.path}/lumio-alarm-${DateTime.now().microsecondsSinceEpoch}.$extension',
      );
      await target.writeAsBytes(await chosen.readAsBytes(), flush: true);
      final duration = await player.setFilePath(target.path);
      await player.stop();
      if (duration == null ||
          duration > const Duration(seconds: 30) ||
          duration == Duration.zero) {
        await target.delete();
        throw const FormatException();
      }
      final previous = store.alarm;
      await store.settings(alarmSound: target.path);
      if (previous.startsWith('${directory.path}/lumio-alarm-') &&
          previous != target.path &&
          await File(previous).exists()) {
        await File(previous).delete();
      }
    } catch (_) {
      if (mounted) {
        notice(
          context,
          context.tr(
            'Chọn âm thanh phát được, tối đa 30 giây và 5 MB.',
            'Choose a playable audio file up to 30 seconds and 5 MB.',
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = context.store, focus = context.store.data.focus;
    final remaining = focus?.remaining(DateTime.now()) ?? minutes * 60;
    final running = focus?.endsAt != null;
    final progress = focus == null ? 0.0 : 1 - remaining / focus.totalSeconds;
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('Phòng tập trung', 'Focus room'))),
      body: ScreenBody(
        children: [
          const SizedBox(height: 28),
          Text(
            context.tr('Chỉ một việc lúc này.', 'Just one thing, right now.'),
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 32),
          StudyMotion(
            child: FocusDial(
              remaining: remaining,
              progress: progress.clamp(0, 1),
              label: context.tr(
                running
                    ? 'Đang tập trung'
                    : focus == null
                    ? 'Sẵn sàng bắt đầu'
                    : 'Đang tạm dừng',
                running
                    ? 'In focus'
                    : focus == null
                    ? 'Ready when you are'
                    : 'Paused',
              ),
            ),
          ),
          if (completedSession != null && focus == null) ...[
            const SizedBox(height: 20),
            StudyMotion(
              key: ValueKey(completedSession),
              feedback: true,
              child: Surface(
                color: Theme.of(context).colorScheme.secondaryContainer,
                child: Row(
                  children: [
                    const Icon(Icons.task_alt_rounded),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        context.tr(
                          'Đã ghi nhận $completedMinutes phút tập trung. Nghỉ một chút nhé.',
                          '$completedMinutes focus minutes saved. Take a short break.',
                        ),
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          const SizedBox(height: 28),
          if (focus == null)
            Wrap(
              alignment: WrapAlignment.center,
              children: [15, 25, 45]
                  .map(
                    (m) => Padding(
                      padding: const EdgeInsets.all(5),
                      child: ChoiceChip(
                        label: Text('$m ${context.tr('phút', 'min')}'),
                        selected: minutes == m,
                        onSelected: (_) => setState(() => minutes = m),
                      ),
                    ),
                  )
                  .toList(),
            ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: busy
                ? null
                : () async {
                    setState(() => busy = true);
                    if (focus == null) completedSession = null;
                    await runAction(
                      context,
                      () => focus == null
                          ? store.focusStart(minutes)
                          : running
                          ? store.focusPause()
                          : store.focusResume(),
                    );
                    if (mounted) setState(() => busy = false);
                  },
            icon: Icon(
              running ? Icons.pause_rounded : Icons.play_arrow_rounded,
            ),
            label: Text(
              context.tr(
                focus == null
                    ? 'Bắt đầu'
                    : running
                    ? 'Tạm dừng'
                    : 'Tiếp tục',
                focus == null
                    ? 'Start focus'
                    : running
                    ? 'Pause'
                    : 'Resume',
              ),
            ),
          ),
          if (focus != null)
            TextButton(
              onPressed: () async {
                if (await confirm(
                      context,
                      context.tr(
                        'Kết thúc sớm? Phiên này sẽ không được tính hoàn thành.',
                        'End early? This session will not count as completed.',
                      ),
                    ) &&
                    context.mounted) {
                  await runAction(context, store.focusCancel);
                }
              },
              child: Text(context.tr('Kết thúc sớm', 'End early')),
            ),
          SectionTitle(context.tr('Một tiếng chuông nhẹ', 'A gentle reminder')),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Wrap(
                  spacing: 8,
                  children: ['bell', 'chime']
                      .map(
                        (sound) => ChoiceChip(
                          label: Text(
                            sound == 'bell'
                                ? context.tr('Chuông', 'Bell')
                                : context.tr('Ngân vang', 'Chime'),
                          ),
                          selected: store.alarm == sound,
                          onSelected: (_) => runAction(
                            context,
                            () => store.settings(alarmSound: sound),
                          ),
                        ),
                      )
                      .toList(),
                ),
                Slider(
                  value: store.alarmVolume,
                  onChanged: (value) =>
                      runAction(context, () => store.settings(volume: value)),
                ),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () =>
                            runAction(context, () => playAlarm(player, store)),
                        icon: const Icon(Icons.volume_up_outlined),
                        label: Text(context.tr('Nghe thử', 'Preview')),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: customSound,
                        icon: const Icon(Icons.audio_file_outlined),
                        label: Text(context.tr('Chọn tệp', 'Choose file')),
                      ),
                    ),
                  ],
                ),
                if (store.alarm.startsWith('/'))
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Text(
                      context.tr(
                        'Đang dùng âm thanh riêng.',
                        'Using your custom sound.',
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            context.tr(
              'Giữ ứng dụng mở để nghe chuông đúng giờ. Khi quay lại ứng dụng, đồng hồ đối chiếu thời gian đã lưu; phiên hoàn thành chỉ được ghi một lần.',
              'Keep the app open to hear the alarm on time. When you return, the timer checks its saved deadline; completion is recorded once.',
            ),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class FocusDial extends StatelessWidget {
  const FocusDial({
    super.key,
    required this.remaining,
    required this.progress,
    required this.label,
  });
  final int remaining;
  final double progress;
  final String label;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return LayoutBuilder(
      builder: (context, constraints) {
        final diameter = math
            .min(286.0, constraints.maxWidth)
            .clamp(0.0, 286.0);
        return Center(
          child: SizedBox(
            width: diameter,
            height: diameter,
            child: TweenAnimationBuilder<double>(
              tween: Tween(begin: progress, end: progress),
              duration: motionDuration(context, 420),
              curve: Curves.easeOutCubic,
              builder: (context, value, child) => CustomPaint(
                painter: _FocusDialPainter(
                  value,
                  scheme.primary,
                  scheme.tertiary,
                  scheme.outlineVariant,
                ),
                child: child,
              ),
              child: Padding(
                padding: const EdgeInsets.all(38),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.eco_outlined, color: scheme.primary),
                    const SizedBox(height: 12),
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      child: Text(
                        '${(remaining ~/ 60).toString().padLeft(2, '0')}:${(remaining % 60).toString().padLeft(2, '0')}',
                        style: const TextStyle(
                          fontSize: 58,
                          fontWeight: FontWeight.w300,
                          letterSpacing: -1.5,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      label,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.labelMedium,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _FocusDialPainter extends CustomPainter {
  const _FocusDialPainter(this.progress, this.primary, this.accent, this.track);
  final double progress;
  final Color primary, accent, track;
  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero), radius = size.shortestSide / 2;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    paint.color = track.withValues(alpha: .5);
    paint.strokeWidth = 2;
    for (var i = 0; i < 48; i++) {
      final angle = -math.pi / 2 + math.pi * 2 * i / 48;
      final offset = Offset(math.cos(angle), math.sin(angle));
      canvas.drawLine(
        center + offset * (radius - 2),
        center + offset * (radius - 8),
        paint,
      );
    }
    final rect = Rect.fromCircle(center: center, radius: radius - 22);
    paint
      ..strokeWidth = 9
      ..color = track.withValues(alpha: .45);
    canvas.drawCircle(center, radius - 22, paint);
    if (progress <= 0) return;
    paint.shader = SweepGradient(
      startAngle: -math.pi / 2,
      endAngle: math.pi * 1.5,
      colors: [primary, accent],
      transform: const GradientRotation(-math.pi / 2),
    ).createShader(rect);
    canvas.drawArc(rect, -math.pi / 2, progress * math.pi * 2, false, paint);
  }

  @override
  bool shouldRepaint(_FocusDialPainter oldDelegate) =>
      oldDelegate.progress != progress ||
      oldDelegate.primary != primary ||
      oldDelegate.accent != accent ||
      oldDelegate.track != track;
}
