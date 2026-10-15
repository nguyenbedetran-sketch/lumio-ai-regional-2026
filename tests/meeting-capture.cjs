const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(
            path.relative(
              root,
              path.resolve(path.dirname(filename), `${name}.ts`),
            ),
          )
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const {
  MeetingCapture,
  browserMeetingEnvironment,
  MEETING_LIMITS,
  meetingSource,
  meetingClock,
  stopCaptureStreams,
} = load("lib/voice/meeting-capture.ts");
const { meetingCopy } = load("lib/voice/meeting-copy.ts");
const flush = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}
class Track extends EventTarget {
  constructor(kind, surface = "browser") {
    super();
    this.kind = kind;
    this.surface = surface;
    this.label = `Synthetic ${kind}`;
    this.readyState = "live";
    this.stops = 0;
  }
  stop() {
    this.stops++;
    this.readyState = "ended";
  }
  end() {
    this.readyState = "ended";
    this.dispatchEvent(new Event("ended"));
  }
  getSettings() {
    return { displaySurface: this.surface };
  }
}
class Stream {
  constructor(tracks = []) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === "audio");
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === "video");
  }
}
class Recorder {
  constructor(stream, options) {
    this.stream = stream;
    this.mimeType = options.mimeType;
    this.state = "inactive";
    this.starts = 0;
  }
  start(slice) {
    this.slice = slice;
    this.state = "recording";
    this.starts++;
  }
  pause() {
    this.state = "paused";
  }
  resume() {
    this.state = "recording";
  }
  data(blob = new Blob(["synthetic-audio"])) {
    this.ondataavailable?.({ data: blob });
  }
  stop() {
    this.state = "inactive";
    queueMicrotask(() => {
      this.data();
      this.onstop?.();
    });
  }
}
function setup(overrides = {}) {
  const audio = new Track("audio"),
    video = new Track("video"),
    mic = new Track("audio");
  const display = new Stream([audio, video]),
    microphone = new Stream([mic]);
  const changes = [],
    completed = [],
    recorders = [];
  let now = 0,
    repeat = null,
    displays = 0,
    microphones = 0,
    mixedDisposed = 0,
    options;
  const env = {
    display: async () => {
      displays++;
      return display;
    },
    microphone: async () => {
      microphones++;
      return microphone;
    },
    supportsMime: (mime) => mime === "audio/webm;codecs=opus",
    audioStream: (tracks) => new Stream(tracks),
    recorder: (stream, value) => {
      options = value;
      const r = new Recorder(stream, value);
      recorders.push(r);
      return r;
    },
    mix: async () => ({
      stream: new Stream([new Track("audio")]),
      dispose: () => {
        mixedDisposed++;
      },
    }),
    now: () => now,
    repeat: (callback) => {
      repeat = callback;
      return 1;
    },
    clearRepeat: () => {
      repeat = null;
    },
    ...overrides,
  };
  const capture = new MeetingCapture(
    env,
    (s) => changes.push(s),
    (r) => completed.push(r),
  );
  return {
    capture,
    env,
    audio,
    video,
    mic,
    display,
    microphone,
    changes,
    completed,
    recorders,
    state: () => changes.at(-1),
    tick: (milliseconds) => {
      now += milliseconds;
      repeat?.();
    },
    metrics: () => ({
      displays,
      microphones,
      mixedDisposed,
      options,
      timer: repeat !== null,
    }),
  };
}
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
(async () => {
  await test("constructing and rendering state never requests permission", () => {
    const s = setup();
    assert.equal(s.metrics().displays, 0);
    assert.equal(s.metrics().microphones, 0);
    s.capture.dispose();
  });
  await test("explicit start requests sharing once and recorder receives audio only", async () => {
    const s = setup();
    await s.capture.start();
    assert.equal(s.metrics().displays, 1);
    assert.equal(s.metrics().microphones, 0);
    assert.equal(s.recorders[0].stream.getVideoTracks().length, 0);
    assert.equal(s.video.readyState, "live");
    assert.equal(s.metrics().options.audioBitsPerSecond, 64000);
    assert.equal(s.state().source, "tab");
    s.capture.dispose();
  });
  await test("double start is ignored while permission is pending", async () => {
    const d = deferred();
    let requests = 0;
    const s = setup({
      display: () => {
        requests++;
        return d.promise;
      },
    });
    const starting = s.capture.start();
    await s.capture.start();
    assert.equal(requests, 1);
    s.capture.cancel();
    d.resolve(s.display);
    await starting;
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.recorders.length, 0);
  });
  await test("unmount while permission pending stops late stream without callbacks", async () => {
    const d = deferred();
    const s = setup({ display: () => d.promise });
    const start = s.capture.start();
    s.capture.dispose();
    const count = s.changes.length;
    d.resolve(s.display);
    await start;
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.changes.length, count);
    assert.equal(s.completed.length, 0);
  });
  await test("cancelled permission produces retryable denial without recording", async () => {
    const s = setup({
      display: async () => {
        throw new DOMException("denied", "NotAllowedError");
      },
    });
    await s.capture.start();
    assert.equal(s.state().error, "denied");
    assert.equal(s.state().phase, "idle");
    assert.equal(s.recorders.length, 0);
  });
  await test("source without audio releases video and never requests microphone", async () => {
    const v = new Track("video");
    const s = setup({ display: async () => new Stream([v]) });
    await s.capture.start(true);
    assert.equal(v.readyState, "ended");
    assert.equal(s.state().error, "noAudio");
    assert.equal(s.metrics().microphones, 0);
  });
  await test("unsupported audio format prevents permission prompt", async () => {
    const s = setup({ supportsMime: () => false });
    await s.capture.start();
    assert.equal(s.state().error, "unsupported");
    assert.equal(s.metrics().displays, 0);
  });
  await test("pause excludes paused time and resume preserves recording", async () => {
    const s = setup();
    await s.capture.start();
    s.tick(2200);
    s.capture.pause();
    assert.equal(s.state().seconds, 2);
    s.tick(6000);
    assert.equal(s.state().seconds, 2);
    s.capture.resume();
    s.tick(3100);
    assert.equal(s.state().seconds, 5);
    s.capture.stop();
    await flush();
    assert.equal(s.completed[0].seconds, 5);
  });
  await test("finish releases all tracks and exports local audio with correct MIME", async () => {
    const s = setup();
    await s.capture.start();
    s.tick(1000);
    s.capture.stop();
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.metrics().timer, false);
    await flush();
    assert.equal(s.state().phase, "idle");
    assert.equal(s.completed.length, 1);
    assert.equal(s.completed[0].mime, "audio/webm;codecs=opus");
    assert.equal(s.completed[0].filename, "lumio-meeting.webm");
    assert.ok(s.completed[0].blob.size > 0);
  });
  await test("cancel discards audio even if a stop event arrives later", async () => {
    const s = setup();
    await s.capture.start();
    s.recorders[0].data();
    s.capture.cancel();
    await flush();
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.completed.length, 0);
    assert.equal(s.state().phase, "idle");
  });
  await test("display video ending stops audio capture", async () => {
    const s = setup();
    await s.capture.start();
    s.video.end();
    await flush();
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.state().notice, "ended");
    assert.equal(s.completed.length, 1);
  });
  await test("display audio ending stops video capture", async () => {
    const s = setup();
    await s.capture.start();
    s.audio.end();
    await flush();
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.completed.length, 1);
  });
  await test("duration limit finishes and frees source while producing bounded audio", async () => {
    const s = setup();
    await s.capture.start();
    s.tick(MEETING_LIMITS.seconds * 1000 + 2000);
    await flush();
    assert.equal(s.state().notice, "duration");
    assert.equal(s.completed[0].seconds, MEETING_LIMITS.seconds);
    assert.equal(s.video.readyState, "ended");
  });
  await test("paused source sharing has a total session lifetime limit", async () => {
    const s = setup();
    await s.capture.start();
    s.tick(2000);
    s.capture.pause();
    s.tick(MEETING_LIMITS.sessionSeconds * 1000);
    await flush();
    assert.equal(s.state().notice, "session");
    assert.equal(s.completed[0].seconds, 2);
    assert.equal(s.video.readyState, "ended");
  });
  await test("oversize take is discarded and all tracks stopped", async () => {
    const s = setup();
    await s.capture.start();
    s.recorders[0].data(new Blob([new Uint8Array(MEETING_LIMITS.bytes + 1)]));
    await flush();
    assert.equal(s.state().error, "size");
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.completed.length, 0);
  });
  await test("empty recording reports failure after releasing tracks", async () => {
    const s = setup();
    await s.capture.start();
    s.recorders[0].stop = function () {
      this.state = "inactive";
      queueMicrotask(() => this.onstop?.());
    };
    s.capture.stop();
    await flush();
    assert.equal(s.state().error, "empty");
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.video.readyState, "ended");
  });
  await test("recorder error releases all resources and does not export failed take", async () => {
    const s = setup();
    await s.capture.start();
    s.recorders[0].onerror();
    await flush();
    assert.equal(s.state().error, "failed");
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.completed.length, 0);
  });
  await test("recorder construction failure releases both original tracks", async () => {
    const s = setup({
      recorder: () => {
        throw new Error("codec failure");
      },
    });
    await s.capture.start();
    assert.equal(s.state().error, "failed");
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.video.readyState, "ended");
  });
  await test("microphone only requested when explicitly opted in and mixer disposed", async () => {
    const s = setup();
    await s.capture.start(true);
    assert.equal(s.metrics().microphones, 1);
    assert.equal(s.state().microphone, true);
    assert.equal(s.recorders[0].stream.getVideoTracks().length, 0);
    s.capture.stop();
    await flush();
    assert.equal(s.mic.readyState, "ended");
    assert.equal(s.metrics().mixedDisposed, 1);
  });
  await test("microphone denial releases already granted screen audio and video", async () => {
    const s = setup({
      microphone: async () => {
        throw new DOMException("mic denied", "NotAllowedError");
      },
    });
    await s.capture.start(true);
    assert.equal(s.state().error, "microphone");
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.video.readyState, "ended");
  });
  await test("cancel while microphone permission pending frees display and late microphone", async () => {
    const d = deferred();
    const s = setup({ microphone: () => d.promise });
    const start = s.capture.start(true);
    await flush();
    s.capture.cancel();
    assert.equal(s.video.readyState, "ended");
    d.resolve(s.microphone);
    await start;
    assert.equal(s.mic.readyState, "ended");
    assert.equal(s.recorders.length, 0);
  });
  await test("late mixer completion after cancellation frees output and context", async () => {
    const d = deferred();
    let disposed = 0;
    const output = new Track("audio");
    const s = setup({ mix: () => d.promise });
    const start = s.capture.start(true);
    await flush();
    s.capture.cancel();
    d.resolve({
      stream: new Stream([output]),
      dispose: () => {
        disposed++;
      },
    });
    await start;
    assert.equal(output.readyState, "ended");
    assert.equal(s.mic.readyState, "ended");
    assert.equal(disposed, 1);
    assert.equal(s.recorders.length, 0);
  });
  await test("microphone ending during delayed mixer setup aborts safely", async () => {
    const d = deferred();
    const s = setup({ mix: () => d.promise });
    const start = s.capture.start(true);
    await flush();
    s.mic.end();
    d.resolve({ stream: new Stream([new Track("audio")]), dispose: () => {} });
    await start;
    assert.equal(s.state().error, "microphone");
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.recorders.length, 0);
  });
  await test("screen ending while microphone permission pending aborts before recording", async () => {
    const d = deferred();
    const s = setup({ microphone: () => d.promise });
    const start = s.capture.start(true);
    await flush();
    s.video.end();
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.state().phase, "idle");
    d.resolve(s.microphone);
    await start;
    assert.equal(s.state().error, "unavailable");
    assert.equal(s.mic.readyState, "ended");
    assert.equal(s.recorders.length, 0);
  });
  await test("stalled microphone permission cannot keep an owned screen stream alive indefinitely", async () => {
    const d = deferred();
    const s = setup({ microphone: () => d.promise });
    const start = s.capture.start(true);
    await flush();
    s.tick(MEETING_LIMITS.sessionSeconds * 1000);
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.audio.readyState, "ended");
    assert.equal(s.state().error, "unavailable");
    d.resolve(s.microphone);
    await start;
    assert.equal(s.mic.readyState, "ended");
    assert.equal(s.recorders.length, 0);
  });
  await test("dispose active capture stops tracks and excludes late completions", async () => {
    const s = setup();
    await s.capture.start(true);
    s.capture.dispose();
    await flush();
    assert.equal(s.video.readyState, "ended");
    assert.equal(s.mic.readyState, "ended");
    assert.equal(s.metrics().mixedDisposed, 1);
    assert.equal(s.completed.length, 0);
  });
  await test("a fresh take prompts again after completing previous recording", async () => {
    const s = setup();
    await s.capture.start();
    s.capture.stop();
    await flush();
    s.env.display = async () =>
      new Stream([new Track("audio"), new Track("video")]);
    await s.capture.start();
    assert.equal(s.recorders.length, 2);
    assert.equal(s.state().phase, "recording");
    s.capture.dispose();
  });
  await test("source descriptions and timer reject unsupported assumptions", () => {
    assert.equal(meetingSource("browser"), "tab");
    assert.equal(meetingSource("monitor"), "screen");
    assert.equal(meetingSource("window"), "window");
    assert.equal(meetingSource("Zoom"), "unknown");
    assert.equal(meetingClock(72), "01:12");
    assert.equal(meetingClock(NaN), "00:00");
    assert.equal(meetingClock(-30), "00:00");
  });
  await test("cleanup stops each shared owned track once", () => {
    const track = new Track("audio"),
      stream = new Stream([track]);
    stopCaptureStreams(stream, stream);
    assert.equal(track.stops, 1);
  });
  await test("desktop system audio override does not mislabel own UI video as a tab", async () => {
    const s = setup({ sourceOverride: "screen" });
    await s.capture.start();
    assert.equal(s.state().source, "screen");
    assert.equal(s.state().label, "");
    s.capture.dispose();
  });
  await test("mixer never feeds speakers and disposes context and output", async () => {
    const previous = global.AudioContext;
    let context;
    class Context {
      constructor() {
        context = this;
        this.state = "running";
        this.destination = { name: "speakers" };
        this.connections = [];
        this.closed = 0;
        this.output = new Track("audio");
      }
      node() {
        return {
          connect: (target) => this.connections.push(target),
          disconnect() {},
        };
      }
      createMediaStreamDestination() {
        return { ...this.node(), stream: new Stream([this.output]) };
      }
      createMediaStreamSource() {
        return this.node();
      }
      createGain() {
        return { ...this.node(), gain: { value: 1 } };
      }
      resume() {
        return Promise.resolve();
      }
      close() {
        this.closed++;
        this.state = "closed";
        return Promise.resolve();
      }
    }
    const previousStream = global.MediaStream;
    global.AudioContext = Context;
    global.MediaStream = Stream;
    try {
      const s = setup(),
        abort = new AbortController();
      const mixed = await browserMeetingEnvironment().mix(
        s.display,
        s.microphone,
        abort.signal,
      );
      assert.ok(!context.connections.includes(context.destination));
      await mixed.dispose();
      await mixed.dispose();
      assert.equal(context.closed, 1);
      assert.equal(context.output.readyState, "ended");
    } finally {
      global.AudioContext = previous;
      global.MediaStream = previousStream;
    }
  });
  await test("cancelling pending AudioContext resume closes it immediately", async () => {
    const previous = global.AudioContext,
      previousStream = global.MediaStream;
    const pending = deferred();
    let context;
    class Context {
      constructor() {
        context = this;
        this.state = "suspended";
        this.closed = 0;
        this.output = new Track("audio");
      }
      node() {
        return { connect() {}, disconnect() {} };
      }
      createMediaStreamDestination() {
        return { ...this.node(), stream: new Stream([this.output]) };
      }
      createMediaStreamSource() {
        return this.node();
      }
      createGain() {
        return { ...this.node(), gain: { value: 1 } };
      }
      resume() {
        return pending.promise;
      }
      close() {
        this.closed++;
        this.state = "closed";
        return Promise.resolve();
      }
    }
    global.AudioContext = Context;
    global.MediaStream = Stream;
    try {
      const s = setup(),
        abort = new AbortController();
      const mixed = browserMeetingEnvironment().mix(
        s.display,
        s.microphone,
        abort.signal,
      );
      abort.abort();
      assert.equal(context.closed, 1);
      assert.equal(context.output.readyState, "ended");
      pending.resolve();
      await assert.rejects(mixed, { name: "AbortError" });
      assert.equal(context.closed, 1);
    } finally {
      global.AudioContext = previous;
      global.MediaStream = previousStream;
    }
  });
  await test("all five locales contain complete meeting UI messages", () => {
    const keys = Object.keys(meetingCopy.en).sort();
    assert.equal(Object.keys(meetingCopy).length, 5);
    for (const copy of Object.values(meetingCopy)) {
      assert.deepEqual(Object.keys(copy).sort(), keys);
      assert.ok(
        Object.values(copy).every(
          (value) => typeof value === "string" && value.trim().length,
        ),
      );
    }
  });
  console.log(
    `Meeting capture: ${passed} checks passed (synthetic streams only, no devices or network).`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
