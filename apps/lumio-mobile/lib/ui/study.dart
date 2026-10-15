import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/api.dart';
import '../core/tutor_session.dart';
import 'tutor_progress.dart';
import '../core/models.dart';
import 'common.dart';
import 'math_text.dart';
import '../core/study_share.dart';
import 'study_share.dart';
import 'study_motion.dart';
import 'library.dart';
import 'practice.dart';
import 'voice.dart';

class StudyPage extends StatefulWidget {
  const StudyPage({super.key, required this.itemId});
  final String itemId;
  @override
  State<StudyPage> createState() => _StudyPageState();
}

class _StudyPageState extends State<StudyPage>
    with SingleTickerProviderStateMixin {
  late final tabs = TabController(length: 4, vsync: this);
  Timer? reading;
  LumioApi? request;
  String? busy;
  @override
  void initState() {
    super.initState();
    reading = Timer.periodic(const Duration(seconds: 20), (_) {
      if (mounted &&
          ModalRoute.of(context)?.isCurrent == true &&
          WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed &&
          (tabs.index == 1 || tabs.index == 2)) {
        final item = context.store.item(widget.itemId);
        if (item != null &&
            (tabs.index == 1 ? item.source : item.notes).trim().length >= 20) {
          unawaited(
            runAction(
              context,
              () => context.store.activity('read', itemId: item.id),
            ),
          );
        }
      }
    });
  }

  @override
  void dispose() {
    reading?.cancel();
    request?.cancel();
    tabs.dispose();
    super.dispose();
  }

  Future<void> generate(String task) async {
    final store = context.store,
        item = context.store.item(widget.itemId),
        scope = context.store.scope;
    if (item == null || busy != null) return;
    if (!store.canTask(task)) {
      notice(
        context,
        context.tr(
          'Tác vụ AI này chưa sẵn sàng. Kiểm tra kết nối trong Cài đặt.',
          'This AI task is unavailable. Check your connection in Settings.',
        ),
      );
      return;
    }
    if (task == 'quiz' &&
        item.questions.isNotEmpty &&
        !await confirm(
          context,
          context.tr(
            'Tạo bộ câu hỏi mới? Lịch sử điểm vẫn được giữ.',
            'Generate a new quiz? Previous scores are preserved.',
          ),
        )) {
      return;
    }
    if (!mounted) return;
    setState(() => busy = task);
    request = store.api;
    try {
      final result = await request!.study(
        task: task,
        source: item.source,
        language: store.language,
      );
      if (!mounted || scope != store.scope) return;
      final current = store.item(item.id);
      if (current == null) return;
      if (task == 'summary') {
        var summary = result['text'] as String? ?? '';
        if (result['summary'] is Map) {
          final s = object(result['summary']);
          summary =
              '${s['title']}\n\n${s['overview']}\n\n${(s['keyPoints'] as List? ?? []).map((v) => '• $v').join('\n')}';
          for (final chapter in s['chapters'] as List? ?? []) {
            summary += '\n\n${chapter['title']}\n${chapter['summary']}';
          }
        }
        if (summary.trim().isEmpty) throw const ApiFailure('INVALID_RESPONSE');
        await store.upsert(current.copyWith(summary: summary));
      } else if (task == 'cards') {
        final cards = (result['cards'] as List? ?? [])
            .map(
              (v) => StudyCard(
                id: newId(),
                front: v['front'],
                back: v['back'],
                due: DateTime.now(),
              ),
            )
            .toList();
        if (cards.isEmpty) throw const ApiFailure('INVALID_RESPONSE');
        final known = current.cards.map((v) => '${v.front}\n${v.back}').toSet();
        await store.upsert(
          current.copyWith(
            cards: [
              ...current.cards,
              ...cards.where((c) => known.add('${c.front}\n${c.back}')),
            ],
          ),
        );
      } else {
        final questions = (result['questions'] as List? ?? [])
            .map((v) => QuizQuestion.fromJson(object(v)))
            .toList();
        if (questions.isEmpty) throw const ApiFailure('INVALID_RESPONSE');
        await store.upsert(current.copyWith(questions: questions));
      }
      await store.activity('ai', itemId: item.id);
      unawaited(store.refreshAccount());
      if (mounted) {
        HapticFeedback.lightImpact();
        notice(
          context,
          context.tr(
            'Đã lưu kết quả. Hãy đối chiếu với học liệu gốc.',
            'Saved. Check the result against your source.',
          ),
        );
      }
    } catch (e) {
      if (mounted) notice(context, errorText(context, e));
    } finally {
      if (mounted) setState(() => busy = null);
      request = null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = context.store.item(widget.itemId);
    if (item == null) {
      return Scaffold(
        appBar: AppBar(),
        body: Center(
          child: Text(
            context.tr(
              'Học liệu không còn trong thư viện.',
              'This material is no longer in your library.',
            ),
          ),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(item.title, maxLines: 1, overflow: TextOverflow.ellipsis),
        actions: [
          PopupMenuButton<String>(
            onSelected: (value) async {
              if (value == 'edit') {
                await openEditor(context, item);
              } else if (await confirm(
                    context,
                    context.tr(
                      'Xóa học liệu và các thẻ/câu hỏi của học liệu này?',
                      'Delete this material and its cards/questions?',
                    ),
                  ) &&
                  context.mounted) {
                await runAction(
                  context,
                  () => context.store.deleteItem(item.id),
                );
                if (context.mounted) Navigator.pop(context);
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'edit',
                child: Text(context.tr('Sửa học liệu', 'Edit material')),
              ),
              PopupMenuItem(
                value: 'delete',
                child: Text(context.tr('Xóa', 'Delete')),
              ),
            ],
          ),
        ],
        bottom: TabBar(
          controller: tabs,
          isScrollable: true,
          tabs: [
            Tab(text: 'Studio'),
            Tab(text: context.tr('Nguồn', 'Source')),
            Tab(text: context.tr('Ghi chú', 'Notes')),
            Tab(text: context.tr('Luyện tập', 'Practice')),
          ],
        ),
      ),
      body: TabBarView(
        controller: tabs,
        children: [
          ScreenBody(
            children: [
              SectionTitle(
                context.tr(
                  'Một nguồn. Nhiều cách hiểu.',
                  'One source. More ways to learn.',
                ),
                subtitle: context.tr(
                  'AI hỗ trợ bạn học; luôn kiểm tra kết quả.',
                  'AI helps you learn; always verify its answers.',
                ),
              ),
              if (!context.store.canAI)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Surface(
                    child: Text(
                      context.tr(
                        'Ghép tài khoản trong Cài đặt để bật AI. Ghi chú, thẻ tự tạo và quiz vẫn dùng được ngoại tuyến.',
                        'Pair an account in Settings to enable AI. Notes, your own cards and quizzes work offline.',
                      ),
                    ),
                  ),
                ),
              LayoutBuilder(
                builder: (context, constraints) {
                  final width = constraints.maxWidth < 320
                      ? constraints.maxWidth
                      : (constraints.maxWidth - 12) / 2;
                  final tools = [
                    (
                      Icons.auto_awesome_outlined,
                      context.tr('Tóm tắt', 'Summary'),
                      context.tr('Giữ lại ý quan trọng', 'Keep the key ideas'),
                      () => generate('summary'),
                    ),
                    (
                      Icons.style_outlined,
                      'Flashcards',
                      context.tr(
                        'Luyện tự nhớ kiến thức',
                        'Practise active recall',
                      ),
                      () => generate('cards'),
                    ),
                    (
                      Icons.quiz_outlined,
                      'Quiz',
                      context.tr(
                        'Kiểm tra điều đã hiểu',
                        'Check understanding',
                      ),
                      () => generate('quiz'),
                    ),
                    (
                      Icons.forum_outlined,
                      context.tr('Hỏi Lumio', 'Ask Lumio'),
                      context.tr(
                        'Tháo gỡ từng câu hỏi',
                        'Work through a question',
                      ),
                      () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => TutorPage(itemId: item.id),
                        ),
                      ),
                    ),
                    (
                      Icons.graphic_eq_rounded,
                      context.tr('Giọng nói', 'Voice'),
                      context.tr(
                        'Nói, xem lại rồi gửi',
                        'Speak, review, then send',
                      ),
                      () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => VoicePage(itemId: item.id),
                        ),
                      ),
                    ),
                  ];
                  return Wrap(
                    spacing: 12,
                    runSpacing: 12,
                    children: [
                      for (final entry in tools.indexed)
                        SizedBox(
                          width: entry.$1 == 4 ? constraints.maxWidth : width,
                          child: StudyMotion(
                            order: entry.$1,
                            child: StudioTool(
                              icon: entry.$2.$1,
                              title: entry.$2.$2,
                              subtitle: entry.$2.$3,
                              onTap: busy == null ? entry.$2.$4 : null,
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              if (busy != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  child: Column(
                    children: [
                      const LinearProgressIndicator(),
                      const SizedBox(height: 10),
                      Text(
                        context.tr(
                          'Đang xử lý học liệu…',
                          'Working with your material…',
                        ),
                      ),
                      TextButton(
                        onPressed: () => request?.cancel(),
                        child: Text(
                          context.tr('Hủy yêu cầu', 'Cancel request'),
                        ),
                      ),
                    ],
                  ),
                ),
              if (item.summary.isNotEmpty) ...[
                SectionTitle(
                  context.tr('Tóm tắt đã lưu', 'Saved summary'),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        tooltip: context.tr('Sao chép', 'Copy'),
                        onPressed: () => Clipboard.setData(
                          ClipboardData(text: item.summary),
                        ),
                        icon: const Icon(Icons.copy_outlined),
                      ),
                      ShareLearningButton(
                        iconOnly: true,
                        draft: StudyShareDraft.fromItem(
                          item,
                          StudyShareSection.summary,
                        ),
                      ),
                    ],
                  ),
                ),
                StudyMotion(
                  key: ValueKey(item.summary),
                  child: Surface(
                    child: LearningText(
                      item.summary,
                      selectable: true,
                      language: context.store.language,
                      style: const TextStyle(height: 1.65),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              Text(
                context.tr(
                  'Khi dùng AI, nội dung học liệu được gửi đến máy chủ Lumio và có thể sử dụng credit của tài khoản.',
                  'Using AI sends the source to your Lumio server and may consume account credits.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
          ScreenBody(
            children: [
              SectionTitle(
                context.tr('Nội dung gốc', 'Original material'),
                trailing: ShareLearningButton(
                  iconOnly: true,
                  draft: StudyShareDraft.fromItem(
                    item,
                    StudyShareSection.source,
                  ),
                ),
              ),
              Surface(
                child: LearningText(
                  item.source,
                  selectable: true,
                  language: context.store.language,
                  style: const TextStyle(height: 1.65),
                ),
              ),
            ],
          ),
          NotesEditor(itemId: item.id),
          PracticeOverview(itemId: item.id),
        ],
      ),
    );
  }
}

class StudioTool extends StatelessWidget {
  const StudioTool({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });
  final IconData icon;
  final String title, subtitle;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Semantics(
      button: true,
      enabled: onTap != null,
      child: Surface(
        padding: EdgeInsets.zero,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: scheme.tertiaryContainer,
                        borderRadius: BorderRadius.circular(13),
                      ),
                      child: Icon(
                        icon,
                        color: scheme.onTertiaryContainer,
                        size: 23,
                      ),
                    ),
                    const Spacer(),
                    Icon(
                      Icons.arrow_outward_rounded,
                      size: 17,
                      color: scheme.onSurfaceVariant,
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(height: 1.4),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class NotesEditor extends StatefulWidget {
  const NotesEditor({super.key, required this.itemId});
  final String itemId;
  @override
  State<NotesEditor> createState() => _NotesEditorState();
}

class _NotesEditorState extends State<NotesEditor>
    with AutomaticKeepAliveClientMixin {
  TextEditingController? controller;
  bool dirty = false, saving = false;
  @override
  bool get wantKeepAlive => true;
  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final item = context.store.item(widget.itemId)!;
    controller ??= TextEditingController(text: item.notes);
    if (!dirty && controller!.text != item.notes) controller!.text = item.notes;
    return PopScope(
      canPop: !dirty,
      onPopInvokedWithResult: (didPop, _) async {
        if (!didPop &&
            !saving &&
            await confirm(
              context,
              context.tr('Bỏ ghi chú chưa lưu?', 'Discard unsaved notes?'),
            ) &&
            mounted) {
          setState(() => dirty = false);
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) Navigator.pop(context);
          });
        }
      },
      child: ScreenBody(
        children: [
          SectionTitle(
            context.tr('Viết lại bằng lời của bạn', 'Make it your own'),
            subtitle: context.tr(
              'Nhấn Lưu trước khi rời khỏi bài.',
              'Tap Save before leaving the material.',
            ),
          ),
          TextField(
            controller: controller,
            minLines: 15,
            maxLines: 30,
            maxLength: 100000,
            decoration: InputDecoration(
              hintText: context.tr(
                'Điều mình hiểu được là…',
                'Here is what I understand…',
              ),
            ),
            onChanged: (_) => setState(() => dirty = true),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: saving || !dirty
                ? null
                : () async {
                    final store = context.store;
                    setState(() => saving = true);
                    try {
                      final fresh = store.item(widget.itemId);
                      if (fresh != null) {
                        await store.upsert(
                          fresh.copyWith(notes: controller!.text),
                        );
                        if (controller!.text.trim().length >= 10) {
                          await store.activity('notes', itemId: fresh.id);
                        }
                      }
                      if (mounted) setState(() => dirty = false);
                    } catch (e) {
                      if (context.mounted) {
                        notice(context, errorText(context, e));
                      }
                    } finally {
                      if (mounted) setState(() => saving = false);
                    }
                  },
            icon: const Icon(Icons.save_outlined),
            label: Text(
              context.tr(
                saving
                    ? 'Đang lưu…'
                    : dirty
                    ? 'Lưu ghi chú'
                    : 'Đã lưu',
                saving
                    ? 'Saving…'
                    : dirty
                    ? 'Save notes'
                    : 'Saved',
              ),
            ),
          ),
          const SizedBox(height: 12),
          ShareLearningButton(
            draft: StudyShareDraft(title: item.title, text: controller!.text),
          ),
        ],
      ),
    );
  }
}

class TutorPage extends StatefulWidget {
  const TutorPage({super.key, required this.itemId});
  final String itemId;
  @override
  State<TutorPage> createState() => _TutorPageState();
}

class _TutorPageState extends State<TutorPage> {
  final question = TextEditingController();
  final messages = <Map<String, String>>[];
  bool busy = false;
  LumioApi? request;
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
      messages.clear();
      question.clear();
    }
  }

  void newExercise() {
    if (busy) return;
    setState(() {
      tutor.reset();
      messages.clear();
      question.clear();
    });
  }

  @override
  void dispose() {
    question.dispose();
    request?.cancel();
    super.dispose();
  }

  Future<void> send({bool full = false}) async {
    final store = context.store,
        item = context.store.item(widget.itemId),
        scope = context.store.scope;
    final prompt = full
        ? context.tr(
            'Em muốn đối chiếu lời giải đầy đủ của bài đang học.',
            'I would like to review the complete solution for the current exercise.',
          )
        : question.text.trim();
    if (prompt.isEmpty || item == null || busy) return;
    if (full && !tutor.canUnlock) {
      notice(context, errorText(context, const ApiFailure('TUTOR_LOCKED')));
      return;
    }
    if (!store.canTask('chat')) {
      notice(
        context,
        context.tr(
          'Kết nối AI trong Cài đặt trước.',
          'Connect AI in Settings first.',
        ),
      );
      return;
    }
    final generation = tutor.generation, activeRequest = store.api;
    setState(() {
      messages.add({'role': 'user', 'text': prompt});
      busy = true;
      question.clear();
    });
    request = activeRequest;
    try {
      final response = await activeRequest.study(
        task: 'chat',
        source: item.source,
        language: store.language,
        question: prompt,
        tutorSessionId: tutor.sessionId,
        guidance: full ? 'full' : 'hints',
      );
      if (!mounted || store.scope != scope || tutor.generation != generation) {
        return;
      }
      tutor.accept(response['tutor'], expectedGeneration: generation);
      final answer = response['text'];
      if (answer is! String || answer.trim().isEmpty) {
        throw const ApiFailure('INVALID_RESPONSE');
      }
      setState(() => messages.add({'role': 'assistant', 'text': answer}));
      await store.activity('chat', itemId: item.id);
      unawaited(store.refreshAccount());
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

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(context.tr('Hỏi Lumio', 'Ask Lumio')),
      actions: [
        IconButton(
          onPressed: busy ? null : newExercise,
          tooltip: context.tr('Bài mới', 'New exercise'),
          icon: const Icon(Icons.add_comment_outlined),
        ),
      ],
    ),
    body: Column(
      children: [
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              TutorProgress(snapshot: tutor.snapshot),
              const SizedBox(height: 12),
              OutlinedButton.icon(
                onPressed: busy || !tutor.canUnlock
                    ? null
                    : () => send(full: true),
                icon: const Icon(Icons.lock_open),
                label: Text(
                  context.tr('Đối chiếu lời giải', 'Review full solution'),
                ),
              ),
              if (messages.isEmpty)
                EmptyState(
                  icon: Icons.forum_outlined,
                  title: context.tr(
                    'Bắt đầu từ câu hỏi của bạn',
                    'Begin with your question',
                  ),
                  message: context.tr(
                    'Lumio dùng học liệu đang mở làm ngữ cảnh. Nội dung sẽ được gửi đến máy chủ khi bạn nhấn Gửi.',
                    'Lumio uses this material as context. Content is sent to your server when you tap Send.',
                  ),
                ),
              ...messages.map(
                (m) => Padding(
                  padding: const EdgeInsets.only(bottom: 14, top: 4),
                  child: Surface(
                    color: m['role'] == 'user'
                        ? Theme.of(context).colorScheme.secondaryContainer
                        : null,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m['role'] == 'user'
                              ? context.tr('Bạn', 'You')
                              : 'Lumio',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 10),
                        LearningText(
                          m['text']!,
                          selectable: true,
                          language: context.store.language,
                          style: const TextStyle(height: 1.6),
                        ),
                        if (m['role'] == 'assistant')
                          TextButton.icon(
                            onPressed: () => runAction(context, () async {
                              final store = context.store,
                                  item = context.store.item(widget.itemId);
                              if (item != null) {
                                await store.upsert(
                                  item.copyWith(
                                    notes: '${item.notes}\n\n${m['text']}'
                                        .trim(),
                                  ),
                                );
                                if (context.mounted) {
                                  notice(
                                    context,
                                    context.tr(
                                      'Đã lưu vào ghi chú.',
                                      'Saved to notes.',
                                    ),
                                  );
                                }
                              }
                            }),
                            icon: const Icon(Icons.note_add_outlined),
                            label: Text(
                              context.tr('Lưu vào ghi chú', 'Save to notes'),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
              if (busy) const LinearProgressIndicator(),
              const SizedBox(height: 20),
              Text(
                context.tr(
                  'AI có thể sai. Đối chiếu các thông tin quan trọng.',
                  'AI can be wrong. Verify important information.',
                ),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Expanded(
                  child: TextField(
                    controller: question,
                    minLines: 1,
                    maxLines: 5,
                    maxLength: 4000,
                    decoration: InputDecoration(
                      hintText: context.tr(
                        'Giải thích giúp mình…',
                        'Help me understand…',
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                IconButton.filled(
                  onPressed: busy ? () => request?.cancel() : send,
                  icon: Icon(
                    busy ? Icons.stop_rounded : Icons.arrow_upward_rounded,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
  );
}
