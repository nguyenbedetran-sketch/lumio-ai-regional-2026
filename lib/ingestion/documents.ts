import { Worker } from "node:worker_threads";
import * as nodeModule from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { getDocumentProxy } from "unpdf";
import { unzipSync } from "fflate";
import { Parser } from "htmlparser2";
import type { SourceEvidence, SourceUnit } from "../ai/grounding";
import { AIError } from "../ai/contracts";

export const DOCUMENT_LIMITS = {
  bytes: 6 * 1024 * 1024,
  text: 200000,
  pages: 100,
  timeout: 15000,
};
type ExtractedDocument = {
  kind: SourceEvidence["kind"];
  text: string;
  units: SourceUnit[];
};
// Eval contains fixed application code only. All user data is passed via structured clone.
// Terminating this worker also interrupts synchronous parsing/decompression on timeout.
const WORKER = String.raw`
const { parentPort, workerData } = require('node:worker_threads');
(async () => {
  const bytes = new Uint8Array(workerData.bytes);
  const units = []; let text = '';
  const clean = s => s.replace(/\u0000/g, '').replace(/[\t \f\v]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  function append(value, loc) {
    const valueClean = clean(value); if (!valueClean) return;
    if (text) text += '\n\n';
    const start = text.length; text += valueClean;
    if (text.length > 200000 || units.length >= 1000) throw Error('DOCUMENT_TEXT_TOO_LARGE');
    units.push({ start, end: text.length, ...loc });
  }
  if (workerData.kind === 'pdf') {
    const { getDocumentProxy } = await import(workerData.unpdf);
    const pdf = await getDocumentProxy(bytes, { isEvalSupported: false, useSystemFonts: false, maxImageSize: 16777216, disableFontFace: true, verbosity: 0 });
    try {
      if (pdf.numPages > 100) throw Error('DOCUMENT_TOO_MANY_PAGES');
      for (let page = 1; page <= pdf.numPages; page++) {
        const p = await pdf.getPage(page), content = await p.getTextContent();
        let value = '';
        for (const item of content.items) if (typeof item.str === 'string') value += item.str + (item.hasEOL ? '\n' : ' ');
        append(value, { page }); p.cleanup();
      }
    } finally { await pdf.loadingTask.destroy(); }
  } else {
    const { unzipSync } = require(workerData.fflate);
    const { Parser } = require(workerData.htmlparser2);
    let entries = 0, size = 0;
    const files = unzipSync(bytes, { filter: f => {
      if (++entries > 3000) throw Error('DOCUMENT_ARCHIVE_TOO_COMPLEX');
      if (!Number.isSafeInteger(f.originalSize) || f.originalSize < 0) throw Error('INVALID_DOCUMENT');
      const wanted = workerData.kind === 'docx' ? f.name === 'word/document.xml' : /^ppt\/slides\/slide[1-9]\d*\.xml$/.test(f.name) || ['ppt/presentation.xml','ppt/_rels/presentation.xml.rels'].includes(f.name);
      if (!wanted) return false;
      size += f.originalSize;
      if (f.originalSize > 2097152 || size > 8388608) throw Error('DOCUMENT_ARCHIVE_TOO_LARGE');
      return true;
    }});
    function paragraphs(xml, docx) {
      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('INVALID_DOCUMENT');
      // Reading only m:t would silently flatten fractions/radicals and change a problem.
      if (/<(?:\w+:)?oMath(?:Para)?(?:\s|>)/.test(xml)) throw Error('DOCUMENT_COMPLEX_MATH');
      const values = []; let depth = 0, content = '', read = 0, heading = false, tags = 0;
      const p = new Parser({
        onopentag(name, attrs) {
          if (++tags > 100000 || ++depth > 256) throw Error('DOCUMENT_ARCHIVE_TOO_COMPLEX');
          if (name === (docx ? 'w:p' : 'a:p')) { content = ''; heading = false; }
          if (name === (docx ? 'w:t' : 'a:t')) read++;
          if (docx && name === 'w:pStyle' && /^Heading[1-6]$/i.test(attrs['w:val'] || '')) heading = true;
          if (name === (docx ? 'w:tab' : 'a:br')) content += ' ';
          if (name === 'w:br') content += '\n';
        },
        ontext(value) { if (read) content += value; },
        onclosetag(name) {
          if (name === (docx ? 'w:t' : 'a:t')) read = Math.max(0, read - 1);
          if (name === (docx ? 'w:p' : 'a:p') && clean(content)) values.push({text:clean(content),heading});
          depth--;
        }
      }, { xmlMode:true, decodeEntities:true });
      p.write(xml); p.end(); return values;
    }
    if (workerData.kind === 'docx') {
      if (!files['word/document.xml']) throw Error('INVALID_DOCUMENT');
      let heading;
      for (const p of paragraphs(new TextDecoder('utf-8', {fatal:true}).decode(files['word/document.xml']), true)) {
        if (p.heading) heading = p.text.slice(0, 200);
        append(p.text, heading ? { heading } : {});
      }
    } else {
      if (!files['ppt/presentation.xml'] || !files['ppt/_rels/presentation.xml.rels']) throw Error('INVALID_DOCUMENT');
      const ids = [], rels = new Map();
      const parseStructure = (name, handler) => {
        const xml = new TextDecoder('utf-8', {fatal:true}).decode(files[name]);
        if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw Error('INVALID_DOCUMENT');
        const parser = new Parser({onopentag:handler}, {xmlMode:true,decodeEntities:true}); parser.write(xml); parser.end();
      };
      parseStructure('ppt/presentation.xml', (name,a) => { if (name === 'p:sldId') ids.push(a['r:id']); });
      parseStructure('ppt/_rels/presentation.xml.rels', (name,a) => {
        if (name === 'Relationship' && /\/slide$/.test(a.Type || '') && !a.TargetMode && /^slides\/slide[1-9]\d*\.xml$/.test(a.Target || '')) {
          if (rels.has(a.Id)) throw Error('INVALID_DOCUMENT'); rels.set(a.Id, 'ppt/' + a.Target);
        }
      });
      if (!ids.length || new Set(ids).size !== ids.length) throw Error('INVALID_DOCUMENT');
      if (ids.length > 100) throw Error('DOCUMENT_TOO_MANY_PAGES');
      const names = ids.map(id => rels.get(id));
      if (new Set(names).size !== names.length) throw Error('INVALID_DOCUMENT');
      for (let i = 0; i < names.length; i++) {
        const name = names[i], slide = i + 1;
        if (!name || !files[name]) throw Error('INVALID_DOCUMENT');
        const ps = paragraphs(new TextDecoder('utf-8', {fatal:true}).decode(files[name]), false);
        append(ps.map(p => p.text).join('\n\n'), { slide, ...(ps[0] ? { heading:ps[0].text.slice(0,200) } : {}) });
      }
    }
  }
  if (!text.trim()) throw Error('DOCUMENT_NO_TEXT');
  parentPort.postMessage({ text, units });
})().catch(e => parentPort.postMessage({ error: ['DOCUMENT_TOO_MANY_PAGES','DOCUMENT_TEXT_TOO_LARGE','DOCUMENT_ARCHIVE_TOO_LARGE','DOCUMENT_ARCHIVE_TOO_COMPLEX','DOCUMENT_NO_TEXT','DOCUMENT_COMPLEX_MATH'].includes(e.message) ? e.message : 'INVALID_DOCUMENT' }));
`;

