import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/models.dart';
import 'common.dart';
import 'math_text.dart';
import '../core/study_share.dart';
import 'study_share.dart';
import 'study_motion.dart';

class PracticeOverview extends StatelessWidget {
  const PracticeOverview({super.key, required this.itemId});
  final String itemId;
  @override
  Widget build(BuildContext context) {
    final item = context.store.item(itemId)!;
    final due = item.cards.where((c) => !c.due.isAfter(DateTime.now())).length;
    return ScreenBody(
      children: [
        SectionTitle(
          context.tr('Học bằng cách tự nhớ lại', 'Learn by active recall'),
        ),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.style_outlined, size: 38),
              const SizedBox(height: 14),
              Text(
                context.tr(
                  '$due thẻ đến hạn · ${item.cards.length} thẻ',
                  '$due due · ${item.cards.length} cards',
                ),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: due == 0
                    ? null
                    : () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ReviewPage(itemId: itemId),
                        ),
                      ),
                child: Text(context.tr('Ôn tập ngay', 'Review now')),
              ),
              TextButton.icon(
                onPressed: () => addCard(context, itemId),
                icon: const Icon(Icons.add),
                label: Text(
                  context.tr('Tự tạo flashcard', 'Create your own card'),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.quiz_outlined, size: 38),
              const SizedBox(height: 14),
              Text(
                context.tr(
                  '${item.questions.length} câu hỏi',
                  '${item.questions.length} questions',
                ),
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 18),
              FilledButton(
                onPressed: item.questions.isEmpty
                    ? null
                    : () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => QuizPage(
                            itemId: itemId,
                            questions: List.of(item.questions),
                          ),
                        ),
                      ),
                child: Text(context.tr('Bắt đầu quiz', 'Start quiz')),
              ),
              TextButton.icon(
                onPressed: () => addQuestion(context, itemId),
                icon: const Icon(Icons.add),
                label: Text(context.tr('Tự tạo câu hỏi', 'Create a question')),
              ),
            ],
          ),
        ),
        if (item.attempts.isNotEmpty) ...[
          SectionTitle(context.tr('Lịch sử làm bài', 'Attempt history')),
          ...item.attempts.reversed
              .take(10)
              .map(
                (a) => ListTile(
                  leading: const Icon(Icons.task_alt),
                  title: Text('${a.correct} / ${a.total}'),
                  subtitle: Text(dayKey(a.at.toLocal())),
                ),
              ),
        ],
      ],
    );
  }
}

Future<void> addCard(BuildContext context, String itemId) async {
  final front = TextEditingController(), back = TextEditingController();
  final store = context.store;
  final accepted = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(store.t('Flashcard mới', 'New flashcard')),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: front,
              maxLength: 1000,
              decoration: InputDecoration(
                labelText: store.t('Câu hỏi / mặt trước', 'Question / front'),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: back,
              maxLength: 4000,
              minLines: 3,
              maxLines: 6,
              decoration: InputDecoration(
                labelText: store.t('Đáp án / mặt sau', 'Answer / back'),
              ),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(store.t('Hủy', 'Cancel')),
        ),
        FilledButton(
          onPressed: () {
            if (front.text.trim().isNotEmpty && back.text.trim().isNotEmpty) {
              Navigator.pop(ctx, true);
            }
          },
          child: Text(store.t('Thêm', 'Add')),
        ),
      ],
    ),
  );
  if (accepted == true && context.mounted) {
    await runAction(context, () async {
      final item = store.item(itemId);
      if (item != null) {
        await store.upsert(
          item.copyWith(
            cards: [
              ...item.cards,
              StudyCard(
                id: newId(),
                front: front.text.trim(),
                back: back.text.trim(),
                due: DateTime.now(),
              ),
            ],
          ),
        );
      }
    });
  }
  front.dispose();
  back.dispose();
}

