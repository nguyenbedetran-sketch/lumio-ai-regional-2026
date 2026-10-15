import 'package:flutter/material.dart';
import '../core/tutor_session.dart';
import 'common.dart';

class TutorProgress extends StatelessWidget {
  const TutorProgress({super.key, required this.snapshot});
  final TutorSnapshot? snapshot;
  @override
  Widget build(BuildContext context) {
    final state = snapshot;
    return Surface(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            state?.needsClarification == true
                ? Icons.help_outline
                : state?.canUnlock == true
                ? Icons.lock_open
                : Icons.school_outlined,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              state == null
                  ? context.tr(
                      'Gợi ý từng bước. Máy chủ xác nhận tiến trình và quyền mở lời giải.',
                      'Step-by-step hints. The server confirms progress and solution access.',
                    )
                  : state.needsClarification
                  ? context.tr(
                      'Cần bổ sung dữ kiện. Lượt hỏi lại không tính vào số gợi ý mở lời giải.',
                      'More information is needed. Clarification does not count toward unlocking.',
                    )
                  : '${state.hintCount}/${state.requiredHints} ${context.tr('gợi ý được máy chủ ghi nhận', 'hints recorded by the server')} · ${state.canUnlock ? context.tr('Có thể đối chiếu lời giải', 'Solution review available') : context.tr('Tiếp tục thử và nhận gợi ý', 'Keep trying with a hint')}',
            ),
          ),
        ],
      ),
    );
  }
}
