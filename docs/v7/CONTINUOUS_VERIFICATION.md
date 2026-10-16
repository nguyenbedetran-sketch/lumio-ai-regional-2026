# Continuous verification

`.github/workflows/verify.yml` runs the current deterministic/SQLite regression, a production build, then TypeScript on Ubuntu24.04/Node24.19.0 with the frozen pnpm lockfile. No provider keys, deployment token, private database or actual student record is configured. It uses ordinary `pull_request`, not a privileged `pull_request_target` execution. Token permission is read-only and checkout credentials are not persisted.

The official [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node) and [pnpm setup](https://github.com/pnpm/action-setup) documentation and remote tag objects were inspected on2026-10-16. Action commits are pinned in the workflow; application dependencies are unchanged. This avoids silently selecting a different action revision later.

Verified remote checkpoint: commit `9f4a37635bea5fd549d7af90d8b1f0237ea23521`, [GitHub Actions run38829782331](https://github.com/nguyenbedetran-sketch/lumio-ai-regional-2026/actions/runs/38829782331), completed successfully with fresh frozen-lockfile install, regression, build and TypeScript. The [scoped record](reports/ci-9f4a376.json) records this exact commit. This does not certify subsequent working-tree D04 changes; each later commit needs its own run. Local Windows regression/build results remain separate. Browser fixture, provider quality and native-device acceptance are not inferred from this workflow. No lint tool is configured, so no lint PASS is claimed.

Fresh checkout note: the production build generates Next type references before the explicit TypeScript step. Do not treat a developer's cached `.next-dev` directory as a required checked-in artifact.

The subsequent D04 checkpoint `33a79f888385b9f7a733314cb4e27472cf64c4d1` also passed [run38853259163](https://github.com/nguyenbedetran-sketch/lumio-ai-regional-2026/actions/runs/38853259163). See [the exact-commit record](reports/ci-33a79f8.json). Schema17/F02a1 work follows that commit and requires another remote run; successful prior CI is not a deployment or a blanket certification of later edits.