Future<void> addQuestion(BuildContext context, String itemId) async {
  final store = context.store,
      prompt = TextEditingController(),
      explanation = TextEditingController();
  final options = List.generate(4, (_) => TextEditingController());
  var correct = 0;
  final accepted = await showDialog<bool>(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, update) => AlertDialog(
        title: Text(store.t('Câu hỏi mới', 'New question')),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: prompt,
                maxLength: 1500,
                decoration: InputDecoration(
                  labelText: store.t('Câu hỏi', 'Question'),
                ),
              ),
              ...List.generate(
                4,
                (i) => Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: TextField(
                    controller: options[i],
                    maxLength: 500,
                    decoration: InputDecoration(
                      labelText:
                          '${String.fromCharCode(65 + i)} · ${store.t('Lựa chọn', 'Option')}',
                    ),
                  ),
                ),
              ),
              DropdownButtonFormField<int>(
                initialValue: correct,
                decoration: InputDecoration(
                  labelText: store.t('Đáp án đúng', 'Correct answer'),
                ),
                items: List.generate(
                  4,
                  (i) => DropdownMenuItem(
                    value: i,
                    child: Text(String.fromCharCode(65 + i)),
                  ),
                ),
                onChanged: (v) => update(() => correct = v!),
              ),
              TextField(
                controller: explanation,
                maxLength: 2000,
                decoration: InputDecoration(
                  labelText: store.t('Giải thích', 'Explanation'),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(store.t('Hủy', 'Cancel')),
          ),
          FilledButton(
            onPressed: () {
              if (prompt.text.trim().isNotEmpty &&
                  options.every((v) => v.text.trim().isNotEmpty)) {
                Navigator.pop(ctx, true);
              }
            },
            child: Text(store.t('Thêm', 'Add')),
          ),
        ],
      ),
    ),
  );
  if (accepted == true && context.mounted) {
    await runAction(context, () async {
      final item = store.item(itemId);
      if (item != null) {
        await store.upsert(
          item.copyWith(
            questions: [
              ...item.questions,
              QuizQuestion(
                id: newId(),
                prompt: prompt.text.trim(),
                options: options.map((v) => v.text.trim()).toList(),
                correct: correct,
                explanation: explanation.text.trim(),
              ),
            ],
          ),
        );
      }
    });
  }
  prompt.dispose();
  explanation.dispose();
  for (final value in options) {
    value.dispose();
  }
}

class ReviewPage extends StatefulWidget {
  const ReviewPage({super.key, this.itemId});
  final String? itemId;
  @override
  State<ReviewPage> createState() => _ReviewPageState();
}

