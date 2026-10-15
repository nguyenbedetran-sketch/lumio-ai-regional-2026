import 'package:flutter/material.dart';
import '../core/app_store.dart';
import '../core/api.dart';
import 'study_motion.dart';

const ink = Color(0xff123b31),
    mint = Color(0xffc7f2ae),
    paper = Color(0xfff7f5ee),
    violet = Color(0xff7358df);

class StoreScope extends InheritedNotifier<AppStore> {
  const StoreScope({super.key, required AppStore store, required super.child})
    : super(notifier: store);
  static AppStore of(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<StoreScope>()!.notifier!;
}

extension LumioContext on BuildContext {
  AppStore get store => StoreScope.of(this);
  String tr(String vi, String en) => store.t(vi, en);
  bool get reducedMotion => motionDuration(this) == Duration.zero;
}

void notice(BuildContext context, String text) {
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }
}

String errorText(BuildContext context, Object error) {
  final code = error is ApiFailure ? error.code : '';
  return switch (code) {
    'TUTOR_LOCKED' => context.tr(
      'Lời giải chưa mở. Tiếp tục thử với các gợi ý; máy chủ sẽ xác nhận khi đủ điều kiện.',
      'The solution is locked. Try the hints; the server confirms when review is available.',
    ),
    'TUTOR_SESSION_NOT_FOUND' || 'TUTOR_CONTEXT_CHANGED' => context.tr(
      'Phiên học đã hết hạn hoặc học liệu đã đổi. Câu hỏi tiếp theo sẽ bắt đầu một bài mới.',
      'The session expired or the material changed. Your next question starts a new exercise.',
    ),
    'TUTOR_BUSY' => context.tr(
      'Một lượt gia sư đang xử lý. Chờ xong rồi thử lại.',
      'A tutor turn is still processing. Wait, then retry.',
    ),
    'TUTOR_REPEATED_HINT' ||
    'TUTOR_SOLUTION_LEAK' ||
    'INVALID_TUTOR_OUTPUT' ||
    'MATH_VERIFICATION_FAILED' => context.tr(
      'Phản hồi chưa qua kiểm tra nên chưa tính lượt. Bạn có thể thử lại.',
      'The response did not pass checks and did not count as a hint. You can retry.',
    ),
    'HTTPS_REQUIRED' || 'INVALID_SERVER' => context.tr(
      'Dùng địa chỉ máy chủ HTTPS hợp lệ.',
      'Use a valid HTTPS server address.',
    ),
    'UNAUTHORIZED' ||
    'SESSION_EXPIRED' ||
    'SESSION_REVOKED' ||
    'SIGN_IN_REQUIRED' ||
    'REAUTH_REQUIRED' ||
    'HTTP_401' => context.tr(
      'Kết nối đã hết hạn. Hãy ghép thiết bị lại.',
      'Connection expired. Pair your device again.',
    ),
    'INSUFFICIENT_CREDITS' ||
    'CREDITS_EXHAUSTED' ||
    'CREDITS_INSUFFICIENT' => context.tr(
      'Tài khoản chưa đủ credit cho tác vụ này.',
      'Your account has insufficient credits for this task.',
    ),
    'PAIR_CODE_INVALID' => context.tr(
      'Mã ghép không hợp lệ hoặc đã hết hạn. Tạo mã mới trên web.',
      'Pairing code is invalid or expired. Create a new code on the web.',
    ),
    'DEVICE_LIMIT' => context.tr(
      'Đã đạt giới hạn thiết bị. Thu hồi một thiết bị từ trang /mobile.',
      'Device limit reached. Revoke a device on /mobile.',
    ),
    'PLAN_ACCESS_REQUIRED' => context.tr(
      'Gói hiện tại chưa hỗ trợ tác vụ này.',
      'Your current plan does not support this task.',
    ),
    'PUBLIC_DEMO_ONLY' => context.tr(
      'Máy chủ demo chỉ cho trải nghiệm giao diện. Dùng máy chủ Lumio có tài khoản và AI để ghép thiết bị.',
      'The demo server is for UI exploration. Pair with a Lumio server that has accounts and AI enabled.',
    ),
    'TIMEOUT' || 'NETWORK_ERROR' => context.tr(
      'Chưa kết nối được. Kiểm tra mạng và máy chủ rồi thử lại.',
      'Could not connect. Check your network and server, then retry.',
    ),
    'SPEECH_TOO_LONG' => context.tr(
      'Đoạn đọc cần từ 1 đến 3.000 ký tự.',
      'Speech requires 1–3,000 characters.',
    ),
    'AUDIO_TOO_LARGE' => context.tr(
      'Bản ghi vượt quá 8 MB.',
      'Recording exceeds 8 MB.',
    ),
    _ => context.tr(
      'Chưa thực hiện được. Thử lại; dữ liệu hiện tại được giữ nguyên.',
      'Could not complete this action. Retry; your current data is preserved.',
    ),
  };
}

