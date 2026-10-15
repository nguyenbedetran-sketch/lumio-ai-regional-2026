# Third-party runtime notices

- Electron **44.5.1**: https://github.com/electron/electron/releases/tag/v44.5.1 — MIT. The portable distribution retains `LICENSE` and Chromium `LICENSES.chromium.html` from the official runtime.
- Node.js **24.19.0**: https://github.com/nodejs/node/tree/v24.19.0 — Node and bundled component licenses are in `resources/runtime/NODE-LICENSE.txt`.
- Next.js **15.5.12**, React **19.1.1**, Motion **13.4.4**, cmdk **1.1.1**, Lucide, KaTeX, htmlparser2 and next-auth belong to the Lumio web workspace; included backend package licenses are retained in its node_modules distribution.
- `@electron/packager` **20.3.0** is development tooling only; no application privilege or user data access is given to it at runtime.

Windows audio loopback is implemented with Electron's official `session.setDisplayMediaRequestHandler`, granting `audio: 'loopback'` only after explicit confirmation to the requesting top-level Lumio frame:
https://www.electronjs.org/docs/latest/api/session#sessetdisplaymediarequesthandlerhandler-opts

Security design follows sandbox/context isolation and denied-by-default permissions:
https://www.electronjs.org/docs/latest/tutorial/security

The existing Lumio logo is reused as supplied by the owner. This application is not affiliated with Zoom, Microsoft, Google, Meta or Electron.
