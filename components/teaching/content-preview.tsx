"use client";

import { MathText } from "../lumio/math-text";
import type {
  LessonDraft,
  TeachingReference,
} from "../../lib/teaching/contracts";
import type { TeachingClient } from "./client";
import { TeachingResourceLink } from "./resource-link";

export function TeachingReferences({
  references,
  client,
}: {
  references?: TeachingReference[];
  client: TeachingClient;
}) {
  if (!references?.length) return null;
  return (
    <details className="tw-note" style={{ marginTop: 13 }}>
      <summary>Đối chiếu {references.length} trích đoạn nguồn</summary>
      {references.map((ref, i) => (
        <blockquote key={i} style={{ margin: "12px 0" }}>
          <strong>
            <MathText
              text={
                client.data!.materials.find((m) => m.id === ref.materialId)
                  ?.title || "Học liệu có quyền truy cập"
              }
              inline
            />
          </strong>
          <small style={{ display: "block" }}>
            Đoạn {ref.paragraph}
            {ref.page ? ` · Trang ${ref.page}` : ""}
            {ref.slide ? ` · Slide ${ref.slide}` : ""}
            {ref.heading && (
              <>
                {" "}
                · <MathText text={ref.heading} inline />
              </>
            )}
            {typeof ref.seconds === "number"
              ? ` · ${Math.floor(ref.seconds / 60)}:${String(Math.floor(ref.seconds % 60)).padStart(2, "0")}`
              : ""}
            {ref.materialRevision ? ` · Nguồn bản ${ref.materialRevision}` : ""}
          </small>
          <p>
            “<MathText text={ref.quote} inline />”
          </p>
        </blockquote>
      ))}
    </details>
  );
}

// One read-only presentation for the editor, publication check and classroom.
// It never normalizes the saved source or invents source locations.
export function LessonContent({
  lesson,
  client,
  showTitle = true,
}: {
  lesson: LessonDraft;
  client: TeachingClient;
  showTitle?: boolean;
}) {
  return (
    <div className="tw-form" data-lesson-content>
      {showTitle && (
        <h3>
          <MathText text={lesson.title} inline />
        </h3>
      )}
      <p className="tw-muted">
        <MathText text={lesson.topic} inline /> · Khối{" "}
        <MathText text={lesson.grade} inline />
      </p>
      {lesson.objectives.length > 0 && (
        <section>
          <h3>Mục tiêu</h3>
          <ul>
            {lesson.objectives.map((objective, i) => (
              <li key={i}>
                <MathText text={objective} inline />
              </li>
            ))}
          </ul>
        </section>
      )}
      {lesson.sourceIds
        .map((id) =>
          client.data?.materials.find((material) => material.id === id),
        )
        .filter((material) => !!material?.url)
        .map((material) => (
          <TeachingResourceLink
            key={material!.id}
            url={material!.url}
            title={material!.title}
            kind={material!.kind}
          />
        ))}
      {lesson.sections.map((section, i) => (
        <section key={i}>
          <h3>
            <MathText text={section.title} inline />
          </h3>
          <div className="tw-result">
            <MathText text={section.body} />
          </div>
          <TeachingReferences references={section.references} client={client} />
        </section>
      ))}
    </div>
  );
}
