# Compiled remote database startup regression

17October2026. Candidate0d2e85bf2ffb passed local and Linux suites, but its first Render rollout did not become healthy. Next started, the authorized production database still had no application schema in the provider UI, and the old public service remained active. The attempted deployment was canceled at15:41:20 Asia/Bangkok. It was not accepted or submitted as a successful release.

## Root cause and coverage gap

Webpack transformed the source `require.resolve("libsql")` into a numeric module identifier inside the compiled server chunk. That value crossed the broker boundary as `driverPath`. The separate native Node child expects a filesystem path for `require(driverPath)`; a number fails before it can open the database. Health correctly returned unavailable but intentionally did not expose the underlying private exception.

The earlier generated-native test loaded transpiled source and actual native SQLite, while compiled HTTP tests selected the local SQLite adapter. Each passed its stated scope. Neither exercised the compiled remote-mode broker-to-native-child path. A successful build or native-only test was therefore insufficient evidence for remote production readiness.

## Narrow correction

Pass the stable absolute installed package directory to the unbundled native Node child, which resolves that directory and its dependencies itself. A direct `createRequire(...).resolve` and an indirect named-import invocation also failed in diagnostic builds; their receipts remain archived. The final correction uses no dynamic resolver import inside the bundle. A separate unused `require.resolve` expression retains the bundler's existing dependency tracing graph only; its computed module identifier is never sent to the child or executed as a native database on the main thread. Actual compiled execution must verify an absolute existing driver path rather than infer it from source. Keep canonical schema, remote-only production configuration, transaction limits, authentication, file and wallet logic unchanged. Verify standalone tracing independently so an isolated package does not accidentally resolve through a parent checkout's node_modules.

`scripts/test-database-production.cjs` starts the actual compiled Next server in remote mode. In its deterministic mode only, a test-process Node preload redirects an exact synthetic worker URL to a temporary SQLite filename and records the received driver-path type. It does not replace that driver value, bypass SQL, add an application environment escape hatch or expose a production route. The actual broker/native child must initialize canonical schema20 and answer repeated real HTTP health requests. The original compiled bundle reproduced503 with a numeric/nonexistent driver path; that failure receipt is preserved.

The same runner's explicit `--remote-qa` mode uses the approved isolated QA URL/key and no transport preload, verifying actual compiled Next HTTP against Turso. Production credentials are used only by the authorized Render server. Native deterministic coverage, actual remote QA, Linux CI and public Google/restart acceptance remain distinct gates.

The new compiled database test runs after build in CI. See `reports/database-production/` for before/after scoped receipts and `FINAL-RELEASE-CHECKLIST.md` for final exact-source and public gates. Do not convert the canceled rollout or its earlier CI success into production acceptance.
