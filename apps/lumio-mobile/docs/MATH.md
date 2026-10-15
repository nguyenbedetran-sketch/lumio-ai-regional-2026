# Native learning text

`LearningText(text, style: ..., selectable: true, language: 'vi')` renders learning answers with native Flutter widgets. It does not use HTML, JavaScript, a WebView, remote fonts, or executable links.

Supported presentation:

- Headings `#` through `####`, ordinary numbered and bulleted lists, bold text, inline code and fenced code blocks.
- Inline LaTeX `\(...\)` remains with its surrounding sentence. Display LaTeX `\[...\]` and `$$...$$` has horizontal scrolling for wide formulas.
- Vietnamese or English screen-reader labels for common fractions, roots, powers and operators. Unrecognized notation is preserved in the accessible label; this is not a complete mathematical speech engine.
- Plain-text fallback for malformed, unsupported or oversized formulas. Prose and code can be selected; rendered equations expose semantic labels but are not selectable as rich math.

Each formula is limited to 1,500 characters, 64 levels of braces, and 100 macro expansions. At most 80 formulas are rendered per widget; further formulas remain text. Custom macros, HTML/link commands and resource-heavy layout commands remain plain text. These bounds protect rendering; they do not verify the mathematical correctness of an answer.

This is a deliberately small Markdown subset. Tables, embedded images, interactive links, nested list structure, full LaTeX documents and arbitrary custom TeX commands are unsupported. Literal HTML appears as text. Code blocks preserve their contents without parsing math inside them.

Dependency verified on 2026-09-27: [`flutter_math_fork` 0.7.4](https://pub.dev/packages/flutter_math_fork/versions/0.7.4), published by simpleclub, with upstream at [simpleclub/flutter_math](https://github.com/simpleclub/flutter_math). The package is an actively used compatibility fork of Flutter Math; its 0.7.4 changelog specifically adds Flutter 3.32 compatibility. It uses the [Apache License 2.0](https://pub.dev/packages/flutter_math_fork/license). The application uses the package without modifying its source; retain its package license notices when distributing builds/source dependencies. Flutter's dependency license collection should remain in the application build.

Focused verification is in `test/math_text_test.dart`: inline sentence continuity, display equations, Markdown readability, literal code, malformed expressions, parser bounds, inert HTML/macros, Vietnamese semantics and narrow selectable layouts. Run `flutter test test/math_text_test.dart` after installing the dependency. These checks cover presentation, not answer accuracy.
