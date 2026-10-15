import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../core/app_store.dart';
import '../core/web_sync.dart';
import '../core/web_sync_controller.dart';
import '../core/web_sync_repository.dart';

/// Deliberately separate from native library: web metadata is not silently converted.
class WebSyncCard extends StatefulWidget {
  const WebSyncCard({super.key, required this.store});
  final AppStore store;
  @override
  State<WebSyncCard> createState() => _WebSyncCardState();
}

class _WebSyncCardState extends State<WebSyncCard> {
  WebSyncController? controller;
  String? _boundToken, _boundScope;
  bool _bindingFailed = false;
  String tr(String vi, String en) => widget.store.t(vi, en);
  @override
  void initState() {
    super.initState();
    _bind();
  }

  @override
  void didUpdateWidget(covariant WebSyncCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    _bind();
  }

  void _bind() {
    final store = widget.store, session = store.session;
    final usable =
        !kIsWeb &&
        store.ready &&
        store.authenticated &&
        !store.switchingAccount;
    if (usable && _boundToken == session?.token && _boundScope == store.scope) {
      return;
    }
    controller?.dispose();
    controller = null;
    _boundToken = null;
    _boundScope = null;
    _bindingFailed = false;
    if (!usable || session == null) return;
    final token = session.token, scope = store.scope;
    _boundToken = token;
    _boundScope = scope;
    try {
      final api = store.api;
      controller = WebSyncController(
        scope: scope,
        transport: api.webSync(session.id),
        storage: FileWebSyncStorage(store.repository.directory),
        isCurrent: () =>
            mounted &&
            !widget.store.switchingAccount &&
            widget.store.authenticated &&
            widget.store.scope == scope &&
            widget.store.session?.token == token,
      );
      controller!.initialize();
    } catch (_) {
      _bindingFailed = true;
      _boundToken = null;
      _boundScope = null;
    }
  }

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  String _error(String code) => switch (code) {
    'SESSION_REVOKED' || 'ACCOUNT_CHANGED' || 'SIGN_IN_REQUIRED' => tr(
      'Phiên hoặc tài khoản đã thay đổi. Ghép lại đúng tài khoản rồi thử tiếp.',
      'Your account or session changed. Pair the intended account again.',
    ),
    'SYNC_CONFLICT' || 'IDEMPOTENCY_CONFLICT' => tr(
      'Bản máy chủ đã đổi. Đối chiếu lại và lưu bản sao trước khi chọn.',
      'The server copy changed. Compare again and back up before choosing.',
    ),
    'SYNC_TOO_LARGE' => tr(
      'Bản này quá lớn. Giữ bản sao và chọn bản web nhỏ hơn (tối đa 2 MiB).',
      'Snapshot too large. Keep a backup and choose a smaller web snapshot (max 2 MiB).',
    ),
    'INVALID_SYNC_DATA' || 'INVALID_SYNC_CURSOR' || 'INVALID_RESPONSE' => tr(
      'Chưa đọc được bản web an toàn. Tệp gốc vẫn được giữ; kiểm tra đúng định dạng trước khi thử lại.',
      'The web snapshot could not be read safely. Original files remain; check the format before retrying.',
    ),
    'SYNC_STORAGE_ERROR' => tr(
      'Chưa đọc/ghi được bộ nhớ. Giữ tệp gốc, kiểm tra dung lượng và thử mở lại.',
      'Storage is unavailable. Keep original files, check free space and reopen.',
    ),
    'SYNC_REMOTE_EMPTY' => tr(
      'Máy chủ chưa có bản web. Bản trên thiết bị vẫn giữ, chưa gửi lại sau khi máy chủ đặt lại.',
      'There is no server snapshot. Your device copy remains; it was not re-uploaded after a reset.',
    ),
    _ => tr(
      'Chưa kết nối được. Bản nháp/hàng đợi vẫn ở thiết bị; kiểm tra mạng rồi thử lại.',
      'Unable to connect. Your draft/queue remains on this device; check your connection and retry.',
    ),
  };
  Future<void> _export(WebSyncController c) async {
    final data = c.value.current;
    if (data == null) return;
    try {
      await FilePicker.saveFile(
        dialogTitle: tr('Lưu bản đồng bộ web', 'Save web snapshot'),
        fileName: 'lumio-web-snapshot.json',
        type: FileType.custom,
        allowedExtensions: ['json'],
        bytes: Uint8List.fromList(utf8.encode(data.encode())),
      );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              tr(
                'Chưa xuất được tệp. Nội dung trên thiết bị vẫn giữ.',
                'Export failed. Your device copy is retained.',
              ),
            ),
          ),
        );
      }
    }
  }

  Future<void> _import(WebSyncController c) async {
    try {
      final picked = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: ['json'],
      );
      if (picked == null || !c.active) return;
      if ((await picked.length() ?? maxWebSyncBytes + 1) > maxWebSyncBytes) {
        throw const WebSyncFailure('SYNC_TOO_LARGE');
      }
      final bytes = await picked.readAsBytes();
      final parsed = WebSyncEnvelope.fromJson(jsonDecode(utf8.decode(bytes)));
      if (!mounted || !c.active) return;
      final yes = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text(
            tr('Nhập bản web riêng?', 'Import a separate web snapshot?'),
          ),
          content: Text(
            tr(
              'Thay bản web cục bộ đang xem, không thay thư viện native. Xuất bản sao trước nếu cần. Chưa gửi tới máy chủ cho đến khi bạn đồng bộ.',
              'Replace only this local web snapshot, not the native library. Export a backup first if needed. Nothing uploads until you sync.',
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(tr('Hủy', 'Cancel')),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text(tr('Nhập bản web', 'Import web snapshot')),
            ),
          ],
        ),
      );
      if (yes == true && c.active) await c.importSnapshot(parsed.encode());
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _error(e is WebSyncFailure ? e.code : 'INVALID_SYNC_DATA'),
            ),
          ),
        );
      }
    }
  }

  Future<void> _edit(WebSyncController c, Map<String, dynamic> item) async {
    final notes = await showDialog<String>(
      context: context,
      builder: (context) =>
          _WebNotesDialog(store: widget.store, notes: item['notes'] as String),
    );
    if (notes != null && c.active) await c.editNotes(item['id'], notes);
  }

  Future<void> _delete(WebSyncController c) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(tr('Xóa bản máy chủ?', 'Delete server snapshot?')),
        content: Text(
          tr(
            'Giữ bản web cục bộ và thư viện native. Hàng đợi gửi cũ sẽ dừng; thiết bị khác phải đối chiếu lại.',
            'Keeps the local web snapshot and native library. The old send queue stops; other devices must compare again.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(tr('Hủy', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(tr('Xóa bản máy chủ', 'Delete server snapshot')),
          ),
        ],
      ),
    );
    if (yes == true && c.active) await c.deleteServer();
  }

  @override
  Widget build(BuildContext context) {
    final c = controller;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.cloud_outlined),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    tr('Bản đồng bộ Web', 'Web snapshot workspace'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              tr(
                'Phạm vi thử nghiệm: nhận và sửa ghi chú của bản web. Thư viện native trong app vẫn riêng; chưa đồng bộ toàn bộ tính năng học native.',
                'Limited preview: receive a web snapshot and edit its notes. The app’s native library stays separate; full native learning sync is not implemented.',
              ),
            ),
            const SizedBox(height: 8),
            Text(
              tr(
                'Bản máy chủ tối đa 7 ngày, có thể mất sớm khi free host đặt lại. Không có tệp PDF/ảnh/audio/video gốc hoặc bộ đếm tập trung đang chạy.',
                'Server copies expire within 7 days and may reset earlier on free hosting. Original PDFs/images/audio/video and live focus timers are not included.',
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (c == null)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: Text(
                  tr(
                    _bindingFailed
                        ? 'Chưa mở được bản web riêng. Kiểm tra máy chủ và ghép lại tài khoản; dữ liệu cũ vẫn giữ.'
                        : kIsWeb
                        ? 'Bản trình duyệt này không dùng kho native. Mở web Lumio để đồng bộ.'
                        : 'Ghép tài khoản ở trên để dùng bản web riêng.',
                    _bindingFailed
                        ? 'The separate web snapshot is unavailable. Check the server and pair again; existing data is retained.'
                        : kIsWeb
                        ? 'This browser preview has no native storage. Use the Lumio website to sync.'
                        : 'Pair your account above to use a separate web snapshot.',
                  ),
                ),
              )
            else
              AnimatedBuilder(
                animation: c,
                builder: (context, _) => Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      value: c.value.enabled,
                      onChanged: !c.ready || c.busy
                          ? null
                          : (v) => c.enable(v ?? false),
                      title: Text(
                        tr(
                          'Tôi muốn gửi bản web này lên máy chủ Lumio',
                          'I want to send this web snapshot to the Lumio server',
                        ),
                      ),
                    ),
                    Text(
                      c.status == 'busy'
                          ? tr('Đang đối chiếu…', 'Comparing changes…')
                          : c.status == 'done'
                          ? tr('Đã đồng bộ bản web', 'Web snapshot synced')
                          : c.status == 'conflict'
                          ? tr(
                              'Có thay đổi khác nhau cần chọn',
                              'Conflicting changes need a choice',
                            )
                          : c.status == 'empty'
                          ? tr(
                              'Máy chủ chưa có bản web',
                              'No web snapshot on the server',
                            )
                          : c.value.pending != null
                          ? tr(
                              'Có bản đang chờ gửi hoặc xác nhận; giữ nguyên để thử lại an toàn',
                              'A send or acknowledgement is pending; retained for safe retry',
                            )
                          : c.status == 'draft'
                          ? tr(
                              'Đã lưu nháp trên thiết bị, chưa gửi',
                              'Draft saved on this device, not sent',
                            )
                          : tr('Chưa gửi dữ liệu mới', 'No new data sent'),
                      key: const ValueKey('web-sync-status'),
                    ),
                    if (c.error.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        child: Text(
                          _error(c.error),
                          key: const ValueKey('web-sync-error'),
                          style: TextStyle(
                            color: Theme.of(context).colorScheme.error,
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        FilledButton.icon(
                          onPressed: !c.value.enabled || c.busy || !c.ready
                              ? null
                              : () => c.sync(),
                          icon: const Icon(Icons.sync),
                          label: Text(
                            tr(
                              'Nhận / đồng bộ bản web',
                              'Receive / sync web snapshot',
                            ),
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: c.busy ? null : () => _import(c),
                          icon: const Icon(Icons.upload_file_outlined),
                          label: Text(tr('Nhập JSON web', 'Import web JSON')),
                        ),
                        OutlinedButton.icon(
                          onPressed: c.busy || c.value.current == null
                              ? null
                              : () => _export(c),
                          icon: const Icon(Icons.download_outlined),
                          label: Text(tr('Xuất bản sao', 'Export backup')),
                        ),
                      ],
                    ),
                    if (c.status == 'conflict')
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              c.firstConflict
                                  ? tr(
                                      'Lần kết nối đầu hoặc máy chủ đã đặt lại. Xuất bản sao trước khi chọn bản cần giữ.',
                                      'First connection or server reset. Export a backup before choosing what to keep.',
                                    )
                                  : tr(
                                      'Các mục sau thay đổi ở cả hai nơi. Xuất bản sao trước khi chọn.',
                                      'These records changed on both sides. Export a backup before choosing.',
                                    ),
                            ),
                            for (final label in c.conflicts.take(8))
                              Text('• $label'),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                OutlinedButton(
                                  onPressed: c.busy
                                      ? null
                                      : () =>
                                            c.sync(choice: WebSyncChoice.local),
                                  child: Text(
                                    tr(
                                      'Ưu tiên bản web trên thiết bị',
                                      'Prefer this device’s web changes',
                                    ),
                                  ),
                                ),
                                OutlinedButton(
                                  onPressed: c.busy
                                      ? null
                                      : () => c.sync(
                                          choice: WebSyncChoice.remote,
                                        ),
                                  child: Text(
                                    tr(
                                      'Ưu tiên bản máy chủ',
                                      'Prefer server changes',
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    if (c.value.current != null) ...[
                      const Divider(height: 28),
                      Text(
                        '${c.value.current!.items.length} ${tr('học liệu trong bản web riêng', 'items in this separate web snapshot')}',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      for (final item in c.value.current!.items.take(20))
                        ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(item['title']),
                          subtitle: Text(
                            '${(item['questions'] as List).length} quiz · ${(item['cards'] as List).length} cards · ${(item['attempts'] as List).length} ${tr('lần làm; metadata được giữ', 'attempts; metadata retained')}',
                          ),
                          trailing: IconButton(
                            tooltip: tr(
                              'Sửa ghi chú bản web',
                              'Edit web snapshot notes',
                            ),
                            onPressed: c.busy ? null : () => _edit(c, item),
                            icon: const Icon(Icons.edit_note),
                          ),
                        ),
                      if (c.value.current!.items.length > 20)
                        Text(
                          tr(
                            'Hiển thị 20 mục đầu. Xuất JSON để xem đầy đủ.',
                            'Showing the first 20 items. Export JSON for the full snapshot.',
                          ),
                        ),
                    ],
                    const SizedBox(height: 12),
                    TextButton.icon(
                      onPressed: c.busy || !c.ready ? null : () => _delete(c),
                      icon: const Icon(Icons.cloud_off_outlined),
                      label: Text(
                        tr('Xóa bản máy chủ', 'Delete server snapshot'),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _WebNotesDialog extends StatefulWidget {
  const _WebNotesDialog({required this.store, required this.notes});
  final AppStore store;
  final String notes;
  @override
  State<_WebNotesDialog> createState() => _WebNotesDialogState();
}

class _WebNotesDialogState extends State<_WebNotesDialog> {
  late final text = TextEditingController(text: widget.notes);
  @override
  void dispose() {
    text.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: Text(widget.store.t('Ghi chú bản web', 'Web snapshot notes')),
    content: SizedBox(
      width: 600,
      child: TextField(
        controller: text,
        minLines: 5,
        maxLines: 12,
        maxLength: 200000,
        decoration: InputDecoration(
          labelText: widget.store.t(
            'Chỉ sửa ghi chú; metadata được giữ',
            'Only notes change; metadata is retained',
          ),
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(widget.store.t('Hủy', 'Cancel')),
      ),
      FilledButton(
        onPressed: () => Navigator.pop(context, text.text),
        child: Text(widget.store.t('Lưu trên thiết bị', 'Save on this device')),
      ),
    ],
  );
}
