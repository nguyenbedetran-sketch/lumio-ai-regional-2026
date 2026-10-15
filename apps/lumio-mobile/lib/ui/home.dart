import 'package:flutter/material.dart';
import '../core/models.dart';
import 'common.dart';
import 'library.dart';
import 'practice.dart';
import 'focus.dart';
import 'study_motion.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});
  @override
  Widget build(BuildContext context) {
    final store = context.store;
    return ScreenBody(
      storageKey: 'home-scroll',
      children: [
        const SizedBox(height: 16),
        Appear(
          child: Container(
            padding: const EdgeInsets.all(27),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xff123b31), Color(0xff1e5142)],
              ),
              borderRadius: BorderRadius.circular(32),
              boxShadow: [
                BoxShadow(
                  color: ink.withValues(alpha: .13),
                  blurRadius: 24,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.wb_sunny_outlined, size: 19, color: mint),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        context.tr('MỘT CHÚT MỖI NGÀY', 'A LITTLE EVERY DAY'),
                        style: const TextStyle(
                          color: mint,
                          letterSpacing: 1.6,
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .09),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.auto_awesome_outlined,
                        color: mint,
                        size: 20,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 26),
                Text(
                  context.tr(
                    'Tập trung một chút.\nTiến xa hơn mỗi ngày.',
                    'A little focus.\nA little further.',
                  ),
                  style: const TextStyle(
                    fontSize: 34,
                    height: 1.2,
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    letterSpacing: -.7,
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  context.tr(
                    'Biến điều bạn đang học thành điều bạn thật sự hiểu.',
                    'Turn what you’re learning into something you understand.',
                  ),
                  style: const TextStyle(color: Color(0xffc1d2c7), height: 1.5),
                ),
                const SizedBox(height: 25),
                FilledButton.icon(
                  style: FilledButton.styleFrom(
                    backgroundColor: mint,
                    foregroundColor: ink,
                  ),
                  onPressed: () => openEditor(context),
                  icon: const Icon(Icons.add),
                  label: Text(context.tr('Thêm học liệu', 'Add material')),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),
        StudyMotion(
          order: 1,
          child: Row(
            children: [
              Metric(
                '${store.streak}',
                context.tr('Ngày học liên tục', 'Day streak'),
                Icons.local_fire_department_outlined,
              ),
              const SizedBox(width: 12),
              Metric(
                '${store.dueCount}',
                context.tr('Thẻ cần ôn', 'Cards due'),
                Icons.style_outlined,
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        const TodayRhythm(),
        SectionTitle(
          context.tr('Bước tiếp theo của bạn', 'Your next small step'),
        ),
        StudyMotion(
          order: 2,
          child: Surface(
            child: ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(
                backgroundColor: mint,
                child: Icon(
                  store.dueCount > 0
                      ? Icons.style_outlined
                      : Icons.timer_outlined,
                  color: ink,
                ),
              ),
              title: Text(
                store.dueCount > 0
                    ? context.tr(
                        'Ôn lại để nhớ lâu hơn',
                        'Review to remember longer',
                      )
                    : context.tr(
                        'Dành 25 phút cho một việc',
                        'Give one thing 25 minutes',
                      ),
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              subtitle: Padding(
                padding: const EdgeInsets.only(top: 5),
                child: Text(
                  store.dueCount > 0
                      ? context.tr(
                          '${store.dueCount} thẻ đang chờ bạn.',
                          '${store.dueCount} cards are ready for you.',
                        )
                      : context.tr(
                          'Chọn một học liệu, tắt bớt xao nhãng.',
                          'Choose a material and quiet the distractions.',
                        ),
                ),
              ),
              trailing: const Icon(Icons.arrow_forward),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => store.dueCount > 0
                      ? const ReviewPage()
                      : const FocusPage(),
                ),
              ),
            ),
          ),
        ),
        SectionTitle(context.tr('Tiếp tục khám phá', 'Keep exploring')),
        if (store.data.items.isEmpty)
          EmptyState(
            icon: Icons.auto_stories_outlined,
            title: context.tr(
              'Thư viện bắt đầu từ bạn',
              'Your library starts with you',
            ),
            message: context.tr(
              'Thêm nội dung của bạn hoặc mở ví dụ offline để thử ghi chú, thẻ và quiz.',
              'Add your content or open an offline example to try notes, cards and quizzes.',
            ),
            action: OutlinedButton(
              onPressed: () => sample(context),
              child: Text(
                context.tr('Thêm bài ví dụ offline', 'Add offline example'),
              ),
            ),
          )
        else
          ...store.data.items
              .take(3)
              .map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: ItemTile(item: item),
                ),
              ),
      ],
    );
  }

  Future<void> sample(BuildContext context) => runAction(context, () async {
    final now = DateTime.now();
    final vi = context.store.language == 'vi';
    await context.store.upsert(
      StudyItem(
        id: newId(),
        title: vi
            ? 'Ví dụ offline · Học chủ động'
            : 'Offline example · Active recall',
        source: vi
            ? 'Học chủ động là tự nhớ lại kiến thức thay vì chỉ đọc đi đọc lại. Bạn có thể che đáp án, trả lời câu hỏi bằng lời của mình rồi đối chiếu với tài liệu gốc.\n\nÔn tập ngắt quãng phân bố các lần học theo thời gian. Khi chưa nhớ, hãy ôn sớm hơn. Khi nhớ chắc, tăng dần khoảng cách giữa các lần ôn.\n\nĐây là học liệu ví dụ có sẵn, không phải kết quả do AI tạo.'
            : 'Active recall means retrieving knowledge rather than only rereading it. Hide the answer, explain in your own words, then compare with the source.\n\nSpaced practice distributes learning over time. Review sooner when recall is difficult and increase the interval when recall is reliable.\n\nThis is built-in example content, not AI-generated output.',
        createdAt: now,
        updatedAt: now,
        cards: [
          StudyCard(
            id: newId(),
            front: vi
                ? 'Học chủ động khác đọc lại như thế nào?'
                : 'How does active recall differ from rereading?',
            back: vi
                ? 'Tự nhớ và trả lời trước khi kiểm tra tài liệu.'
                : 'Retrieve an answer before checking the source.',
            due: now,
          ),
        ],
        questions: [
          QuizQuestion(
            id: newId(),
            prompt: vi
                ? 'Trước khi xem mặt sau của flashcard, bạn nên làm gì?'
                : 'What should you do before revealing a flashcard answer?',
            options: vi
                ? ['Tự nhớ và trả lời', 'Xem đáp án ngay', 'Bỏ qua mọi thẻ khó']
                : [
                    'Recall and answer',
                    'Reveal immediately',
                    'Skip all difficult cards',
                  ],
            correct: 0,
            explanation: vi
                ? 'Cố gắng nhớ lại trước khi đối chiếu là một cách luyện tập chủ động.'
                : 'Trying to retrieve an answer before checking is active recall.',
          ),
        ],
      ),
    );
  });
}

