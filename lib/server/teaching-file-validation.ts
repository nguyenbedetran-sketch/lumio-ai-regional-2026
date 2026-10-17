import { crc32, inflateRawSync } from "node:zlib";
import { teachingFileLimits } from "../teaching/file-contracts";
import { teachingError as fail } from "../teaching/validation";

function office(bytes: Buffer, kind: "docx" | "pptx") {
  // Inspect the complete central directory before decompression; ZIP64,
  // encryption, unsafe paths, embedded executables and extreme ratios fail shut.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6))
    fail("TEACHING_FILE_INVALID", 415);
  const entries = bytes.readUInt16LE(end + 10),
    directory = bytes.readUInt32LE(end + 16),
    directorySize = bytes.readUInt32LE(end + 12);
  if (
    !entries ||
    entries > 300 ||
    bytes.readUInt16LE(end + 8) !== entries ||
    directory + directorySize !== end ||
    end + 22 + bytes.readUInt16LE(end + 20) !== bytes.length
  )
    fail("TEACHING_FILE_INVALID", 415);
  let offset = directory,
    total = 0;
  const names = new Set<string>(),
    parts: {
      name: string;
      local: number;
      start: number;
      packed: number;
      size: number;
      method: number;
      crc: number;
    }[] = [];
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50)
      fail("TEACHING_FILE_INVALID", 415);
    const flags = bytes.readUInt16LE(offset + 8),
      method = bytes.readUInt16LE(offset + 10),
      packed = bytes.readUInt32LE(offset + 20),
      size = bytes.readUInt32LE(offset + 24),
      n = bytes.readUInt16LE(offset + 28),
      extra = bytes.readUInt16LE(offset + 30),
      comment = bytes.readUInt16LE(offset + 32),
      local = bytes.readUInt32LE(offset + 42);
    if (
      flags & 1 ||
      ![0, 8].includes(method) ||
      offset + 46 + n + extra + comment > end ||
      local + 30 > directory ||
      bytes.readUInt32LE(local) !== 0x04034b50
    )
      fail("TEACHING_FILE_INVALID", 415);
    const name = new TextDecoder("utf-8", { fatal: true }).decode(
      bytes.subarray(offset + 46, offset + 46 + n),
    );
    if (
      !name ||
      names.has(name) ||
      /[\\\x00-\x1f]/.test(name) ||
      name.startsWith("/") ||
      name.split("/").some((p) => p === ".." || p === ".") ||
      /(?:vbaProject|activeX|embeddings|oleObject|\.exe$|\.dll$)/i.test(name)
    )
      fail("TEACHING_FILE_INVALID", 415);
    if (
      size > 4 * 1024 * 1024 ||
      (total += size) > 8 * 1024 * 1024 ||
      (size > 65536 && size > Math.max(1, packed) * 100)
    )
      fail("TEACHING_FILE_INVALID", 415);
    const localName = bytes.readUInt16LE(local + 26),
      localExtra = bytes.readUInt16LE(local + 28);
    if (
      local + 30 + localName + localExtra + packed > directory ||
      !bytes
        .subarray(local + 30, local + 30 + localName)
        .equals(bytes.subarray(offset + 46, offset + 46 + n)) ||
      bytes.readUInt16LE(local + 6) & 1 ||
      bytes.readUInt16LE(local + 8) !== method
    )
      fail("TEACHING_FILE_INVALID", 415);
    names.add(name);
    parts.push({
      name,
      local,
      start: local + 30 + localName + localExtra,
      packed,
      size,
      method,
      crc: bytes.readUInt32LE(offset + 16),
    });
    offset += 46 + n + extra + comment;
  }
  if (
    offset !== end ||
    !names.has("[Content_Types].xml") ||
    !names.has(kind === "docx" ? "word/document.xml" : "ppt/presentation.xml")
  )
    fail("TEACHING_FILE_INVALID", 415);
  const ordered = [...parts].sort((a, b) => a.local - b.local);
  if (
    ordered.some(
      (part, index) =>
        index > 0 &&
        part.local < ordered[index - 1].start + ordered[index - 1].packed,
    )
  )
    fail("TEACHING_FILE_INVALID", 415);
  const files: Record<string, Uint8Array> = {};
  for (const part of parts) {
    if (!(
      part.name.endsWith(".rels") ||
      part.name === "[Content_Types].xml" ||
      part.name ===
        (kind === "docx" ? "word/document.xml" : "ppt/presentation.xml")
    ))
      continue;
    const packed = bytes.subarray(part.start, part.start + part.packed);
    // A forged central-directory size must not let inflate continue through a
    // huge actual stream. Native zlib aborts at the declared output ceiling;
    // the complete archive's declared expansion was already capped at8MiB.
    const value =
      part.method === 8
        ? inflateRawSync(packed, { maxOutputLength: Math.max(1, part.size) })
        : packed;
    if (value.length !== part.size || crc32(value) !== part.crc)
      fail("TEACHING_FILE_INVALID", 415);
    files[part.name] = value;
  }
  for (const value of Object.values(files)) {
    const xml = new TextDecoder("utf-8", { fatal: true }).decode(value);
    if (
      /<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External["']|macroEnabled|vbaProject/i.test(
        xml,
      )
    )
      fail("TEACHING_FILE_INVALID", 415);
  }
  const types = new TextDecoder().decode(
    files["[Content_Types].xml"] || new Uint8Array(),
  );
  if (
    !types.includes(
      kind === "docx"
        ? "wordprocessingml.document.main+xml"
        : "presentationml.presentation.main+xml",
    )
  )
    fail("TEACHING_FILE_INVALID", 415);
}