export async function extractDocument(
  bytes: Uint8Array,
  filename: string,
  signal?: AbortSignal,
): Promise<ExtractedDocument> {
  const ext = filename.split(".").at(-1)?.toLowerCase();
  if (
    !["pdf", "docx", "pptx"].includes(ext || "") ||
    !bytes.length ||
    bytes.byteLength > DOCUMENT_LIMITS.bytes
  )
    throw new AIError("INVALID_DOCUMENT", 400);
  if (
    ext === "pdf"
      ? Buffer.from(bytes.subarray(0, 1024)).indexOf("%PDF-") < 0
      : !(bytes[0] === 0x50 && bytes[1] === 0x4b)
  )
    throw new AIError("INVALID_DOCUMENT", 400);
  // Static external imports make dependencies visible to standalone output tracing.
  if (!getDocumentProxy || !unzipSync || !Parser)
    throw new AIError("DOCUMENT_EXTRACTION_UNAVAILABLE", 503);
  signal?.throwIfAborted();
  // Reflect.get keeps webpack from replacing a dynamic createRequire argument
  // with undefined; the resolver must follow the deployed server's working dir.
  const resolver = Reflect.get(nodeModule, "createRequire")(
    join(process.cwd(), "package.json"),
  ) as NodeRequire;
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER, {
      eval: true,
      resourceLimits: {
        maxOldGenerationSizeMb: 128,
        maxYoungGenerationSizeMb: 16,
      },
      workerData: {
        bytes,
        kind: ext,
        unpdf: pathToFileURL(resolver.resolve("unpdf")).href,
        fflate: resolver.resolve("fflate"),
        htmlparser2: resolver.resolve("htmlparser2"),
      },
    });
    let done = false;
    const finish = (
      error?: AIError,
      value?: { text: string; units: SourceUnit[] },
    ) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      void worker.terminate();
      if (error) reject(error);
      else resolve({ kind: ext as SourceEvidence["kind"], ...value! });
    };
    const cancel = () => finish(new AIError("REQUEST_CANCELLED", 499));
    const timer = setTimeout(
      () => finish(new AIError("DOCUMENT_TIMEOUT", 504)),
      DOCUMENT_LIMITS.timeout,
    );
    signal?.addEventListener("abort", cancel, { once: true });
    worker.once("message", (data) => {
      if (data.error) finish(new AIError(data.error, 422));
      else finish(undefined, data);
    });
    worker.once("error", () => finish(new AIError("INVALID_DOCUMENT", 422)));
    worker.once("exit", () => {
      if (!done) finish(new AIError("INVALID_DOCUMENT", 422));
    });
  });
}
