/** The distributable laptop preview has local capture/storage, with no embedded OAuth. */
export function isDesktopPreview() {
  return process.env.LUMIO_DESKTOP === "true";
}

export function desktopConfig() {
  return {
    desktop: true as const,
    google: false,
    facebook: false,
    ai: false,
    capabilities: {
      tutor: false,
      summary: false,
      media: false,
      transcription: false,
      speech: false,
    },
  };
}
