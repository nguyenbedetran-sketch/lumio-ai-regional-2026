# Sync browser verification

Run: `node scripts/test-ui.cjs --v3-sync` with the current app served at `http://localhost:3000/`.

Result: **31 checks PASS** in an isolated Microsoft Edge session through `@playwright/cli@0.1.21`, 2026-10-15. Report: [qa-v3-sync-report.json](qa-v3-sync-report.json). The suite exercises the actual rendered `SyncPanel`, the real settings application callback, IndexedDB, localStorage, reloads and browser offline/online events. No runtime source was changed for this verification.

The HTTP/auth fixtures are synthetic and account scoped. A small in-memory snapshot fixture implements CAS/idempotency replies, including a commit followed by a connection reset. All unrelated API writes and external origins are blocked. These checks do not establish production authentication or SQLite correctness; actual isolated HTTP/SQLite handler tests are documented separately in [06-INDEPENDENT-SYNC-REVIEW.md](06-INDEPENDENT-SYNC-REVIEW.md).

| Scenario                          | Observed evidence                                                                                                                                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit opt-in                   | Opening settings, enabling consent, and reloading remembered consent do not fetch or upload a snapshot automatically. The initial sync button is disabled.                                                                          |
| First pairing                     | Only a GET occurs before a choice. Local notes remain unchanged. Choosing the server copy saves both its library and preferences and does not upload it again.                                                                      |
| Concurrent edits                  | The conflicting item is named. Choosing the device version sends that edit once. At 390 × 844, the conflict box and both choice buttons fit the viewport.                                                                           |
| Local application fails after ACK | An actual browser `Storage.prototype.setItem` write is faulted once while the desired learning state differs. UI reports failure, leaves the original applied merge base and pending request intact, and does not claim completion. |
| Recovery after failed application | A reload replays the same pending request ID. Remote-only records, a newer remote record and preferences survive. The cursor is cleared only after local persistence succeeds.                                                      |
| Lost ACK                          | The synthetic server commits then aborts the HTTP reply. Reload replay uses the original operation ID; no second synthetic server write is applied. The changed note survives.                                                      |
| Offline / reconnect               | The actual browser context goes offline. Clicking sync stores a browser outbox without an HTTP request. Returning online resumes it and clears it after application.                                                                |
| Account switch                    | A second synthetic account receives separate consent, cursor and IndexedDB library. Its sync headers and payload contain only its own content; the first account's cursor is unchanged.                                             |

Observed totals: 17 synthetic sync requests, 5 distinct applied fixture writes, 2 idempotent replays, zero unrelated mutations, zero browser runtime/hydration errors. These are fixture counts, not production traffic or credit usage.

Five screenshots were opened and visually reviewed for readable text, complete controls and unclipped phone layout:

- [First pairing](qa-sync-first-pair-desktop.png)
- [Phone conflict choices](qa-sync-conflict-phone.png)
- [Local write failure](qa-sync-local-write-recovery.png)
- [Offline outbox](qa-sync-offline-queue.png)
- [Reconnected completion](qa-sync-reconnected-desktop.png)

The reload after the intentional local storage fault suppresses the app's unsaved-navigation prompt only in this disposable test profile. Playwright CLI otherwise treats native dialogs as a separate command. The test first verifies that the recovery cursor and pending request are present; it does not disable this warning in application code.

Limits: one browser engine, simulated account responses, mocked sync HTTP transport and a 390px viewport rather than a physical phone. No real OAuth, second physical device, deployed backend, provider call, payment or learner-outcome study was tested by this suite. Physical-device/OAuth verification and student/teacher evaluation remain separate work.
