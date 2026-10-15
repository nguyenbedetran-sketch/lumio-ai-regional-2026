import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:just_audio/just_audio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import '../core/api.dart';
import '../core/tutor_session.dart';
import 'common.dart';
import 'math_text.dart';
import 'study_motion.dart';
import 'tutor_progress.dart';

class VoicePage extends StatefulWidget {
  const VoicePage({super.key, required this.itemId});
  final String itemId;
  @override
  State<VoicePage> createState() => _VoicePageState();
}

class _VoicePageState extends State<VoicePage> with WidgetsBindingObserver {
  final recorder = AudioRecorder(),
      player = AudioPlayer(),
      transcript = TextEditingController();
  Timer? limit, ticker;
  LumioApi? request;
  String? recordingPath, speechPath;
  String answer = '', voice = 'calm';
  bool recording = false, busy = false;
  int seconds = 0;
  final tutor = TutorSessionTracker();
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final store = context.store, item = store.item(widget.itemId);
    if (tutor.bind((
      store.scope,
      widget.itemId,
      item?.source,
      store.language,
    ))) {
      request?.cancel();
      request = null;
      busy = false;
      answer = '';
      transcript.clear();
      unawaited(player.stop());
      if (recording) unawaited(stop());
    }
  }

  void newExercise() {
    if (busy || recording) return;
    unawaited(player.stop());
    setState(() {
      tutor.reset();
      answer = '';
      transcript.clear();
    });
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && recording) unawaited(stop());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    limit?.cancel();
    ticker?.cancel();
    request?.cancel();
    recorder.dispose();
    player.dispose();
    transcript.dispose();
    for (final path in [recordingPath, speechPath]) {
      if (path != null) {
        unawaited(File(path).delete().catchError((_) => File(path)));
      }
    }
    super.dispose();
  }

  Future<void> start() async {
    if (!context.store.canTranscribe || busy) {
      notice(
        context,
        context.tr(
          'Kết nối tài khoản có giọng nói trong Cài đặt.',
          'Connect a voice-enabled account in Settings.',
        ),
      );
      return;
    }
    try {
      await player.stop();
      if (!await recorder.hasPermission()) {
        if (mounted) {
          notice(
            context,
            context.tr(
              'Cần quyền microphone để ghi âm.',
              'Microphone permission is required.',
            ),
          );
        }
        return;
      }
      final directory = await getTemporaryDirectory();
      final old = recordingPath;
      recordingPath =
          '${directory.path}/lumio-record-${DateTime.now().microsecondsSinceEpoch}.m4a';
      await recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.aacLc,
          bitRate: 64000,
          sampleRate: 24000,
          numChannels: 1,
        ),
        path: recordingPath!,
      );
      if (old != null) {
        unawaited(File(old).delete().catchError((_) => File(old)));
      }
      if (!mounted) {
        await recorder.stop();
        return;
      }
      setState(() {
        recording = true;
        seconds = 0;
      });
      ticker = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => seconds++);
      });
      limit = Timer(const Duration(seconds: 120), stop);
    } catch (e) {
      if (mounted) notice(context, errorText(context, e));
    }
  }

  Future<void> stop() async {
    limit?.cancel();
    ticker?.cancel();
    try {
      final path = await recorder.stop();
      if (mounted) {
        setState(() {
          recording = false;
          recordingPath = path ?? recordingPath;
        });
      }
    } catch (_) {
      if (mounted) setState(() => recording = false);
    }
  }

  Future<void> transcribe() async {
    if (recordingPath == null || busy) return;
    final store = context.store, scope = context.store.scope;
    final generation = tutor.generation, activeRequest = store.api;
    setState(() => busy = true);
    request = activeRequest;
    try {
      final text = await activeRequest.transcribe(
        File(recordingPath!),
        store.language,
      );
      if (mounted && store.scope == scope && tutor.generation == generation) {
        setState(() => transcript.text = text);
        unawaited(store.refreshAccount());
      }
    } catch (e) {
      if (mounted && store.scope == scope && tutor.generation == generation) {
        notice(context, errorText(context, e));
      }
    } finally {
      if (identical(request, activeRequest)) {
        request = null;
        if (mounted) setState(() => busy = false);
      }
    }
  }

  Future<void> ask({bool full = false}) async {
    final store = context.store,
        item = context.store.item(widget.itemId),
        scope = context.store.scope;
    if (busy ||
        recording ||
        item == null ||
        (!full && transcript.text.trim().isEmpty)) {
      return;
    }
    if (full && !tutor.canUnlock) {
      notice(context, errorText(context, const ApiFailure('TUTOR_LOCKED')));
      return;
    }
    if (!store.canTask('chat')) {
      notice(
        context,
        context.tr(
          'Tài khoản chưa sẵn sàng dùng gia sư AI.',
          'AI tutoring is not available for this account.',
        ),
      );
      return;
    }
    final generation = tutor.generation, activeRequest = store.api;
    setState(() => busy = true);
    request = activeRequest;
    try {
      await player.stop();
      if (!mounted || store.scope != scope || tutor.generation != generation) {
        return;
      }
      final response = await activeRequest.study(
        task: 'chat',
        source: item.source,
        language: store.language,
        question: full
            ? context.tr(
                'Em muốn đối chiếu lời giải đầy đủ của bài đang học.',
                'I would like to review the complete solution for the current exercise.',
              )
            : transcript.text.trim(),
        tutorSessionId: tutor.sessionId,
        guidance: full ? 'full' : 'hints',
      );
      if (mounted && store.scope == scope && tutor.generation == generation) {
        tutor.accept(response['tutor'], expectedGeneration: generation);
        final text = response['text'];
        if (text is! String) throw const ApiFailure('INVALID_RESPONSE');
        setState(() => answer = text);
        await store.activity('chat', itemId: item.id);
        unawaited(store.refreshAccount());
      }
    } catch (e) {
      if (mounted && store.scope == scope && tutor.generation == generation) {
        if (e is ApiFailure) {
          tutor.accept(e.tutor, expectedGeneration: generation);
          if (e.invalidatesTutorSession) tutor.reset();
        }
        notice(context, errorText(context, e));
      }
    } finally {
      if (identical(request, activeRequest)) {
        request = null;
        if (mounted) setState(() => busy = false);
      }
    }
  }

  Future<void> speak() async {
    final store = context.store, scope = context.store.scope;
    final text = answer.isEmpty ? transcript.text : answer;
    if (text.trim().isEmpty || busy) return;
    if (!store.canSpeak) {
      notice(
        context,
        context.tr(
          'Tài khoản chưa sẵn sàng dùng giọng nói.',
          'Voice is not available for this account.',
        ),
      );
      return;
    }
    final generation = tutor.generation, activeRequest = store.api;
    setState(() => busy = true);
    request = activeRequest;
    try {
      final bytes = await activeRequest.speak(
        text.length > 3000 ? text.substring(0, 3000) : text,
        store.language,
        voice,
      );
      if (!mounted || store.scope != scope || tutor.generation != generation) {
        return;
      }
      await player.stop();
      final directory = await getTemporaryDirectory();
      final old = speechPath;
      speechPath =
          '${directory.path}/lumio-speech-${DateTime.now().microsecondsSinceEpoch}.mp3';
      await File(speechPath!).writeAsBytes(bytes, flush: true);
      await player.setFilePath(speechPath!);
      unawaited(player.play());
      if (old != null) {
        unawaited(File(old).delete().catchError((_) => File(old)));
      }
      unawaited(store.refreshAccount());
    } catch (e) {
      if (mounted && store.scope == scope && tutor.generation == generation) {
        notice(context, errorText(context, e));
      }
    } finally {
      if (identical(request, activeRequest)) {
        request = null;
        if (mounted) setState(() => busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(
        context.tr('Trò chuyện bằng giọng nói', 'Voice conversation'),
      ),
      actions: [
        IconButton(
          onPressed: busy || recording ? null : newExercise,
          tooltip: context.tr('Bài mới', 'New exercise'),
          icon: const Icon(Icons.add_comment_outlined),
        ),
      ],
    ),
    body: ScreenBody(
      children: [
        SectionTitle(
          context.tr('Nói. Xem lại. Rồi gửi.', 'Speak. Review. Then send.'),
          subtitle: context.tr(
            'Bản ghi chỉ được tải lên khi nhấn Chép lời. Đây là hội thoại theo lượt.',
            'Audio uploads only when you tap Transcribe. This is a turn-based conversation.',
          ),
        ),
        Surface(
          child: Column(
            children: [
              AnimatedContainer(
                duration: motionDuration(context, 250),
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: recording
                      ? Theme.of(context).colorScheme.errorContainer
                      : Theme.of(context).colorScheme.secondaryContainer,
                ),
                child: Icon(
                  recording ? Icons.graphic_eq : Icons.mic_none_rounded,
                  size: 52,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                recording
                    ? '$seconds / 120 s'
                    : context.tr(
                        'Tối đa 2 phút mỗi lượt',
                        'Up to 2 minutes per turn',
                      ),
              ),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: busy
                    ? null
                    : recording
                    ? stop
                    : start,
                icon: Icon(recording ? Icons.stop : Icons.mic),
                label: Text(
                  context.tr(
                    recording ? 'Dừng ghi' : 'Bắt đầu ghi',
                    recording ? 'Stop recording' : 'Record',
                  ),
                ),
              ),
              if (!recording && recordingPath != null)
                OutlinedButton.icon(
                  onPressed: busy ? null : transcribe,
                  icon: const Icon(Icons.transcribe),
                  label: Text(
                    context.tr('Chép lời bản ghi', 'Transcribe recording'),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        TextField(
          controller: transcript,
          minLines: 4,
          maxLines: 10,
          maxLength: 4000,
          decoration: InputDecoration(
            labelText: context.tr(
              'Xem và sửa lời nói',
              'Review and edit transcript',
            ),
            hintText: context.tr(
              'Bạn cũng có thể gõ câu hỏi ở đây.',
              'You can also type your question here.',
            ),
          ),
        ),
        FilledButton.icon(
          onPressed: busy || recording ? null : ask,
          icon: const Icon(Icons.arrow_upward),
          label: Text(context.tr('Gửi cho Lumio', 'Ask Lumio')),
        ),
        const SizedBox(height: 12),
        TutorProgress(snapshot: tutor.snapshot),
        OutlinedButton.icon(
          onPressed: busy || recording || !tutor.canUnlock
              ? null
              : () => ask(full: true),
          icon: const Icon(Icons.lock_open),
          label: Text(context.tr('Đối chiếu lời giải', 'Review full solution')),
        ),
        if (busy) ...[
          const SizedBox(height: 18),
          const LinearProgressIndicator(),
          TextButton(
            onPressed: () => request?.cancel(),
            child: Text(context.tr('Hủy yêu cầu', 'Cancel request')),
          ),
        ],
        if (answer.isNotEmpty) ...[
          SectionTitle(context.tr('Lumio trả lời', 'Lumio’s answer')),
          Surface(
            child: LearningText(
              answer,
              selectable: true,
              language: context.store.language,
              style: const TextStyle(height: 1.6),
            ),
          ),
        ],
        SectionTitle(context.tr('Nghe nội dung', 'Listen')),
        DropdownButtonFormField<String>(
          initialValue: voice,
          decoration: InputDecoration(
            labelText: context.tr('Giọng đọc', 'Voice'),
          ),
          items: [
            DropdownMenuItem(
              value: 'calm',
              child: Text(context.tr('Điềm tĩnh', 'Calm')),
            ),
            DropdownMenuItem(
              value: 'clear',
              child: Text(context.tr('Rõ ràng', 'Clear')),
            ),
            DropdownMenuItem(
              value: 'warm',
              child: Text(context.tr('Ấm áp', 'Warm')),
            ),
          ],
          onChanged: (value) => setState(() => voice = value!),
        ),
        const SizedBox(height: 10),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: busy || recording ? null : speak,
                icon: const Icon(Icons.volume_up_outlined),
                label: Text(
                  context.tr(
                    'Đọc tối đa 3.000 ký tự',
                    'Read up to 3,000 characters',
                  ),
                ),
              ),
            ),
            IconButton(
              onPressed: () => player.stop(),
              icon: const Icon(Icons.stop_circle_outlined),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Text(
          context.tr(
            'AI có thể chép lời hoặc trả lời sai. Kiểm tra trước khi sử dụng; các yêu cầu trực tuyến có thể dùng credit.',
            'AI can transcribe or answer incorrectly. Check before use; online requests may consume credits.',
          ),
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    ),
  );
}