class _ReviewPageState extends State<ReviewPage> {
  bool flipped = false, busy = false;
  int reviewed = 0;
  final completed = <String>{};
  @override
  Widget build(BuildContext context) {
    final due = context.store.data.items
        .where((i) => widget.itemId == null || i.id == widget.itemId)
        .expand(
          (i) => i.cards
              .where(
                (c) =>
                    !c.due.isAfter(DateTime.now()) && !completed.contains(c.id),
              )
              .map((c) => (item: i, card: c)),
        )
        .toList();
    if (due.isEmpty) {
      return Scaffold(
        appBar: AppBar(title: Text(context.tr('Ôn tập', 'Review'))),
        body: ScreenBody(
          children: [
            const SizedBox(height: 50),
            EmptyState(
              icon: Icons.celebration_outlined,
              title: context.tr(
                'Đã ôn xong lượt này',
                'This review is complete',
              ),
              message: context.tr(
                'Bạn đã ôn $reviewed thẻ. Những thẻ khó sẽ quay lại theo lịch.',
                'You reviewed $reviewed cards. Difficult cards return on their schedule.',
              ),
              action: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: Text(context.tr('Hoàn tất', 'Done')),
              ),
            ),
          ],
        ),
      );
    }
    final current = due.first;
    return Scaffold(
      appBar: AppBar(
        title: Text(context.tr('Ôn tập chủ động', 'Active recall')),
      ),
      body: ScreenBody(
        children: [
          SectionTitle(
            current.item.title,
            subtitle: context.tr(
              'Còn ${due.length} thẻ đến hạn',
              '${due.length} cards due',
            ),
          ),
          Semantics(
            label: context.tr(
              'Đã ôn $reviewed trong ${reviewed + due.length} thẻ',
              '$reviewed of ${reviewed + due.length} cards reviewed',
            ),
            child: LinearProgressIndicator(
              value: reviewed / (reviewed + due.length),
              minHeight: 5,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(height: 20),
          CardReveal(
            key: ValueKey(current.card.id),
            flipped: flipped,
            front: ReviewCardFace(text: current.card.front, answer: false),
            back: ReviewCardFace(text: current.card.back, answer: true),
          ),
          const SizedBox(height: 24),
          if (!flipped)
            FilledButton.icon(
              onPressed: () {
                HapticFeedback.selectionClick();
                setState(() => flipped = true);
              },
              icon: const Icon(Icons.flip_rounded),
              label: Text(context.tr('Xem đáp án', 'Reveal answer')),
            )
          else ...[
            Text(
              context.tr('Bạn nhớ ở mức nào?', 'How well did you recall it?'),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 14),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 8,
              runSpacing: 8,
              children: ReviewRating.values
                  .map(
                    (rating) => FilledButton.tonal(
                      onPressed: busy
                          ? null
                          : () async {
                              setState(() => busy = true);
                              try {
                                await context.store.review(
                                  current.item.id,
                                  current.card.id,
                                  rating,
                                );
                                if (mounted) {
                                  HapticFeedback.lightImpact();
                                  setState(() {
                                    completed.add(current.card.id);
                                    reviewed++;
                                    flipped = false;
                                  });
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  notice(context, errorText(context, e));
                                }
                              } finally {
                                if (mounted) setState(() => busy = false);
                              }
                            },
                      child: Text(switch (rating) {
                        ReviewRating.again => context.tr(
                          'Học lại · 10 phút',
                          'Again · 10 min',
                        ),
                        ReviewRating.hard => context.tr('Khó', 'Hard'),
                        ReviewRating.good => context.tr('Nhớ', 'Good'),
                        ReviewRating.easy => context.tr('Dễ', 'Easy'),
                      }),
                    ),
                  )
                  .toList(),
            ),
          ],
          if (flipped) ...[
            const SizedBox(height: 20),
            ShareLearningButton(
              draft: StudyShareDraft.card(
                current.item.title,
                current.card,
                english: context.store.language == 'en',
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class ReviewCardFace extends StatelessWidget {
  const ReviewCardFace({super.key, required this.text, required this.answer});
  final String text;
  final bool answer;
  @override
  Widget build(BuildContext context) => Surface(
    color: answer ? Theme.of(context).colorScheme.secondaryContainer : null,
    padding: const EdgeInsets.all(26),
    child: ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 280),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            answer
                ? Icons.lightbulb_outline_rounded
                : Icons.psychology_outlined,
            color: Theme.of(context).colorScheme.primary,
          ),
          const SizedBox(height: 16),
          Text(
            context.tr(
              answer ? 'ĐÁP ÁN' : 'TỰ NHỚ TRƯỚC KHI LẬT',
              answer ? 'ANSWER' : 'RECALL BEFORE REVEALING',
            ),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.labelMedium,
          ),
          const SizedBox(height: 26),
          LearningText(
            text,
            selectable: true,
            language: context.store.language,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(height: 1.5),
          ),
        ],
      ),
    ),
  );
}

class QuizPage extends StatefulWidget {
  const QuizPage({super.key, required this.itemId, required this.questions});
  final String itemId;
  final List<QuizQuestion> questions;
  @override
  State<QuizPage> createState() => _QuizPageState();
}

class _QuizPageState extends State<QuizPage> {
  int index = 0;
  int? selected;
  final answers = <int>[];
  QuizAttempt? result;
  bool saving = false;
  Future<void> next() async {
    if (selected == null || saving) return;
    if (index + 1 < widget.questions.length) {
      setState(() {
        answers.add(selected!);
        index++;
        selected = null;
      });
      return;
    }
    final attempt = gradeQuiz(widget.questions, [
      ...answers,
      selected!,
    ], DateTime.now());
    setState(() => saving = true);
    try {
      await context.store.finishQuiz(widget.itemId, attempt);
      if (mounted) setState(() => result = attempt);
    } catch (e) {
      if (mounted) notice(context, errorText(context, e));
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (result != null) {
      return Scaffold(
        appBar: AppBar(
          title: Text(context.tr('Kết quả lần làm bài', 'This attempt')),
        ),
        body: ScreenBody(
          children: [
            const SizedBox(height: 45),
            StudyMotion(
              feedback: true,
              child: QuizResultCard(attempt: result!),
            ),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => Navigator.pop(context),
              child: Text(context.tr('Hoàn tất', 'Done')),
            ),
          ],
        ),
      );
    }
    final q = widget.questions[index];
    return Scaffold(
      appBar: AppBar(
        title: Text('Quiz · ${index + 1}/${widget.questions.length}'),
      ),
      body: ScreenBody(
        children: [
          const SizedBox(height: 12),
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: index / widget.questions.length),
            duration: motionDuration(context, 320),
            builder: (context, value, _) => LinearProgressIndicator(
              value: value,
              minHeight: 5,
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          const SizedBox(height: 28),
          LearningText(
            q.prompt,
            language: context.store.language,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w700,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          ...List.generate(
            q.options.length,
            (i) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: QuizOption(
                key: ValueKey('answer-$index-$i'),
                text: q.options[i],
                letter: String.fromCharCode(65 + i),
                selected: selected == i,
                correctness: selected == null
                    ? null
                    : i == q.correct
                    ? true
                    : i == selected
                    ? false
                    : null,
                onTap: selected == null
                    ? () {
                        HapticFeedback.selectionClick();
                        setState(() => selected = i);
                      }
                    : null,
              ),
            ),
          ),
          if (selected != null) ...[
            const SizedBox(height: 16),
            StudyMotion(
              key: ValueKey('feedback-$index-$selected'),
              feedback: true,
              child: Surface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      context.tr(
                        selected == q.correct ? 'Chính xác' : 'Cùng xem lại',
                        selected == q.correct ? 'Correct' : 'Let’s review',
                      ),
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    LearningText(
                      q.explanation.isNotEmpty
                          ? q.explanation
                          : q.options[q.correct],
                      style: const TextStyle(height: 1.5),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 22),
            FilledButton(
              onPressed: saving ? null : next,
              child: Text(
                context.tr(
                  saving
                      ? 'Đang lưu…'
                      : index + 1 == widget.questions.length
                      ? 'Hoàn thành'
                      : 'Câu tiếp theo',
                  saving
                      ? 'Saving…'
                      : index + 1 == widget.questions.length
                      ? 'Finish'
                      : 'Next question',
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class QuizOption extends StatelessWidget {
  const QuizOption({
    super.key,
    required this.text,
    required this.letter,
    required this.selected,
    this.correctness,
    this.onTap,
  });
  final String text, letter;
  final bool selected;
  final bool? correctness;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = correctness == true
        ? scheme.secondaryContainer
        : correctness == false
        ? scheme.errorContainer
        : scheme.surfaceContainerLow;
    final foreground = correctness == true
        ? scheme.onSecondaryContainer
        : correctness == false
        ? scheme.onErrorContainer
        : scheme.onSurface;
    return Semantics(
      button: true,
      selected: selected,
      enabled: onTap != null,
      child: AnimatedContainer(
        duration: motionDuration(context, 260),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: correctness == true
                ? scheme.primary
                : correctness == false
                ? scheme.error
                : scheme.outlineVariant,
          ),
        ),
        child: Material(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(20),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Row(
                children: [
                  Container(
                    width: 32,
                    height: 32,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: foreground.withValues(alpha: .07),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      letter,
                      style: TextStyle(
                        color: foreground,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: LearningText(
                      text,
                      language: context.store.language,
                      style: TextStyle(color: foreground, height: 1.5),
                    ),
                  ),
                  if (correctness != null)
                    Padding(
                      padding: const EdgeInsets.only(left: 12),
                      child: StudyMotion(
                        feedback: true,
                        child: Icon(
                          correctness!
                              ? Icons.check_circle_outline_rounded
                              : Icons.close_rounded,
                          color: foreground,
                          semanticLabel: context.tr(
                            correctness! ? 'Đáp án đúng' : 'Cần xem lại',
                            correctness!
                                ? 'Correct answer'
                                : 'Review this answer',
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class QuizResultCard extends StatelessWidget {
  const QuizResultCard({super.key, required this.attempt});
  final QuizAttempt attempt;
  @override
  Widget build(BuildContext context) {
    final ratio = attempt.total == 0 ? 0.0 : attempt.correct / attempt.total;
    final scheme = Theme.of(context).colorScheme;
    return Surface(
      child: Column(
        children: [
          SizedBox(
            width: 154,
            height: 154,
            child: Stack(
              alignment: Alignment.center,
              children: [
                SizedBox.expand(
                  child: TweenAnimationBuilder<double>(
                    tween: Tween(begin: 0, end: ratio),
                    duration: motionDuration(context, 650),
                    curve: Curves.easeOutCubic,
                    builder: (context, value, _) => CircularProgressIndicator(
                      value: value,
                      strokeWidth: 8,
                      strokeCap: StrokeCap.round,
                      color: scheme.tertiary,
                      backgroundColor: scheme.tertiaryContainer,
                    ),
                  ),
                ),
                Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      '${attempt.correct} / ${attempt.total}',
                      style: Theme.of(context).textTheme.headlineLarge
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      context.tr('câu đúng', 'correct'),
                      style: Theme.of(context).textTheme.labelLarge,
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Text(
            context.tr(
              'Một bước hiểu bài hơn.',
              'One step closer to understanding.',
            ),
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 12),
          Text(
            context.tr(
              'Kết quả lần luyện tập này đã lưu trong tiến độ. Ôn lại phần chưa chắc trước khi làm lượt tiếp theo.',
              'This practice score is saved to progress. Review what felt uncertain before your next attempt.',
            ),
            textAlign: TextAlign.center,
            style: const TextStyle(height: 1.6),
          ),
        ],
      ),
    );
  }
}
