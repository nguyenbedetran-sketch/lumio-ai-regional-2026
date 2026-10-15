"use strict";

const ORIGIN = "http://127.0.0.1:3210";

function exactOrigin(value, origin = ORIGIN) {
  try {
    const url = new URL(value);
    return url.origin === origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

function trustedContents(contents, expected, origin = ORIGIN) {
  return !!contents && contents === expected && !contents.isDestroyed() && exactOrigin(contents.getURL(), origin);
}

function trustedPermission(contents, expected, details, origin = ORIGIN) {
  return trustedContents(contents, expected, origin) && details?.isMainFrame === true && exactOrigin(details.requestingUrl, origin) && (!details.securityOrigin || exactOrigin(details.securityOrigin, origin));
}

function trustedDisplayRequest(request, expected, origin = ORIGIN) {
  return !!request && !!expected && !expected.isDestroyed() && request.userGesture === true && request.audioRequested === true && request.videoRequested === true && exactOrigin(request.securityOrigin, origin) && request.frame === expected.mainFrame && request.frame.top === request.frame && exactOrigin(request.frame.url, origin);
}

function allowedMicrophone(details) {
  return Array.isArray(details?.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === "audio";
}

function capturePermissionKind(permission, details) {
  if (permission === "media" && allowedMicrophone(details)) return "microphone";
  // Electron 44 reports display media as `media` with empty mediaTypes.
  // Electron 45 uses display-capture with explicit audio/video mediaTypes.
  if (permission === "media" && Array.isArray(details?.mediaTypes) && details.mediaTypes.length === 0) return "system";
  if (permission === "display-capture" && Array.isArray(details?.mediaTypes) && details.mediaTypes.length === 2 && details.mediaTypes.includes("audio") && details.mediaTypes.includes("video")) return "system";
  return "denied";
}

function safeExternalURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname || /^(localhost|127\.|\[?::1\]?$)/i.test(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function approvedServerSettings(input) {
  const allowed = new Set([
    "OPENAI_API_KEY", "OPENAI_MODEL", "GEMINI_API_KEY", "GEMINI_MODEL",
    "XAI_API_KEY", "XAI_STT_MODEL", "XAI_VOICE",
  ]);
  const result = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return result;
  for (const [key, value] of Object.entries(input)) {
    if (allowed.has(key) && typeof value === "string" && value.length < 4096 && !/[\r\n\0]/.test(value)) result[key] = value;
  }
  return result;
}

module.exports = { ORIGIN, exactOrigin, trustedContents, trustedPermission, trustedDisplayRequest, allowedMicrophone, capturePermissionKind, safeExternalURL, approvedServerSettings };
