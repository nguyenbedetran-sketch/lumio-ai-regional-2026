# Admin theme acceptance

The existing Admin React flows now use the shared semantic `--lm-*` palette through local `--ad-*` aliases. Light, dark and system preferences apply to the console, native controls, teacher review, access dialogs, provider usage and job health. No account decision, API authorization or publication workflow was changed by this CSS phase.

`node scripts/test-v9-admin-theme.cjs` passed **31 existing workflow cases** and **12 theme/integration cases**, with **64 computed-style observations** across 320, 390, 768 and 1440 px. The test rendered the actual current components with explicitly synthetic identities, timestamps, chart totals and HTTP responses. It called no public server, OAuth or AI provider. Three shared SSR checks are listed separately; these are not a comprehensive accessibility audit or physical-device results.

- 4,328 text samples: minimum 4.889:1; 284 meaningful control-border samples: minimum 3.030:1. Small text uses a 4.5:1 threshold; large text and meaningful controls use 3:1.
- No page-wide horizontal overflow remained in the measured states; wide tables preserve their own scrolling. The baseline at 320/390 px exposed a pre-existing absolutely positioned screen-reader label outside its table. A relative containing block on `.ad-teachers .ad-table-scroll` keeps that label accessible within the existing scroller. The failing baseline is retained in `admin-before-table-containment-report.json` and the passing comparison in `admin-theme-report.json`.
- Teacher review confirms the declared identity and requires a note before mutation. Opening confirmations and changing themes produce no mutations. Fixture chart days sum to the displayed request total.
- Root visual review covered light/dark desktop overview, dark mobile teacher review and light mobile account confirmation. Screenshots retain their synthetic-test banner. Focus outlines in captures come from keyboard navigation.
- Admin CSS SHA-256: `190b3b1333eb23c64baf85d17af33befec2e3dfe2dd4dbb108a113da2529c9a6`.

Reports: `admin-workflow-report.json`, `admin-theme-report.json`. These results do not prove real teachers were approved, live student privacy was audited, every UI state was exercised or the public deployment already includes this phase.
