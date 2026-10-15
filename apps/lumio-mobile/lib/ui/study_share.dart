import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../core/study_share.dart';
import 'common.dart';

typedef StudyShareAction = Future<ShareResult> Function(ShareParams params);

class ShareLearningButton extends StatelessWidget {
  const ShareLearningButton({
    super.key,
    required this.draft,
    this.iconOnly = false,
    this.shareAction,
  });
  final StudyShareDraft draft;
  final bool iconOnly;
  final StudyShareAction? shareAction;

  @override
  Widget build(BuildContext context) {
    final enabled = draft.text.trim().isNotEmpty;
    void open() => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) =>
          ShareLearningSheet(draft: draft, shareAction: shareAction),
    );
    if (iconOnly) {
      return IconButton(
        tooltip: context.tr('Chia sẻ nội dung này', 'Share this content'),
        onPressed: enabled ? open : null,
        icon: const Icon(Icons.ios_share_rounded),
      );
    }
    return OutlinedButton.icon(
      onPressed: enabled ? open : null,
      icon: const Icon(Icons.ios_share_rounded),
      label: Text(context.tr('Chia sẻ nội dung này', 'Share this content')),
    );
  }
}

class ShareLearningSheet extends StatefulWidget {
  const ShareLearningSheet({super.key, required this.draft, this.shareAction});
  final StudyShareDraft draft;
  final StudyShareAction? shareAction;
  @override
  State<ShareLearningSheet> createState() => _ShareLearningSheetState();
}

class _ShareLearningSheetState extends State<ShareLearningSheet> {
  late final editor = TextEditingController(text: widget.draft.text);
  bool busy = false;
  String? status;
  @override
  void dispose() {
    editor.dispose();
    super.dispose();
  }

  Future<void> share(BuildContext buttonContext) async {
    if (busy || !StudyShareDraft.valid(editor.text)) return;
    final box = buttonContext.findRenderObject() as RenderBox?;
    final origin = box != null && box.hasSize
        ? box.localToGlobal(Offset.zero) & box.size
        : null;
    setState(() {
      busy = true;
      status = null;
    });
    try {
      final result = await (widget.shareAction ?? SharePlus.instance.share)(
        ShareParams(
          text: widget.draft.message(editor.text),
          title: widget.draft.title,
          subject: widget.draft.title,
          sharePositionOrigin: origin,
          downloadFallbackEnabled: false,
        ),
      );
      if (!mounted) return;
      setState(
        () => status = switch (result.status) {
          ShareResultStatus.dismissed => context.tr(
            'Đã đóng bảng chia sẻ. Chưa xác nhận gửi.',
            'Share sheet closed. Sending is not confirmed.',
          ),
          ShareResultStatus.success => context.tr(
            'Kiểm tra nội dung trong ứng dụng bạn đã chọn để hoàn tất gửi.',
            'Check your chosen app to finish sending.',
          ),
          ShareResultStatus.unavailable => context.tr(
            'Hệ điều hành không cung cấp trạng thái gửi. Bạn có thể sao chép nội dung bên dưới.',
            'The system did not report a sending status. You can copy the text below.',
          ),
        },
      );
    } catch (_) {
      if (mounted) {
        setState(
          () => status = context.tr(
            'Chưa mở được bảng chia sẻ. Bạn có thể sao chép nội dung.',
            'Could not open sharing. You can copy the text instead.',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final valid = StudyShareDraft.valid(editor.text);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        22,
        20,
        22,
        20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              context.tr('Xem trước khi chia sẻ', 'Review before sharing'),
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              widget.draft.title,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 8),
            Text(
              context.tr(
                'Chia sẻ tiêu đề học liệu và đoạn bên dưới. Sửa hoặc bỏ chi tiết riêng tư trước khi chọn ứng dụng nhận.',
                'Share the material title and text below. Edit the text or remove private details before choosing a receiving app.',
              ),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: editor,
              enabled: !busy,
              minLines: 4,
              maxLines: 9,
              maxLength: StudyShareDraft.maxCharacters,
              decoration: InputDecoration(
                labelText: context.tr('Nội dung được chọn', 'Selected content'),
              ),
              onChanged: (_) => setState(() => status = null),
            ),
            if (editor.text.length > StudyShareDraft.maxCharacters)
              Text(
                context.tr(
                  'Hãy rút gọn xuống tối đa 24.000 ký tự. Không tự cắt nội dung.',
                  'Reduce the text to 24,000 characters. Nothing is truncated automatically.',
                ),
              ),
            if (status != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(status!, key: const ValueKey('share-status')),
              ),
            const SizedBox(height: 12),
            Builder(
              builder: (buttonContext) => FilledButton.icon(
                onPressed: valid && !busy ? () => share(buttonContext) : null,
                icon: const Icon(Icons.ios_share_rounded),
                label: Text(
                  context.tr(
                    busy ? 'Đang mở…' : 'Chọn ứng dụng nhận',
                    busy ? 'Opening…' : 'Choose receiving app',
                  ),
                ),
              ),
            ),
            TextButton.icon(
              onPressed: !busy && valid
                  ? () async {
                      try {
                        await Clipboard.setData(
                          ClipboardData(
                            text: widget.draft.message(editor.text),
                          ),
                        );
                        if (mounted) {
                          setState(
                            () => status = context.tr(
                              'Đã sao chép nội dung được chọn.',
                              'Selected content copied.',
                            ),
                          );
                        }
                      } catch (_) {
                        if (mounted) {
                          setState(
                            () => status = context.tr(
                              'Chưa sao chép được. Hãy chọn đoạn văn rồi sao chép thủ công.',
                              'Could not copy. Select the text and copy it manually.',
                            ),
                          );
                        }
                      }
                    }
                  : null,
              icon: const Icon(Icons.copy_outlined),
              label: Text(context.tr('Sao chép', 'Copy')),
            ),
          ],
        ),
      ),
    );
  }
}
