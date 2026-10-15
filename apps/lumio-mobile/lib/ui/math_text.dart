import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';

/// Readable learning content without HTML, a web view, or executable links.
/// Selection covers prose/code; rendered formulas expose a screen-reader label.
class LearningText extends StatelessWidget {
  const LearningText(
    this.text, {
    super.key,
    this.style,
    this.selectable = false,
    this.language = 'vi',
  });

  final String text;
  final TextStyle? style;
  final bool selectable;
  final String language;

  static const maxExpressionLength = 1500;
  static const maxRenderedExpressions = 80;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = (theme.textTheme.bodyMedium ?? const TextStyle(fontSize: 14))
        .copyWith(height: 1.6, color: theme.colorScheme.onSurface)
        .merge(style);
    final child = LayoutBuilder(
      builder: (context, constraints) {
        final renderer = _LearningRenderer(
          base: base,
          colors: theme.colorScheme,
          width: constraints.hasBoundedWidth
              ? constraints.maxWidth
              : MediaQuery.sizeOf(context).width,
          language: language,
        );
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: renderer.blocks(text),
        );
      },
    );
    return selectable ? SelectionArea(child: child) : child;
  }
}

class _LearningRenderer {
  _LearningRenderer({
    required this.base,
    required this.colors,
    required this.width,
    required this.language,
  });
  final TextStyle base;
  final ColorScheme colors;
  final double width;
  final String language;
  var renderedExpressions = 0;

  // Fenced code wins over formulas inside it. Display math can span many lines.
  static final blockPattern = RegExp(
    r'(^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*(?:\n|$))|(\\\[[\s\S]*?\\\])|(\$\$[\s\S]*?\$\$)',
    multiLine: true,
  );
  static final inlinePattern = RegExp(
    r'(`[^`\n]+`)|(\\\([^\n]*?\\\))|(\*\*[^*\n]+\*\*)',
  );

  List<Widget> blocks(String content) {
    final result = <Widget>[];
    var position = 0;
    for (final match in blockPattern.allMatches(content)) {
      if (match.start > position) {
        result.addAll(prose(content.substring(position, match.start)));
      }
      final token = match[0]!;
      if (match[1] != null) {
        final lines = token.trimRight().split('\n');
        final code = lines.sublist(1, lines.length - 1).join('\n');
        result.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colors.surfaceContainerHighest.withValues(alpha: .5),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(code, style: base.copyWith(fontFamily: 'monospace')),
            ),
          ),
        );
      } else {
        result.add(
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: formula(token.substring(2, token.length - 2), true, base),
            ),
          ),
        );
      }
      position = match.end;
    }
    if (position < content.length) {
      result.addAll(prose(content.substring(position)));
    }
    return result.isEmpty ? [Text('', style: base)] : result;
  }

  List<Widget> prose(String content) {
    final result = <Widget>[];
    for (final line in content.split('\n')) {
      if (line.trim().isEmpty) {
        if (result.isNotEmpty) result.add(const SizedBox(height: 7));
        continue;
      }
      final heading = RegExp(r'^\s*(#{1,4})\s+(.+)$').firstMatch(line);
      final bullet = RegExp(
        r'^\s*(?:([-*+])|(\d+[.)]))\s+(.+)$',
      ).firstMatch(line);
      if (heading != null) {
        final level = heading[1]!.length;
        final headingStyle = base.copyWith(
          fontSize: (base.fontSize ?? 14) + (5 - level) * 1.5,
          fontWeight: FontWeight.w700,
          height: 1.35,
        );
        result.add(
          Padding(
            padding: const EdgeInsets.only(top: 14, bottom: 8),
            child: Semantics(
              header: true,
              child: rich(heading[2]!, headingStyle),
            ),
          ),
        );
      } else if (bullet != null) {
        result.add(
          Padding(
            padding: const EdgeInsets.only(top: 3, bottom: 3),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(width: 28, child: Text(bullet[2] ?? '•', style: base)),
                Expanded(child: rich(bullet[3]!, base, maxWidth: width - 28)),
              ],
            ),
          ),
        );
      } else {
        result.add(rich(line, base));
      }
    }
    return result;
  }

  Widget rich(String line, TextStyle textStyle, {double? maxWidth}) {
    final spans = <InlineSpan>[];
    var position = 0;
    for (final match in inlinePattern.allMatches(line)) {
      if (match.start > position) {
        spans.add(TextSpan(text: line.substring(position, match.start)));
      }
      final token = match[0]!;
      if (match[1] != null) {
        spans.add(
          TextSpan(
            text: token.substring(1, token.length - 1),
            style: textStyle.copyWith(
              fontFamily: 'monospace',
              backgroundColor: colors.surfaceContainerHighest,
            ),
          ),
        );
      } else if (match[2] != null) {
        spans.add(
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: (maxWidth ?? width).clamp(1, double.infinity),
              ),
              child: FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: formula(
                  token.substring(2, token.length - 2),
                  false,
                  textStyle,
                ),
              ),
            ),
          ),
        );
      } else {
        spans.add(
          TextSpan(
            text: token.substring(2, token.length - 2),
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        );
      }
      position = match.end;
    }
    if (position < line.length) {
      spans.add(TextSpan(text: line.substring(position)));
    }
    return Text.rich(TextSpan(children: spans), style: textStyle);
  }

  Widget formula(String expression, bool display, TextStyle textStyle) {
    final source = expression.trim();
    Widget fallback() =>
        Text(source, style: textStyle.copyWith(fontFamily: 'monospace'));
    // Bound parser work and reject resource-heavy/custom TeX rather than execute it.
    if (source.isEmpty ||
        source.length > LearningText.maxExpressionLength ||
        renderedExpressions >= LearningText.maxRenderedExpressions ||
        !_safeFormula(source)) {
      return fallback();
    }
    renderedExpressions++;
    Widget math;
    try {
      math = Math.tex(
        source,
        mathStyle: display ? MathStyle.display : MathStyle.text,
        textStyle: textStyle.copyWith(height: 1),
        settings: const TexParserSettings(maxExpand: 100),
        onErrorFallback: (_) => fallback(),
      );
    } catch (_) {
      return fallback();
    }
    return Semantics(
      label: _mathLabel(source, language),
      child: ExcludeSemantics(child: math),
    );
  }
}

