"use client";
import type { ReactNode } from "react";
import { DraftBoundary, useDraft, useDraftGuard } from "../shared/draft-guard";

/** Teaching copy/styles over the shared in-memory draft registry. */
export function TeachingDraftBoundary({ children }: { children: ReactNode }) {
  return (
    <DraftBoundary
      copy={{
        title: "Giữ bản nháp đang làm?",
        description: (labels) =>
          `${labels.join(", ")} có nội dung chưa lưu. Tiếp tục sẽ bỏ phần đang nhập; dữ liệu đã lưu trên máy chủ được giữ nguyên.`,
        keep: "Ở lại chỉnh sửa",
        leave: "Bỏ bản nháp và tiếp tục",
      }}
      styles={{
        boundary: "tw-draft-boundary",
        dialog: "tw-dialog tw-discard-dialog",
        actions: "tw-form-footer",
        keep: "tw-button",
        leave: "tw-button secondary danger",
      }}
    >
      {children}
    </DraftBoundary>
  );
}
export { useDraft as useTeachingDraft, useDraftGuard as useTeachingDraftGuard };