Future<void> runAction(
  BuildContext context,
  Future<void> Function() action,
) async {
  try {
    await action();
  } catch (error) {
    if (context.mounted) notice(context, errorText(context, error));
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.subtitle, this.trailing});
  final String title;
  final String? subtitle;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 14),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: Theme.of(
                  context,
                ).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              if (subtitle != null)
                Padding(
                  padding: const EdgeInsets.only(top: 5),
                  child: Text(
                    subtitle!,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ),
            ],
          ),
        ),
        ?trailing,
      ],
    ),
  );
}

class Surface extends StatelessWidget {
  const Surface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.color,
  });
  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color? color;
  @override
  Widget build(BuildContext context) => Material(
    clipBehavior: Clip.antiAlias,
    color: color ?? Theme.of(context).colorScheme.surfaceContainerLow,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(28),
      side: BorderSide(
        color: Theme.of(
          context,
        ).colorScheme.outlineVariant.withValues(alpha: .45),
      ),
    ),
    child: Padding(padding: padding, child: child),
  );
}

class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
    this.action,
  });
  final IconData icon;
  final String title, message;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Surface(
    child: Column(
      children: [
        const SizedBox(height: 16),
        Icon(icon, size: 52, color: Theme.of(context).colorScheme.primary),
        const SizedBox(height: 20),
        Text(
          title,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 10),
        Text(message, textAlign: TextAlign.center),
        if (action != null)
          Padding(padding: const EdgeInsets.only(top: 20), child: action),
        const SizedBox(height: 16),
      ],
    ),
  );
}

class ScreenBody extends StatelessWidget {
  const ScreenBody({super.key, required this.children, this.storageKey});
  final List<Widget> children;
  final String? storageKey;
  @override
  Widget build(BuildContext context) => ListView(
    key: storageKey == null ? null : PageStorageKey(storageKey),
    padding: const EdgeInsets.fromLTRB(22, 10, 22, 100),
    children: [
      Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 920),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: children,
          ),
        ),
      ),
    ],
  );
}

class Metric extends StatelessWidget {
  const Metric(this.value, this.label, this.icon, {super.key});
  final String value, label;
  final IconData icon;
  @override
  Widget build(BuildContext context) => Expanded(
    child: Surface(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 14),
          Text(
            value,
            style: Theme.of(
              context,
            ).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 4),
          Text(label, style: Theme.of(context).textTheme.labelMedium),
        ],
      ),
    ),
  );
}

class Appear extends StatelessWidget {
  const Appear({super.key, required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => StudyMotion(child: child);
}

Future<bool> confirm(BuildContext context, String message) async =>
    await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(context.tr('Xác nhận', 'Confirm')),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(context.tr('Hủy', 'Cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(context.tr('Tiếp tục', 'Continue')),
          ),
        ],
      ),
    ) ??
    false;
