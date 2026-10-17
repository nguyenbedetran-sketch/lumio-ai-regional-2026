import type { Locale } from "./i18n";

export const backupImportCopy: Record<
  Locale,
  {
    saving: string;
    saved: string;
    changed: string;
    failed: string;
    partial: string;
  }
> = {
  vi: {
    saving: "Đang lưu bản sao trên thiết bị này…",
    saved:
      "Đã lưu thư viện, tiến độ và tùy chọn có trong bản sao trên thiết bị này.",
    changed:
      "Dữ liệu hoặc tài khoản đã thay đổi. Bản sao chưa được áp dụng; hãy kiểm tra và chọn lại tệp.",
    failed:
      "Chưa xác nhận lưu thư viện. Tiến độ và tùy chọn chưa được thay thế. Giữ tệp sao lưu, kiểm tra lỗi lưu trữ hoặc xung đột rồi thử lại.",
    partial:
      "Thư viện đã được lưu, nhưng tiến độ hoặc tùy chọn chưa được khôi phục đầy đủ. Hãy kiểm tra và xuất dữ liệu hiện tại trước khi thử lại; các phần này dùng vùng lưu trữ riêng.",
  },
  en: {
    saving: "Saving this backup on this device…",
    saved:
      "The library, progress and preferences included in the backup were saved on this device.",
    changed:
      "The data or account changed. The backup was not applied; review your work and select the file again.",
    failed:
      "The library save was not acknowledged. Progress and preferences were not replaced. Keep the backup, resolve storage errors or conflicts, then retry.",
    partial:
      "The library was saved, but progress or preferences were not fully restored. Review and export the current data before retrying; these parts use separate storage.",
  },
  "zh-CN": {
    saving: "正在此设备保存备份…",
    saved: "备份中的资料库、进度和偏好已保存到此设备。",
    changed: "数据或账号已更改。尚未应用备份；请检查后重新选择文件。",
    failed:
      "尚未确认资料库保存成功。进度和偏好未被替换。请保留备份，解决存储错误或冲突后重试。",
    partial:
      "资料库已保存，但进度或偏好尚未完全恢复。请先检查并导出当前数据后再重试；这些部分使用独立存储。",
  },
  ja: {
    saving: "この端末にバックアップを保存しています…",
    saved:
      "バックアップに含まれるライブラリ、学習記録と設定をこの端末に保存しました。",
    changed:
      "データまたはアカウントが変わりました。バックアップは適用していません。確認してファイルを選び直してください。",
    failed:
      "ライブラリの保存を確認できません。学習記録と設定は置き換えていません。バックアップを保持し、保存エラーや競合を解決してから再試行してください。",
    partial:
      "ライブラリは保存しましたが、学習記録または設定の復元は未完了です。再試行前に現在のデータを確認して出力してください。各部分は別々に保存されます。",
  },
  ko: {
    saving: "이 기기에 백업을 저장하는 중…",
    saved: "백업에 포함된 라이브러리, 학습 기록과 설정을 이 기기에 저장했어요.",
    changed:
      "데이터 또는 계정이 변경됐어요. 백업을 적용하지 않았으니 확인 후 파일을 다시 선택하세요.",
    failed:
      "라이브러리 저장을 확인하지 못했어요. 학습 기록과 설정은 바꾸지 않았어요. 백업을 보관하고 저장 오류나 충돌을 해결한 뒤 다시 시도하세요.",
    partial:
      "라이브러리는 저장했지만 학습 기록 또는 설정 복원은 끝나지 않았어요. 각 부분은 따로 저장되므로 다시 시도하기 전에 현재 데이터를 확인하고 내보내세요.",
  },
};