bool _safeFormula(String value) {
  if (RegExp(
    r'\\(?:def|gdef|edef|xdef|let|futurelet|newcommand|renewcommand|rule|kern|hskip|vskip|hspace|vspace|raisebox|html\w*|href|url|includegraphics)\b',
  ).hasMatch(value)) {
    return false;
  }
  var depth = 0;
  for (var i = 0; i < value.length; i++) {
    if (value[i] == '\\') {
      i++;
      continue;
    }
    if (value[i] == '{' && ++depth > 64) return false;
    if (value[i] == '}') depth--;
  }
  return true;
}

String _mathLabel(String expression, String language) {
  final vi = language == 'vi';
  var text = expression.replaceAllMapped(
    RegExp(r'\\frac\{([^{}]+)\}\{([^{}]+)\}'),
    (m) =>
        vi ? 'phân số ${m[1]} trên ${m[2]}' : 'fraction ${m[1]} over ${m[2]}',
  );
  text = text.replaceAllMapped(
    RegExp(r'\\sqrt\{([^{}]+)\}'),
    (m) => vi ? 'căn bậc hai của ${m[1]}' : 'square root of ${m[1]}',
  );
  for (final entry in {
    r'\times': vi ? ' nhân ' : ' times ',
    r'\cdot': vi ? ' nhân ' : ' times ',
    r'\pm': vi ? ' cộng hoặc trừ ' : ' plus or minus ',
    r'\leq': vi ? ' nhỏ hơn hoặc bằng ' : ' less than or equal to ',
    r'\geq': vi ? ' lớn hơn hoặc bằng ' : ' greater than or equal to ',
    r'\neq': vi ? ' khác ' : ' not equal to ',
    r'\pi': ' pi ',
    '=': vi ? ' bằng ' : ' equals ',
  }.entries) {
    text = text.replaceAll(entry.key, entry.value);
  }
  text = text.replaceAll(
    RegExp(r'\^(?:\{2\}|2)(?!\d)'),
    vi ? ' bình phương ' : ' squared ',
  );
  text = text.replaceAll(
    RegExp(r'\^(?:\{3\}|3)(?!\d)'),
    vi ? ' lập phương ' : ' cubed ',
  );
  text = text.replaceAll(RegExp(r'\s+'), ' ').trim();
  return '${vi ? 'Công thức' : 'Formula'}: $text';
}
