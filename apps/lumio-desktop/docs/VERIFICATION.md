# Windows desktop verification — 0.1.0

Verified on Windows x64 using the packaged `Lumio AI.exe`, Electron **44.5.1**, bundled Node **24.19.0**, and clean web **1.5.0-preview.1**.

The final runtime was rebuilt from the clean web build after full-media summary and the segmented AudioReadout changes. Clean source, staged backend and packaged backend `.next/BUILD_ID` share SHA-256 `48d84b29f67b41a53c7d45938e693ccc19b0b5504f19dabd4a18e4285d373050`.

- **8 security and packaging tests passed**: exact origin and owned frame, denied camera/unknown permissions, required display gesture, safe external navigation, restricted server settings, and refusal of `.env` variants before replacing a verified bundle.
- **19 native checks passed** in `smoke-report.json`: real BrowserWindow hydration, isolated preload, no renderer Node access, sandbox, offline auth configuration, permission denial, native Stop delivery, visible page motion, actual voice-room capture button, backend shutdown, port release, and refusal of an occupied foreign service.
- The pinned Electron 44 permission pipeline was exercised. It reports `media` with an empty `mediaTypes` list before display capture. The saved native display request has a valid original gesture for an explicit button action. A request after activation expires reaches the native callback with `userGesture: false` and fails the capture policy.
- Native QA uses a fresh isolated profile and **denies every final capture request**. No microphone, system, Zoom or other real audio/video stream was acquired. The actual capture button returned to idle with a permission error. Real Zoom loopback sound quality and device compatibility still need testing by the user.
- Both `lumio-desktop-preview.png` and `lumio-desktop-voice-preview.png` were visually inspected after entry animations settled.

The staged runtime contains **2,230 files** plus its hash manifest. Next.js `public` and `.next/static` are included. Eighteen uniquely versioned traced packages use a conventional flat `node_modules` layout, avoiding broken Windows symlinks. Node/Electron notices are retained. Staging excludes environment files, database files and logs; the final parent release process performs its additional configured-credential scan and ZIP integrity verification.

AI services, browser-to-desktop OAuth session transfer, paid billing, native updates and store distribution are not enabled in this desktop preview. Recording is local; online AI and configured social login use the web app.
