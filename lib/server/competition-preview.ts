/** Explicit, limited regional-competition mode. This is not durable production storage. */
export function isCompetitionPreview() {
  return process.env.LUMIO_COMPETITION_PREVIEW === "true" &&
    process.env.LUMIO_PUBLIC_DEMO !== "true" && process.env.LUMIO_DESKTOP !== "true";
}