/// Daily checkmarks come only from saved reading, review and focus events.
class TodayRhythm extends StatelessWidget {
  const TodayRhythm({super.key});
  @override
  Widget build(BuildContext context) {
    final today = dayKey(DateTime.now());
    final events = context.store.data.events.where(
      (e) => dayKey(e.at.toLocal()) == today,
    );
    final kinds = events.map((e) => e.kind).toSet();
    final scheme = Theme.of(context).colorScheme;
    return Surface(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  context.tr('Nhịp hôm nay', 'Today’s rhythm'),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              ),
              Text(
                context.tr(
                  '${events.length} hoạt động',
                  '${events.length} activities',
                ),
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              for (final entry in [
                (
                  'read',
                  Icons.auto_stories_outlined,
                  context.tr('Đọc', 'Read'),
                ),
                (
                  'review',
                  Icons.style_outlined,
                  context.tr('Ôn thẻ', 'Review'),
                ),
                (
                  'focus',
                  Icons.timer_outlined,
                  context.tr('Tập trung', 'Focus'),
                ),
              ])
                Expanded(
                  child: Column(
                    children: [
                      AnimatedContainer(
                        duration: motionDuration(context, 300),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: kinds.contains(entry.$1)
                              ? scheme.secondaryContainer
                              : scheme.surface,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Icon(
                          kinds.contains(entry.$1)
                              ? Icons.check_rounded
                              : entry.$2,
                          color: kinds.contains(entry.$1)
                              ? scheme.primary
                              : scheme.onSurfaceVariant,
                          size: 22,
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        entry.$3,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelMedium,
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class ProgressPage extends StatelessWidget {
  const ProgressPage({super.key});
  @override
  Widget build(BuildContext context) {
    final store = context.store, events = context.store.data.events;
    final attempts = store.data.items.expand((i) => i.attempts).toList();
    final total = attempts.fold<int>(0, (n, a) => n + a.total),
        correct = attempts.fold<int>(0, (n, a) => n + a.correct);
    final focus = events
        .where((e) => e.kind == 'focus')
        .fold<int>(0, (n, e) => n + e.minutes);
    final now = DateTime.now();
    final days = List.generate(
      7,
      (i) => DateTime(now.year, now.month, now.day - 6 + i),
    );
    final counts = days
        .map(
          (d) =>
              events.where((e) => dayKey(e.at.toLocal()) == dayKey(d)).length,
        )
        .toList();
    final peak = counts.fold<int>(1, (n, v) => n > v ? n : v);
    final weekdays = store.language == 'vi'
        ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
        : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return ScreenBody(
      storageKey: 'progress-scroll',
      children: [
        SectionTitle(
          context.tr(
            'Những gì bạn đã dành cho việc học',
            'The time you gave to learning',
          ),
          subtitle: context.tr(
            'Từ hoạt động thực tế trên thiết bị này.',
            'From real activity on this device.',
          ),
        ),
        Row(
          children: [
            Metric(
              '${store.streak}',
              context.tr('Ngày liên tục', 'Day streak'),
              Icons.local_fire_department_outlined,
            ),
            const SizedBox(width: 12),
            Metric(
              '$focus',
              context.tr('Phút hoàn thành', 'Focus minutes'),
              Icons.timer_outlined,
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Metric(
              '${attempts.length}',
              context.tr('Lượt làm quiz', 'Quiz attempts'),
              Icons.quiz_outlined,
            ),
            const SizedBox(width: 12),
            Metric(
              total == 0 ? '—' : '${(correct / total * 100).round()}%',
              context.tr('Câu trả lời đúng', 'Correct answers'),
              Icons.task_alt,
            ),
          ],
        ),
        SectionTitle(context.tr('Nhịp học bảy ngày', 'Your seven-day rhythm')),
        Surface(
          child: SizedBox(
            height: 180,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(
                7,
                (i) => Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        '${counts[i]}',
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                      const SizedBox(height: 8),
                      AnimatedContainer(
                        duration: motionDuration(context, 400),
                        width: 20,
                        height: counts[i] == 0 ? 4 : 110 * counts[i] / peak,
                        decoration: BoxDecoration(
                          color: i == 6
                              ? Theme.of(context).colorScheme.primary
                              : Theme.of(
                                  context,
                                ).colorScheme.secondaryContainer,
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(weekdays[days[i].weekday - 1]),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          context.tr(
            'Streak ghi nhận ngày đọc học liệu, ghi chú, ôn thẻ, làm quiz hoặc hoàn thành tập trung. Điểm quiz là kết quả luyện tập, không phải thước đo năng lực.',
            'Streak counts days with reading, notes, card reviews, quizzes or completed focus sessions. Quiz scores reflect practice, not overall ability.',
          ),
          style: Theme.of(context).textTheme.bodySmall,
        ),
        SectionTitle(context.tr('Hoạt động gần đây', 'Recent activity')),
        if (events.isEmpty)
          EmptyState(
            icon: Icons.insights_outlined,
            title: context.tr('Chưa có hoạt động', 'No activity yet'),
            message: context.tr(
              'Bắt đầu một bài học để tự tạo nên tiến độ của bạn.',
              'Start a learning session to build your own progress.',
            ),
          )
        else
          ...events.reversed
              .take(15)
              .map(
                (e) => ListTile(
                  contentPadding: const EdgeInsets.symmetric(horizontal: 4),
                  leading: Icon(switch (e.kind) {
                    'focus' => Icons.timer_outlined,
                    'quiz' => Icons.quiz_outlined,
                    'review' => Icons.style_outlined,
                    'notes' => Icons.edit_note,
                    _ => Icons.auto_stories_outlined,
                  }),
                  title: Text(switch (e.kind) {
                    'focus' => context.tr(
                      'Hoàn thành ${e.minutes} phút tập trung',
                      'Completed ${e.minutes} focus minutes',
                    ),
                    'quiz' => context.tr('Hoàn thành quiz', 'Completed a quiz'),
                    'review' => context.tr(
                      'Ôn tập flashcard',
                      'Reviewed a flashcard',
                    ),
                    'notes' => context.tr('Viết ghi chú', 'Wrote notes'),
                    'chat' ||
                    'ai' => context.tr('Học cùng Lumio', 'Learned with Lumio'),
                    _ => context.tr('Đọc học liệu', 'Read material'),
                  }),
                  subtitle: Text(dayKey(e.at.toLocal())),
                ),
              ),
      ],
    );
  }
}