export function validateTeachingFile(filename: unknown, encoded: unknown) {
  if (
    typeof filename !== "string" ||
    !filename.trim() ||
    filename.length > 180 ||
    /[\\/:\x00-\x1f\x7f\u202a-\u202e\u2066-\u2069]/.test(filename)
  )
    fail("TEACHING_FILE_INVALID", 415);
  const name = filename.normalize("NFC").trim(),
    extension = name.split(".").at(-1)?.toLowerCase();
  const mimes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    txt: "text/plain",
    md: "text/markdown",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  if (!extension || !mimes[extension]) fail("TEACHING_FILE_UNSUPPORTED", 415);
  if (
    typeof encoded !== "string" ||
    encoded.length > Math.ceil(teachingFileLimits.fileBytes / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  )
    fail("TEACHING_FILE_TOO_LARGE", 413);
  const bytes = Buffer.from(encoded, "base64");
  if (
    !bytes.length ||
    bytes.length > teachingFileLimits.fileBytes ||
    bytes.toString("base64") !== encoded
  )
    fail("TEACHING_FILE_TOO_LARGE", 413);
  try {
    if (extension === "pdf") {
      if (
        !/^%PDF-\d\.\d/.test(bytes.subarray(0, 8).toString("ascii")) ||
        !bytes.subarray(-2048).includes(Buffer.from("%%EOF"))
      )
        fail("TEACHING_FILE_INVALID", 415);
    } else if (extension === "png") {
      if (
        bytes.length < 33 ||
        bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        bytes.subarray(12, 16).toString() !== "IHDR" ||
        !bytes.subarray(-12).includes(Buffer.from("IEND"))
      )
        fail("TEACHING_FILE_INVALID", 415);
    } else if (["jpg", "jpeg"].includes(extension)) {
      if (
        bytes.length < 4 ||
        bytes[0] !== 255 ||
        bytes[1] !== 216 ||
        bytes[2] !== 255 ||
        bytes.at(-2) !== 255 ||
        bytes.at(-1) !== 217
      )
        fail("TEACHING_FILE_INVALID", 415);
    } else if (extension === "webp") {
      if (
        bytes.length < 16 ||
        bytes.subarray(0, 4).toString() !== "RIFF" ||
        bytes.subarray(8, 12).toString() !== "WEBP" ||
        bytes.readUInt32LE(4) + 8 !== bytes.length
      )
        fail("TEACHING_FILE_INVALID", 415);
    } else if (extension === "docx" || extension === "pptx")
      office(bytes, extension);
    else {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text))
        fail("TEACHING_FILE_INVALID", 415);
    }
  } catch {
    fail("TEACHING_FILE_INVALID", 415);
  }
  return { name, mime: mimes[extension], bytes };
}
