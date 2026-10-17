# Teaching files and paid policy: bounded release

17October2026. This extends existing teaching/billing transactions; it does not create another account, classroom, wallet or payment system. Current canonical schema20 contains54 tables and11 immutable guards. File storage was added in19; paid policy in20.

## Files and submission integrity

Teacher draft lessons/assignments accept reference or teacher-only files. Students upload pending files for their assigned work, then the existing submit operation binds the selected IDs to the server's submission and revision in the same transaction. A successful upload alone is not a submitted assignment. Teachers see the submission attachment revisions; older submitted bytes are immutable. Deadline, active account/session, organization, class, enrollment and recipient checks remain server-side.

Original bytes live in dedicated database BLOB chunks, not the web host's temporary disk. Limits are1MiB/file,3 files/target,20MiB/organization,200 objects/organization and60 uploads/actor/day. Chunks are256KiB. PDF, PNG, JPEG, WebP, UTF8 TXT/MD, DOCX and PPTX are accepted only after bounded filename/type/content checks. Office packages have bounded central/local ZIP ranges, selected XML expansion ceilings, exact length and CRC checks. These are structural checks, not malware scanning or proof of Office rendering fidelity. Large audio/video and presentation files need external links or a future object-storage integration.

Pending files expire after24 hours. Expired pending cleanup occurs inside a successful upload transaction; a failed upload rolls the transaction back, including cleanup. There is no promised background cleanup job. Submitted history continues to count against the organization quota. Deleting or expiring an uploaded object does not let an old request UUID recreate it.

Downloads recheck current authorization, require the captured account and use attachment disposition, private/no-store, nosniff, same-origin policy and a sandbox/default-src-none CSP. Next global headers have a final specific file rule to preserve the route's stronger CSP. Public links, inline Office/PDF conversion and large-media uploads are not implemented. UI downloads verify the acknowledged length and checksum before saving. An unknown write result requires readback or reuse of the same intent; it is not a successful submit or permission to generate a new charge/request.

`tests/teaching-files.cjs` covers local and native adapters, quotas, rollback, revocation, immutable history and genuine older-schema snapshot inspection. Its explicit remote mode uses only the approved isolated QA database. `scripts/test-teaching-files-production.cjs` extends compiled teaching HTTP acceptance and optionally holds a private synthetic-session fixture for connected browser testing. No provider tokens or production-session bypass exist in that fixture. Raw reports retain the scope and any failures; compiled/browser acceptance remains a separate release gate.

## Premium and Pro

Free and Plus retain their existing catalog, preview, reservation and credit-rate paths. Paid policy defaults propose Premium129000VNĐ/month,1600 credits and Pro249000VNĐ/month,3500 credits; default year price is10 monthly prices. No merchant, renewal, monthly grant or successful payment is implied. Existing wallet/history data is not rewritten by displaying or changing policy.

The new paid-only administration endpoint uses current canonical admin authorization, captured account, recent authentication, expected revision and an8–300-character audit reason. Pro must include Premium's supported access and limits. Legacy catalog writes for Premium/Pro return409 `PAID_POLICY_REQUIRED`; they cannot bypass revisions, inheritance or caps. Free/Plus and pack catalog paths remain unchanged. Catalog overlays are revalidated on policy reads rather than silently accepting invalid historic values.

Quotes are read-only configured credit units: task base multiplied by mode/source factors in permille (1000 means1×), bounded measured input chunks and integer ceiling. They are not measured provider-token invoices or proof of profitability. Source limits cannot exceed the actual100000-character API boundary; teaching generation retains its lower30000-character boundary. Model aliases come from existing server configuration and can resolve to the same actual model. Immutable reservation snapshots bind policy/revision/model allowlists; unlisted fallback or later environment drift cannot silently increase paid dispatch. Teacher/class rights remain independent of paid status.

Actual provider cost, complete audio duration/file-page pricing, paid automation, priority/concurrency, merchant/webhooks, proration and recurring subscription lifecycle remain unverified or unsupported. Do not turn these on from a UI-only claim. Tests cover canonical policy/CAS, legacy bypass rejection, Free/Plus preservation, holds/refunds/replay and guarded model dispatch; no real payment was executed.

## Operations and recovery

Connect production Turso credentials only to the authorized Render server; never to client code, source archives, screenshots or CI. QA uses a distinct approved database and short-lived key. Key expiry, provider quotas and free-host sleeping require maintenance; this release does not guarantee perpetual uptime.

The user explicitly accepted fresh initialization because a full old Render-server export was unavailable. Preserve the private partial browser/visible-record captures. A recreated lesson is a new record, not a preserved account/submission/grade history. Inspect snapshots before restoring; genuine schemas13–20 are supported without mutating source snapshots. Do not attempt a downgrade by deleting migration records or columns.

Local/remote QA and cloud PITR rehearsals are described separately in `FINAL-RELEASE-CHECKLIST.md` and the report scopes. They do not replace final public sign-in, protected file write/read and controlled service-restart verification.
