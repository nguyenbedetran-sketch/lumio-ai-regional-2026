import 'dart:convert';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../core/models.dart';
import '../core/motion.dart';
import 'common.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});
  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  TextEditingController? server;
  final code = TextEditingController();
  bool busy = false;
  @override
  void dispose() {
    server?.dispose();
    code.dispose();
    super.dispose();
  }

  Future<void> pair() async {
    if (kIsWeb) {
      notice(
        context,
        context.tr(
          'Ghép thiết bị dùng trong bản Android/iOS.',
          'Device pairing is available in the Android/iOS app.',
        ),
      );
      return;
    }
    final store = context.store;
    setState(() => busy = true);
    try {
      await store.pair(server!.text.trim(), code.text.trim());
      if (mounted) code.clear();
    } catch (e) {
      if (mounted) notice(context, errorText(context, e));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> export() async {
    try {
      final bytes = Uint8List.fromList(
        utf8.encode(context.store.data.encode()),
      );
      await FilePicker.saveFile(
        dialogTitle: context.tr('Xuất thư viện', 'Export library'),
        fileName: 'lumio-mobile-${dayKey(DateTime.now())}.json',
        type: FileType.custom,
        allowedExtensions: ['json'],
        bytes: bytes,
      );
    } catch (e) {
      if (mounted) notice(context, errorText(context, e));
    }
  }

  Future<void> restore() async {
    final store = context.store;
    try {
      final result = await FilePicker.pickFile(
        type: FileType.custom,
        allowedExtensions: ['json'],
      );
      if (result == null || !mounted) return;
      final file = result;
      if ((await file.length() ?? 21000000) > 20 * 1024 * 1024) {
        throw const FormatException();
      }
      final bytes = await file.readAsBytes();
      final data = LibraryData.fromJson(object(jsonDecode(utf8.decode(bytes))));
      if (!mounted ||
          !await confirm(
            context,
            context.tr(
              'Bản sao sẽ thay thế thư viện hiện tại của tài khoản này. Tiếp tục?',
              'This backup replaces the current account’s library. Continue?',
            ),
          ) ||
          !mounted) {
        return;
      }
      await store.save(LibraryData(items: data.items, events: data.events));
      if (mounted) {
        notice(
          context,
          context.tr(
            'Đã nhập bản sao. Phiên tập trung cũ không được tự chạy lại.',
            'Backup imported. Previous focus timers are not resumed.',
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        notice(
          context,
          context.tr(
            'Không nhập được bản sao Lumio Mobile hợp lệ. Dữ liệu hiện tại được giữ nguyên.',
            'Could not import a valid Lumio Mobile backup. Current data is preserved.',
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = context.store;
    server ??= TextEditingController(text: store.server);
    return Scaffold(
      appBar: AppBar(title: Text(context.tr('Cài đặt', 'Settings'))),
      body: ScreenBody(
        children: [
          SectionTitle(context.tr('Theo cách của bạn', 'Make it yours')),
          Surface(
            child: Column(
              children: [
                DropdownButtonFormField<String>(
                  initialValue: store.language,
                  decoration: InputDecoration(
                    labelText: context.tr('Ngôn ngữ', 'Language'),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'vi', child: Text('Tiếng Việt')),
                    DropdownMenuItem(value: 'en', child: Text('English')),
                  ],
                  onChanged: (value) =>
                      runAction(context, () => store.settings(locale: value)),
                ),
                const SizedBox(height: 20),
                DropdownButtonFormField<ThemeMode>(
                  initialValue: store.themeMode,
                  decoration: InputDecoration(
                    labelText: context.tr('Giao diện', 'Appearance'),
                  ),
                  items: [
                    DropdownMenuItem(
                      value: ThemeMode.system,
                      child: Text(context.tr('Theo thiết bị', 'System')),
                    ),
                    DropdownMenuItem(
                      value: ThemeMode.light,
                      child: Text(context.tr('Sáng', 'Light')),
                    ),
                    DropdownMenuItem(
                      value: ThemeMode.dark,
                      child: Text(context.tr('Tối', 'Dark')),
                    ),
                  ],
                  onChanged: (value) =>
                      runAction(context, () => store.settings(theme: value)),
                ),
                const SizedBox(height: 20),
                DropdownButtonFormField<MotionPreference>(
                  key: const ValueKey('motion-preference'),
                  initialValue: store.motionPreference,
                  decoration: InputDecoration(
                    labelText: context.tr('Chuyển động', 'Motion'),
                  ),
                  items: [
                    DropdownMenuItem(
                      value: MotionPreference.auto,
                      child: Text(context.tr('Tự động', 'Automatic')),
                    ),
                    DropdownMenuItem(
                      value: MotionPreference.subtle,
                      child: Text(context.tr('Nhẹ nhàng', 'Subtle')),
                    ),
                    DropdownMenuItem(
                      value: MotionPreference.full,
                      child: Text(context.tr('Đầy đủ', 'Full')),
                    ),
                  ],
                  onChanged: (value) =>
                      runAction(context, () => store.settings(motion: value)),
                ),
                const SizedBox(height: 10),
                Text(
                  context.tr(
                    'Nhẹ nhàng dùng chuyển cảnh mờ. Cài đặt giảm chuyển động hoặc hỗ trợ điều hướng của thiết bị luôn được ưu tiên.',
                    'Subtle uses short fades. Device reduced motion and accessible navigation always take priority.',
                  ),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          SectionTitle(
            context.tr('Kết nối tài khoản', 'Account connection'),
            subtitle: context.tr(
              'Thư viện vẫn lưu trên thiết bị; đăng nhập chưa đồng bộ với web.',
              'Library stays on this device; signing in does not sync it with the web.',
            ),
          ),
          if (store.session != null)
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const CircleAvatar(
                      child: Icon(Icons.person_outline),
                    ),
                    title: Text(store.session!.name),
                    subtitle: Text(
                      store.authenticated
                          ? context.tr('Thiết bị đã ghép', 'Device paired')
                          : context.tr(
                              'Phiên đã hết hạn; ghép lại để dùng AI.',
                              'Session expired; pair again to use AI.',
                            ),
                    ),
                  ),
                  Text(
                    store.session!.origin,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    children: [
                      Chip(
                        avatar: Icon(
                          store.canAI
                              ? Icons.check_circle_outline
                              : Icons.info_outline,
                          size: 17,
                        ),
                        label: Text(
                          store.canAI
                              ? context.tr('AI sẵn sàng', 'AI ready')
                              : context.tr(
                                  'AI chưa sẵn sàng',
                                  'AI unavailable',
                                ),
                        ),
                      ),
                      Chip(
                        avatar: Icon(
                          store.canVoice
                              ? Icons.check_circle_outline
                              : Icons.info_outline,
                          size: 17,
                        ),
                        label: Text(
                          store.canVoice
                              ? context.tr('Giọng nói sẵn sàng', 'Voice ready')
                              : context.tr(
                                  'Giọng nói chưa sẵn sàng',
                                  'Voice unavailable',
                                ),
                        ),
                      ),
                    ],
                  ),
                  TextButton.icon(
                    onPressed: () => store.refreshAccount(),
                    icon: const Icon(Icons.refresh),
                    label: Text(
                      context.tr('Kiểm tra kết nối', 'Check connection'),
                    ),
                  ),
                  OutlinedButton(
                    onPressed: busy
                        ? null
                        : () async {
                            if (await confirm(
                                  context,
                                  context.tr(
                                    'Thu hồi kết nối thiết bị? Học liệu tài khoản vẫn được giữ trên máy.',
                                    'Revoke this device connection? Account materials stay on this device.',
                                  ),
                                ) &&
                                context.mounted) {
                              await runAction(context, store.disconnect);
                            }
                          },
                    child: Text(
                      context.tr(
                        'Thu hồi và ngắt kết nối',
                        'Revoke and disconnect',
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: busy
                        ? null
                        : () async {
                            if (await confirm(
                                  context,
                                  context.tr(
                                    'Xóa khóa trên máy khi ngoại tuyến? Kết nối trên máy chủ vẫn còn hiệu lực đến khi bạn thu hồi từ web.',
                                    'Remove the local token while offline? The server token remains valid until revoked on the web.',
                                  ),
                                ) &&
                                context.mounted) {
                              await runAction(
                                context,
                                () => store.disconnect(revoke: false),
                              );
                            }
                          },
                    child: Text(
                      context.tr(
                        'Gỡ kết nối ngoại tuyến',
                        'Disconnect locally',
                      ),
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
                Text(
                  context.tr(
                    '1. Mở trang /mobile trên máy chủ Lumio và đăng nhập.\n2. Tạo mã ghép dùng một lần.\n3. Dán mã bên dưới; không nhập API key.',
                    '1. Open /mobile on your Lumio server and sign in.\n2. Create a one-time pairing code.\n3. Paste it below; do not enter API keys.',
                  ),
                  style: const TextStyle(height: 1.6),
                ),
                const SizedBox(height: 18),
                TextField(
                  controller: server,
                  keyboardType: TextInputType.url,
                  autocorrect: false,
                  enableSuggestions: false,
                  decoration: InputDecoration(
                    labelText: context.tr(
                      'Máy chủ Lumio (HTTPS)',
                      'Lumio server (HTTPS)',
                    ),
                    hintText: 'https://your-lumio.example',
                  ),
                  readOnly: store.session != null,
                ),
                TextButton.icon(
                  onPressed: () {
                    Clipboard.setData(
                      ClipboardData(
                        text:
                            '${server!.text.replaceAll(RegExp(r'/$'), '')}/mobile',
                      ),
                    );
                    notice(
                      context,
                      context.tr(
                        'Đã sao chép liên kết ghép thiết bị.',
                        'Pairing page link copied.',
                      ),
                    );
                  },
                  icon: const Icon(Icons.link),
                  label: Text(
                    context.tr(
                      'Sao chép trang ghép thiết bị',
                      'Copy pairing page link',
                    ),
                  ),
                ),
                TextField(
                  controller: code,
                  obscureText: true,
                  autocorrect: false,
                  enableSuggestions: false,
                  maxLength: 256,
                  decoration: InputDecoration(
                    labelText: context.tr(
                      'Mã ghép dùng một lần',
                      'One-time pairing code',
                    ),
                  ),
                ),
                FilledButton.icon(
                  onPressed: busy ? null : pair,
                  icon: const Icon(Icons.phonelink_lock),
                  label: Text(
                    context.tr(
                      busy ? 'Đang kết nối…' : 'Ghép thiết bị',
                      busy ? 'Connecting…' : 'Pair device',
                    ),
                  ),
                ),
                if (kDebugMode)
                  Padding(
                    padding: const EdgeInsets.only(top: 14),
                    child: Text(
                      context.tr(
                        'Để thử qua USB hoặc giả lập, chạy adb reverse tcp:3000 tcp:3000 trên máy tính, rồi dùng http://127.0.0.1:3000. Bản phát hành yêu cầu HTTPS.',
                        'For USB or an emulator, run adb reverse tcp:3000 tcp:3000 on your computer, then use http://127.0.0.1:3000. Release builds require HTTPS.',
                      ),
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
              ],
            ),
          ),
          SectionTitle(context.tr('Dữ liệu của bạn', 'Your data')),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  context.tr(
                    'Bản sao có học liệu, ghi chú, tóm tắt, thẻ và lịch sử học. Không có khóa đăng nhập hay bản ghi âm. Định dạng riêng của Lumio Mobile.',
                    'Backups include materials, notes, summaries, cards and study history. They contain no login token or recordings. Lumio Mobile uses its own backup format.',
                  ),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: export,
                  icon: const Icon(Icons.download_outlined),
                  label: Text(
                    context.tr('Xuất bản sao JSON', 'Export JSON backup'),
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: restore,
                  icon: const Icon(Icons.upload_outlined),
                  label: Text(context.tr('Nhập bản sao', 'Import backup')),
                ),
                TextButton(
                  onPressed: () async {
                    if (await confirm(
                          context,
                          context.tr(
                            'Xóa toàn bộ thư viện của tài khoản đang dùng trên thiết bị này? Hãy xuất bản sao trước.',
                            'Delete this account’s entire library on this device? Export a backup first.',
                          ),
                        ) &&
                        context.mounted) {
                      await runAction(
                        context,
                        () => store.save(const LibraryData()),
                      );
                    }
                  },
                  child: Text(
                    context.tr('Xóa thư viện trên máy', 'Delete local library'),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          TextButton(
            onPressed: () => showLicensePage(
              context: context,
              applicationName: 'Lumio AI',
              applicationVersion: '0.3.0',
            ),
            child: Text(
              context.tr('Thư viện mã nguồn mở', 'Open-source licenses'),
            ),
          ),
          Text(
            context.tr(
              'Lumio Mobile 0.3 · Bản thử nghiệm\nAI có thể sai. Chỉ gửi học liệu bạn có quyền sử dụng.',
              'Lumio Mobile 0.3 · Preview build\nAI can be wrong. Only submit materials you have the right to use.',
            ),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
