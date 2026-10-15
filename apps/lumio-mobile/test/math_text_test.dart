import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumio_mobile/ui/math_text.dart';

Future<void> render(
  WidgetTester tester,
  String text, {
  bool selectable = false,
}) async {
  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: SizedBox(
            width: 320,
            child: LearningText(text, selectable: selectable),
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  testWidgets(
    'Inline Vietnamese prose stays in one rich paragraph around math',
    (tester) async {
      await render(tester, r'Cho \(x=2\), ta có \(x^2=4\).');
      expect(find.byType(Math), findsNWidgets(2));
      final paragraphs = tester
          .widgetList<Text>(find.byType(Text))
          .where(
            (widget) =>
                widget.textSpan?.toPlainText().contains('Cho ') ?? false,
          );
      expect(paragraphs.length, 1);
      expect(paragraphs.single.textSpan!.toPlainText(), contains(', ta có '));
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Both display delimiters render native formulas with horizontal scrolling',
    (tester) async {
      await render(
        tester,
        r'\[\frac{1}{2}\]'
        '\n'
        r'$$x^2 + y^2 = z^2$$',
      );
      expect(find.byType(Math), findsNWidgets(2));
      expect(
        tester
            .widgetList<Math>(find.byType(Math))
            .every((math) => math.mathStyle == MathStyle.display),
        isTrue,
      );
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Headings, bullets and bold remain readable without Markdown markers',
    (tester) async {
      await render(
        tester,
        '# Tóm tắt\n- **Ý chính** là học đều\n2. Ôn tập mỗi ngày',
      );
      expect(find.text('•'), findsOneWidget);
      expect(find.text('2.'), findsOneWidget);
      final texts = tester
          .widgetList<Text>(find.byType(Text))
          .map((text) => text.data ?? text.textSpan?.toPlainText() ?? '')
          .join('\n');
      expect(texts, contains('Tóm tắt'));
      expect(texts, contains('Ý chính'));
      expect(texts, isNot(contains('**')));
      expect(texts, isNot(contains('# Tóm tắt')));
    },
  );
  testWidgets(
    'Fenced and inline code preserve literal formulas without parsing',
    (tester) async {
      await render(
        tester,
        '```dart\n'
        r'print("\(x\)");'
        '\n```\n'
        r'Dùng `\(x\)` trong ví dụ.',
      );
      expect(find.byType(Math), findsNothing);
      expect(find.text(r'print("\(x\)");'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Malformed formulas show source text instead of crashing or parser diagnostics',
    (tester) async {
      await render(tester, r'\(\frac{1\)');
      expect(find.text(r'\frac{1'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets(
    'Oversized and deeply nested expressions bypass the math parser',
    (tester) async {
      final long = 'x' * (LearningText.maxExpressionLength + 1);
      final nested = '${'{' * 70}x${'}' * 70}';
      await render(tester, '\\[$long\\]\n\\[$nested\\]');
      expect(find.byType(Math), findsNothing);
      expect(find.text(long), findsOneWidget);
      expect(find.text(nested), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
  testWidgets('Custom macros and HTML remain inert readable text', (
    tester,
  ) async {
    await render(
      tester,
      r'<script>alert(1)</script>'
      '\n'
      r'\(\def\x{\x}\x\)',
    );
    expect(find.byType(Math), findsNothing);
    expect(find.text(r'\def\x{\x}\x'), findsOneWidget);
    final texts = tester
        .widgetList<Text>(find.byType(Text))
        .map((text) => text.data ?? text.textSpan?.toPlainText() ?? '')
        .join();
    expect(texts, contains('<script>alert(1)</script>'));
    expect(tester.takeException(), isNull);
  });
  testWidgets('Common formulas have Vietnamese screen-reader labels', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    await render(tester, r'\(x^2=\frac{1}{2}\)');
    expect(
      find.bySemanticsLabel('Công thức: x bình phương bằng phân số 1 trên 2'),
      findsOneWidget,
    );
    semantics.dispose();
  });
  testWidgets(
    'Selectable prose supports narrow layouts without math overflow',
    (tester) async {
      await render(
        tester,
        r'Kết quả \(a+b+c+d+e+f+g+h+i+j+k+l+m+n+o+p=16\) cần kiểm tra.',
        selectable: true,
      );
      expect(find.byType(SelectionArea), findsOneWidget);
      expect(find.byType(Math), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
