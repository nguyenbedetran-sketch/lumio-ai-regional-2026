import 'dart:convert';
import 'dart:math';

String newId() =>
    '${DateTime.now().microsecondsSinceEpoch.toRadixString(36)}-${Random.secure().nextInt(1 << 32).toRadixString(36)}';
String dayKey(DateTime date) =>
    '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
DateTime readDate(dynamic value) => DateTime.parse(value as String);
Map<String, dynamic> object(dynamic value) =>
    Map<String, dynamic>.from(value as Map);

enum ReviewRating { again, hard, good, easy }

class StudyCard {
  const StudyCard({
    required this.id,
    required this.front,
    required this.back,
    required this.due,
    this.intervalDays = 0,
    this.reviews = 0,
  });
  final String id, front, back;
  final DateTime due;
  final int intervalDays, reviews;
  StudyCard rated(ReviewRating rating, DateTime now) {
    final next = switch (rating) {
      ReviewRating.again => 0,
      ReviewRating.hard => max(1, (intervalDays * 1.2).ceil()),
      ReviewRating.good =>
        intervalDays == 0 ? 1 : max(2, (intervalDays * 2.2).ceil()),
      ReviewRating.easy =>
        intervalDays == 0 ? 4 : max(4, (intervalDays * 3).ceil()),
    };
    return StudyCard(
      id: id,
      front: front,
      back: back,
      due: now.add(
        rating == ReviewRating.again
            ? const Duration(minutes: 10)
            : Duration(days: min(next, 365)),
      ),
      intervalDays: min(next, 365),
      reviews: reviews + 1,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'front': front,
    'back': back,
    'due': due.toIso8601String(),
    'intervalDays': intervalDays,
    'reviews': reviews,
  };
  factory StudyCard.fromJson(Map<String, dynamic> j) => StudyCard(
    id: j['id'],
    front: j['front'],
    back: j['back'],
    due: readDate(j['due']),
    intervalDays: j['intervalDays'] ?? 0,
    reviews: j['reviews'] ?? 0,
  );
}

class QuizQuestion {
  const QuizQuestion({
    required this.id,
    required this.prompt,
    required this.options,
    required this.correct,
    required this.explanation,
  });
  final String id, prompt, explanation;
  final List<String> options;
  final int correct;
  Map<String, dynamic> toJson() => {
    'id': id,
    'prompt': prompt,
    'options': options,
    'correct': correct,
    'explanation': explanation,
  };
  factory QuizQuestion.fromJson(Map<String, dynamic> j) {
    final options = List<String>.from(j['options']);
    final correct = j['correct'];
    if (options.length < 2 ||
        options.length > 6 ||
        correct is! int ||
        correct < 0 ||
        correct >= options.length) {
      throw const FormatException('Invalid quiz');
    }
    return QuizQuestion(
      id: j['id'] ?? newId(),
      prompt: j['prompt'],
      options: options,
      correct: correct,
      explanation: j['explanation'] ?? '',
    );
  }
}

class QuizAttempt {
  const QuizAttempt({
    required this.id,
    required this.at,
    required this.correct,
    required this.total,
  });
  final String id;
  final DateTime at;
  final int correct, total;
  Map<String, dynamic> toJson() => {
    'id': id,
    'at': at.toIso8601String(),
    'correct': correct,
    'total': total,
  };
  factory QuizAttempt.fromJson(Map<String, dynamic> j) => QuizAttempt(
    id: j['id'],
    at: readDate(j['at']),
    correct: j['correct'],
    total: j['total'],
  );
}

QuizAttempt gradeQuiz(
  List<QuizQuestion> questions,
  List<int> answers,
  DateTime at,
) {
  if (questions.isEmpty || answers.length != questions.length) {
    throw const FormatException('Incomplete quiz');
  }
  var correct = 0;
  for (var i = 0; i < questions.length; i++) {
    if (answers[i] < 0 || answers[i] >= questions[i].options.length) {
      throw const FormatException('Invalid answer');
    }
    if (answers[i] == questions[i].correct) correct++;
  }
  return QuizAttempt(
    id: newId(),
    at: at,
    correct: correct,
    total: questions.length,
  );
}

class StudyItem {
  const StudyItem({
    required this.id,
    required this.title,
    required this.source,
    required this.createdAt,
    required this.updatedAt,
    this.notes = '',
    this.summary = '',
    this.cards = const [],
    this.questions = const [],
    this.attempts = const [],
  });
  final String id, title, source, notes, summary;
  final DateTime createdAt, updatedAt;
  final List<StudyCard> cards;
  final List<QuizQuestion> questions;
  final List<QuizAttempt> attempts;
  StudyItem copyWith({
    String? title,
    String? source,
    String? notes,
    String? summary,
    List<StudyCard>? cards,
    List<QuizQuestion>? questions,
    List<QuizAttempt>? attempts,
  }) => StudyItem(
    id: id,
    title: title ?? this.title,
    source: source ?? this.source,
    createdAt: createdAt,
    updatedAt: DateTime.now(),
    notes: notes ?? this.notes,
    summary: summary ?? this.summary,
    cards: cards ?? this.cards,
    questions: questions ?? this.questions,
    attempts: attempts ?? this.attempts,
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    'source': source,
    'createdAt': createdAt.toIso8601String(),
    'updatedAt': updatedAt.toIso8601String(),
    'notes': notes,
    'summary': summary,
    'cards': cards.map((v) => v.toJson()).toList(),
    'questions': questions.map((v) => v.toJson()).toList(),
    'attempts': attempts.map((v) => v.toJson()).toList(),
  };
  factory StudyItem.fromJson(Map<String, dynamic> j) => StudyItem(
    id: j['id'],
    title: j['title'],
    source: j['source'],
    createdAt: readDate(j['createdAt']),
    updatedAt: readDate(j['updatedAt']),
    notes: j['notes'] ?? '',
    summary: j['summary'] ?? '',
    cards: (j['cards'] as List? ?? [])
        .map((v) => StudyCard.fromJson(object(v)))
        .toList(),
    questions: (j['questions'] as List? ?? [])
        .map((v) => QuizQuestion.fromJson(object(v)))
        .toList(),
    attempts: (j['attempts'] as List? ?? [])
        .map((v) => QuizAttempt.fromJson(object(v)))
        .toList(),
  );
}

class StudyEvent {
  const StudyEvent({
    required this.id,
    required this.kind,
    required this.at,
    this.itemId = '',
    this.minutes = 0,
  });
  final String id, kind, itemId;
  final DateTime at;
  final int minutes;
  Map<String, dynamic> toJson() => {
    'id': id,
    'kind': kind,
    'at': at.toIso8601String(),
    'itemId': itemId,
    'minutes': minutes,
  };
  factory StudyEvent.fromJson(Map<String, dynamic> j) => StudyEvent(
    id: j['id'],
    kind: j['kind'],
    at: readDate(j['at']),
    itemId: j['itemId'] ?? '',
    minutes: j['minutes'] ?? 0,
  );
}

class FocusSession {
  const FocusSession({
    required this.id,
    required this.totalSeconds,
    required this.remainingSeconds,
    this.endsAt,
  });
  final String id;
  final int totalSeconds, remainingSeconds;
  final DateTime? endsAt;
  int remaining(DateTime now) => endsAt == null
      ? remainingSeconds
      : max(0, (endsAt!.difference(now).inMilliseconds / 1000).ceil());
  FocusSession resume(DateTime now) => FocusSession(
    id: id,
    totalSeconds: totalSeconds,
    remainingSeconds: remainingSeconds,
    endsAt: now.add(Duration(seconds: remainingSeconds)),
  );
  FocusSession pause(DateTime now) => FocusSession(
    id: id,
    totalSeconds: totalSeconds,
    remainingSeconds: remaining(now),
  );
  Map<String, dynamic> toJson() => {
    'id': id,
    'totalSeconds': totalSeconds,
    'remainingSeconds': remainingSeconds,
    'endsAt': endsAt?.toIso8601String(),
  };
  factory FocusSession.fromJson(Map<String, dynamic> j) => FocusSession(
    id: j['id'],
    totalSeconds: j['totalSeconds'],
    remainingSeconds: j['remainingSeconds'],
    endsAt: j['endsAt'] == null ? null : readDate(j['endsAt']),
  );
}

class LibraryData {
  const LibraryData({
    this.items = const [],
    this.events = const [],
    this.focus,
  });
  final List<StudyItem> items;
  final List<StudyEvent> events;
  final FocusSession? focus;
  Map<String, dynamic> toJson() => {
    'version': 1,
    'items': items.map((v) => v.toJson()).toList(),
    'events': events.map((v) => v.toJson()).toList(),
    'focus': focus?.toJson(),
  };
  factory LibraryData.fromJson(Map<String, dynamic> j) {
    if (j['version'] != 1 ||
        j['items'] is! List ||
        j['events'] is! List ||
        (j['items'] as List).length > 1000) {
      throw const FormatException('Invalid library');
    }
    final data = LibraryData(
      items: (j['items'] as List)
          .map((v) => StudyItem.fromJson(object(v)))
          .toList(),
      events: (j['events'] as List)
          .map((v) => StudyEvent.fromJson(object(v)))
          .toList(),
      focus: j['focus'] == null
          ? null
          : FocusSession.fromJson(object(j['focus'])),
    );
    if (data.items.map((i) => i.id).toSet().length != data.items.length) {
      throw const FormatException('Duplicate item');
    }
    return data;
  }
  String encode() => jsonEncode(toJson());
}

int studyStreak(Iterable<StudyEvent> events, DateTime now) {
  final days = events
      .where((e) => !e.at.isAfter(now))
      .map((e) => dayKey(e.at.toLocal()))
      .toSet();
  var cursor = DateTime(now.year, now.month, now.day);
  if (!days.contains(dayKey(cursor))) {
    cursor = DateTime(cursor.year, cursor.month, cursor.day - 1);
  }
  var count = 0;
  while (days.contains(dayKey(cursor))) {
    count++;
    cursor = DateTime(cursor.year, cursor.month, cursor.day - 1);
  }
  return count;
}
