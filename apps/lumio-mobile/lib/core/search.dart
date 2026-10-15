/// Vietnamese search without requesting a network index or changing source text.
String searchText(String value) {
  var normalized = value.toLowerCase();
  const groups = <String, String>{
    'a': 'àáạảãâầấậẩẫăằắặẳẵ',
    'e': 'èéẹẻẽêềếệểễ',
    'i': 'ìíịỉĩ',
    'o': 'òóọỏõôồốộổỗơờớợởỡ',
    'u': 'ùúụủũưừứựửữ',
    'y': 'ỳýỵỷỹ',
    'd': 'đ',
  };
  for (final entry in groups.entries) {
    normalized = normalized.replaceAll(RegExp('[${entry.value}]'), entry.key);
  }
  return normalized.replaceAll(RegExp(r'[\u0300-\u036f]'), '').trim();
}

bool matchesLearningText(String source, String query) {
  final words = searchText(
    query,
  ).split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  final indexed = searchText(source);
  return words.every(indexed.contains);
}
