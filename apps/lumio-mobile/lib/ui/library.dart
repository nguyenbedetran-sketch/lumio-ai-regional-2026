import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../core/models.dart';
import '../core/search.dart';
import 'common.dart';
import 'study.dart';
import 'study_motion.dart';

class LibraryPage extends StatefulWidget {
  const LibraryPage({super.key});
  @override
  State<LibraryPage> createState() => _LibraryPageState();
}

class _LibraryPageState extends State<LibraryPage> {
  String query = '';
  String filter = 'all';
  bool alphabetical = false;
  final searchIndex = <String, (StudyItem, String)>{};
  @override
  Widget build(BuildContext context) {
    final terms = searchText(
      query,
    ).split(RegExp(r'\s+')).where((v) => v.isNotEmpty).toList();
    final ids = context.store.data.items.map((i) => i.id).toSet();
    searchIndex.removeWhere((id, _) => !ids.contains(id));
    bool matches(StudyItem item) {
      if (terms.isEmpty) return true;
      final cached = searchIndex[item.id];
      final indexed = cached != null && identical(cached.$1, item)
          ? cached.$2
          : searchText(
              '${item.title} ${item.source} ${item.notes} ${item.summary}',
            );
      searchIndex[item.id] = (item, indexed);
      return terms.every(indexed.contains);
    }

    final items = context.store.data.items
        .where(
          (i) =>
              matches(i) &&
              switch (filter) {
                'cards' => i.cards.isNotEmpty,
                'quiz' => i.questions.isNotEmpty,
                'notes' => i.notes.trim().isNotEmpty,
                _ => true,
              },
        )
        .toList();
    items.sort(
      (a, b) => alphabetical
          ? searchText(a.title).compareTo(searchText(b.title))
          : b.updatedAt.compareTo(a.updatedAt),
    );
    return StudyMotion(
      child: ScreenBody(
        storageKey: 'library-scroll',
        children: [
          SectionTitle(
            context.tr('Thư viện của bạn', 'Your library'),
            subtitle: context.tr(
              'Lưu trên thiết bị · Có thể học ngoại tuyến',
              'On this device · Available offline',
            ),
            trailing: IconButton.filled(
              onPressed: () => openEditor(context),
              icon: const Icon(Icons.add),
            ),
          ),
          SearchBar(
            key: const ValueKey('library-search'),
            hintText: context.tr(
              'Tìm học liệu, ghi chú…',
              'Search materials and notes…',
            ),
            leading: const Icon(Icons.search),
            onChanged: (v) => setState(() => query = v),
          ),
          const SizedBox(height: 20),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                for (final entry in [
                  ('all', context.tr('Tất cả', 'All')),
                  ('cards', context.tr('Có thẻ ôn', 'Cards')),
                  ('quiz', 'Quiz'),
                  ('notes', context.tr('Ghi chú', 'Notes')),
                ])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(entry.$2),
                      selected: filter == entry.$1,
                      onSelected: (_) => setState(() => filter = entry.$1),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  context.tr(
                    '${items.length} học liệu',
                    '${items.length} materials',
                  ),
                  style: Theme.of(context).textTheme.labelLarge,
                ),
              ),
              TextButton.icon(
                onPressed: () => setState(() => alphabetical = !alphabetical),
                icon: const Icon(Icons.sort_rounded, size: 18),
                label: Text(
                  context.tr(
                    alphabetical ? 'Tên A–Z' : 'Mới cập nhật',
                    alphabetical ? 'Title A–Z' : 'Recently updated',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            EmptyState(
              icon: Icons.auto_stories_outlined,
              title: query.isNotEmpty || filter != 'all'
                  ? context.tr(
                      'Chưa có học liệu phù hợp',
                      'No matching material',
                    )
                  : context.tr(
                      'Bắt đầu với một điều tò mò',
                      'Start with a little curiosity',
                    ),
              message: context.tr(
                query.isNotEmpty || filter != 'all'
                    ? 'Thử đổi từ khóa hoặc bộ lọc. Tìm không dấu vẫn được.'
                    : 'Dán đoạn văn hoặc nhập tệp .txt của bạn. Nội dung chỉ được gửi đi khi bạn dùng AI.',
                query.isNotEmpty || filter != 'all'
                    ? 'Try another term or filter. Vietnamese accents are optional.'
                    : 'Paste text or import your .txt file. Content is sent only when you use AI.',
              ),
              action: FilledButton.icon(
                onPressed: () => openEditor(context),
                icon: const Icon(Icons.add),
                label: Text(context.tr('Thêm học liệu', 'Add material')),
              ),
            ),
          ...items.indexed.map(
            (entry) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: StudyMotion(
                key: ValueKey(entry.$2.id),
                order: entry.$1,
                child: ItemTile(item: entry.$2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ItemTile extends StatelessWidget {
  const ItemTile({super.key, required this.item});
  final StudyItem item;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final due = item.cards.where((c) => !c.due.isAfter(DateTime.now())).length;
    return Surface(
      padding: EdgeInsets.zero,
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 20,
          vertical: 12,
        ),
        leading: Container(
          width: 46,
          height: 54,
          decoration: BoxDecoration(
            color: scheme.tertiaryContainer,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(
            Icons.article_outlined,
            color: scheme.onTertiaryContainer,
          ),
        ),
        title: Text(
          item.title,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.tr(
                  '${item.cards.length} thẻ · ${item.questions.length} câu hỏi',
                  '${item.cards.length} cards · ${item.questions.length} questions',
                ),
              ),
              if (due > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text(
                    context.tr('$due thẻ đến hạn', '$due cards due'),
                    style: TextStyle(
                      color: scheme.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
            ],
          ),
        ),
        trailing: const Icon(Icons.arrow_outward_rounded, size: 19),
        onTap: () => Navigator.of(
          context,
        ).push(MaterialPageRoute(builder: (_) => StudyPage(itemId: item.id))),
      ),
    );
  }
}

Future<void> openEditor(BuildContext context, [StudyItem? item]) =>
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => MaterialEditor(item: item)));

class MaterialEditor extends StatefulWidget {
  const MaterialEditor({super.key, this.item});
  final StudyItem? item;
  @override
  State<MaterialEditor> createState() => _MaterialEditorState();
}

class _MaterialEditorState extends State<MaterialEditor> {
  late final title = TextEditingController(text: widget.item?.title),
      source = TextEditingController(text: widget.item?.source);
  bool busy = false, dirty = false;
  @override
  void dispose() {
    title.dispose();
    source.dispose();
    super.dispose();
  }

  Future<void> importText() async {
    try {
      final result = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: ['txt', 'md'],
      );
      if (result == null || !mounted) return;
      final file = result;
      if ((await file.length() ?? 800001) > 800000) {
        throw const FormatException('File too large');
      }
      final content = utf8.decode(await file.readAsBytes());
      if (content.length > 200000) throw const FormatException('Too much text');
      if (!mounted) return;
      setState(() {
        source.text = content;
        if (title.text.isEmpty) title.text = file.name;
        dirty = true;
      });
    } catch (e) {
      if (mounted) {
        notice(
          context,
          context.tr(
            'Tệp cần là UTF-8 .txt/.md và dưới 800 KB.',
            'Use a UTF-8 .txt/.md file below 800 KB.',
          ),
        );
      }
    }
  }

  Future<void> save() async {
    final store = context.store;
    if (title.text.trim().isEmpty || source.text.trim().isEmpty) {
      notice(
        context,
        context.tr(
          'Nhập tên và nội dung học liệu.',
          'Enter a title and learning content.',
        ),
      );
      return;
    }
    setState(() => busy = true);
    try {
      final now = DateTime.now();
      final item =
          widget.item?.copyWith(
            title: title.text.trim(),
            source: source.text.trim(),
          ) ??
          StudyItem(
            id: newId(),
            title: title.text.trim(),
            source: source.text.trim(),
            createdAt: now,
            updatedAt: now,
          );
      await store.upsert(item);
      if (mounted) {
        dirty = false;
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) notice(context, errorText(context, e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !dirty || busy,
    onPopInvokedWithResult: (didPop, _) async {
      if (!didPop &&
          await confirm(
            context,
            context.tr('Bỏ phần chỉnh sửa chưa lưu?', 'Discard unsaved edits?'),
          ) &&
          context.mounted) {
        setState(() => dirty = false);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) Navigator.pop(context);
        });
      }
    },
    child: Scaffold(
      appBar: AppBar(
        title: Text(
          context.tr(
            widget.item == null ? 'Học liệu mới' : 'Sửa học liệu',
            widget.item == null ? 'New material' : 'Edit material',
          ),
        ),
        actions: [
          TextButton(
            onPressed: busy ? null : save,
            child: Text(context.tr('Lưu', 'Save')),
          ),
        ],
      ),
      body: ScreenBody(
        children: [
          const SizedBox(height: 20),
          TextField(
            controller: title,
            maxLength: 120,
            decoration: InputDecoration(
              labelText: context.tr('Tên học liệu', 'Title'),
            ),
            onChanged: (_) => setState(() => dirty = true),
          ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: busy ? null : importText,
            icon: const Icon(Icons.upload_file_outlined),
            label: Text(context.tr('Nhập tệp văn bản', 'Import text file')),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: source,
            minLines: 14,
            maxLines: 26,
            maxLength: 200000,
            decoration: InputDecoration(
              labelText: context.tr('Nội dung gốc', 'Source content'),
              alignLabelWithHint: true,
            ),
            onChanged: (_) => setState(() => dirty = true),
          ),
          const SizedBox(height: 16),
          Text(
            context.tr(
              'Học liệu được lưu trên thiết bị này. Bạn có thể chỉnh sửa trước khi gửi cho Lumio.',
              'Material stays on this device. You can edit it before sending it to Lumio.',
            ),
          ),
          if (busy) const LinearProgressIndicator(),
        ],
      ),
    ),
  );
}
