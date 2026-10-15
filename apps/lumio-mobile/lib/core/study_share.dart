import 'models.dart';

enum StudyShareSection { source, notes, summary }

/// Only the explicitly chosen text crosses this boundary. No account/session,
/// progress, attachments, other notes or backup objects are accepted here.
class StudyShareDraft {
  const StudyShareDraft({required this.title, required this.text});
  static const maxCharacters = 24000;
  final String title;
  final String text;

  factory StudyShareDraft.fromItem(StudyItem item, StudyShareSection section) =>
      StudyShareDraft(
        title: item.title,
        text: switch (section) {
          StudyShareSection.source => item.source,
          StudyShareSection.notes => item.notes,
          StudyShareSection.summary => item.summary,
        },
      );

  factory StudyShareDraft.card(
    String title,
    StudyCard card, {
    bool english = false,
  }) => StudyShareDraft(
    title: title,
    text:
        '${english ? 'Question' : 'Câu hỏi'}: ${card.front}\n\n'
        '${english ? 'Answer' : 'Đáp án'}: ${card.back}',
  );

  static bool valid(String text) =>
      text.trim().isNotEmpty && text.length <= maxCharacters;

  String message(String editedText) {
    if (!valid(editedText)) throw const FormatException('Invalid share text');
    return '${title.trim()}\n\n${editedText.trim()}'.trim();
  }
}
