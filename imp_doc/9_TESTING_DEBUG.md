# 9_TESTING_DEBUG.md

> **Document status:** Engineering verification and operations specification  
> **Project:** Hierarchical Syllabus Checklist & Progress Tracker  
> **Evidence policy:** Test inventories and counts supplied in project context are unverified historical claims. No test execution or repository modification is authorized by this document.  
> **Primary priorities:** Academic data integrity, source-grounded extraction, security, recoverability, deterministic verification, and operational observability.

## 1. Testing Philosophy & Execution Policy

### 1.1 Quality objectives

Testing must establish that the application:

- Preserves the five-tier academic hierarchy.
- Persists completion only for Tier-5 leaf nodes.
- Derives parent tri-state and progress correctly.
- Never fabricates academic content or provenance.
- Preserves historical progress when elective enrollment changes.
- Remains useful without internet or an available LLM.
- Handles malformed and hostile documents safely.
- Prevents SSRF, XSS, unsafe Markdown rendering, and unauthorized API access.
- Recovers from interrupted jobs without losing student data.
- Synchronizes offline mutations idempotently and detects conflicts.
- Operates within configured hardware and process-resource limits.

### 1.2 Mandatory test execution policy

**Automated tests must never be executed automatically.** Execution requires explicit user authorization for the requested verification scope.

This applies to:

- Pytest.
- Vitest and React Testing Library.
- TypeScript build/type checks.
- Playwright.
- Security scanners.
- Load/performance tests.
- Integration and end-to-end tests.
- Database migration/restore tests that modify a test database.

When producing or editing documentation, do not execute terminal commands or tests. Test commands in this document are examples for a developer to run only after authorization.

A request to inspect, document, or implement code is not by itself permission to execute tests. Ask for explicit approval before running them.

### 1.3 Test categories

| Category | Purpose | Typical isolation |
|---|---|---|
| Unit | Pure logic and boundary conditions | In-memory fixtures |
| Integration | Multiple components and persistence boundaries | Temporary SQLite / controlled adapters |
| API | Request/response, auth, validation, error mapping | Test client and dependency overrides |
| Component | Rendering and user interactions | Vitest + RTL |
| End-to-end | Complete user workflows | Dedicated test environment |
| Security | Abuse cases and trust boundaries | Isolated fixtures and mock network |
| Performance | Latency, memory, throughput, resource leaks | Named hardware and repeatable dataset |
| Cross-device | Browser, viewport, PWA, native WebView | Emulators and physical devices |
| Regression | Previously observed defects | Permanent minimized fixtures |
| Manual acceptance | Real-world usability and recovery | Controlled operator checklist |

A test inventory listed below is not proof that the test exists. Verify source files before classifying any item as IMPLEMENTED.

### 1.4 Evidence classification

| Status | Meaning |
|---|---|
| IMPLEMENTED | Verified in repository source |
| PARTIALLY IMPLEMENTED | Some behavior exists; known gaps remain |
| PROPOSED | Recommended verification or implementation not verified |
| ASSUMPTION | Supplied project context not independently confirmed |

The supplied project context reports **191+ backend tests** and **53+ frontend tests**. These counts are historical, unverified claims. Do not repeat them as current test totals without a fresh authorized test run and a recorded commit/environment.

---

## 2. Backend Verification Matrix (Pytest)

### 2.1 Supplied backend inventory

The following files are supplied as the expected inventory. Their existence, names, and coverage must be verified read-only before being described as implemented.

| Supplied file | Responsibility | Critical assertions |
|---|---|---|
| `test_models.py` | Pydantic contracts and data integrity | Valid schema, invalid types, bounds, unknown fields policy |
| `test_parser.py` | PDF/DOCX/DOC/TXT parsing | Correct text, page boundaries, malformed input, cleanup |
| `test_chunking.py` | Chunking and hierarchy preservation | Stable ordering, no lost boundaries, source references |
| `test_job_manager.py` | Job lifecycle and resource management | State transitions, cancellation, concurrency caps |
| `test_jobs.py` | Background processing | Queue behavior, retries, timeout, idempotent completion |
| `test_extractor.py` | LLM extraction and prompt-injection resistance | Untrusted instructions ignored, schema-constrained output |
| `test_validation.py` | Extraction validation | Invalid hierarchy/provenance rejected or reviewed |
| `test_progress.py` | Leaf-only progress and tri-state derivation | Parent states derived, contact hours excluded |
| `test_enrollment.py` | Elective selection | Deactivation preserves history; reactivation restores |
| `test_pacing.py` | Study planning/deadlines | Zero values, past dates, correct academic scope |
| `test_notes.py` | Markdown notes | Persistence, ownership, safe rendering boundary |
| `test_resources.py` | Resource bookmarks | URL validation, ownership, duplicate behavior |
| `test_exports.py` | JSON/Markdown/HTML/PDF exports | Hierarchy, Unicode, schema version, no data loss |
| `test_web_scraper.py` | SSRF-hardened scraping | Private IP, redirects, DNS rebinding, timeouts |
| `test_api_scrape.py` | Scraping API | Auth, validation, safe errors, request limits |
| `test_launcher.py` | CLI/process lifecycle | PID ownership, duplicate instance, cleanup |
| `test_api.py` | REST API | Status codes, validation, auth, persistence |

For each file, verify:
- It exists and is collected by the configured test runner.
- It tests behavior rather than only implementation details.
- It includes positive, negative, and boundary cases.
- External services are mocked or replaced by deterministic fixtures.
- Temporary files and databases are isolated.
- Assertions verify data integrity after failures, not only successful responses.

Do not invent individual test function names.

### 2.2 Academic hierarchy invariants

Canonical hierarchy:

```text
Document Root
└── Academic Year (Tier 1)
    └── Semester (Tier 2)
        └── Subject / Course (Tier 3)
            └── Module / Unit (Tier 4)
                └── Subtopic Leaf (Tier 5)
```

Mandatory verification:

1. Every academic node has a valid tier and parent relationship.
2. Only permitted parent-child tier transitions are accepted.
3. No sixth academic tier is introduced accidentally.
4. No subject/module/topic is silently flattened into another level.
5. Parent nodes cannot be persisted as independently completed.
6. A leaf cannot be attached to the wrong semester or subject.
7. Empty or malformed branches are rejected or sent to review.
8. Stable IDs remain stable across export/import where the schema promises identity preservation.
9. Duplicate nodes are detected without merging distinct syllabus topics merely because labels match.
10. Ordering from the source is retained where meaningful.

#### Extraction-quality regression cases

Maintain minimized fixtures for:

- `[Page 2]`, `[Page 3]`, and similar markers.
- Program/department headers.
- Repeated university logos and document headers.
- Split tables across page boundaries.
- Wrapped topic names.
- Multi-column pages.
- Generic labels such as `General Curriculum`, `Course 2`, or `Unit 2`.
- Repeated module headings.
- Scanned PDFs with no text layer.
- Footnotes and reference sections that resemble syllabus topics.

A page marker or program header must never become a Tier-5 leaf. Generic fallback labels must not be accepted as real academic structure without evidence and review.

### 2.3 Source-grounding invariants

Every accepted leaf must have traceable evidence.

Verify:

- PDF page number refers to the original physical/logical page under a documented convention.
- Web provenance stores the canonical source URL and retrieval context as appropriate.
- `source_text` is a faithful excerpt or a clearly identified normalized representation.
- Source excerpts are not silently replaced with LLM paraphrases.
- Missing evidence results in rejection or a review state.
- The source document remains associated with its extraction job.
- A failed extraction does not erase the original upload.
- Imported content is treated as untrusted data, not instructions.

If OCR or layout processing transforms content, preserve enough metadata to trace the extracted item back to its source page/region where the chosen parser supports it.

### 2.4 Progress invariants

Only Tier-5 leaf completion is persisted.

For a parent node with eligible descendant leaves:

- **Checked:** all eligible leaves are complete.
- **Unchecked:** no eligible leaves are complete.
- **Indeterminate:** at least one but not all eligible leaves are complete.

Define empty-branch behavior explicitly. Recommended policy: a parent with zero eligible leaves is not counted as completed and is excluded from percentage denominators; the UI should show an empty/not-applicable state rather than 100%.

Completion percentage:

`completed eligible leaves / total eligible leaves × 100`

Contact hours, credits, module counts, and parent metadata must not affect this calculation.

Test:
- First and last leaf toggles.
- Mixed completion state.
- Nested parent aggregation.
- Empty module/subject.
- Elective excluded from active denominator but retained historically.
- Re-enrollment.
- Duplicate mutation replay.
- Concurrent updates to different leaves.
- A conflict on the same leaf.
- Import/export round trip.

### 2.5 Enrollment invariants

- Deactivation changes enrollment/visibility state, not historical progress records.
- Deactivation does not cascade-delete leaf progress or notes.
- Reactivation restores expected prior progress.
- Replacing one elective with another does not attach old progress to a different course.
- Export includes enough enrollment and identity metadata to restore the intended state.
- Historical records remain distinguishable from currently active courses.

### 2.6 Pacing invariants

- Deadlines are scoped to the correct semester or subject.
- Date/time handling uses a documented timezone policy.
- Past deadlines are represented explicitly.
- Zero contact hours do not cause division by zero.
- Zero remaining weeks do not cause invalid rates.
- Negative/invalid contact hours are rejected or normalized according to a documented schema.
- Week rounding policy is deterministic.
- Changes to deadlines do not alter completion history.
- Planning recommendations do not mark topics complete.

### 2.7 Export/import invariants

Verify all supported formats:

- JSON backup schema version (supplied context identifies schema 2.1; confirm implementation).
- Markdown.
- Notion-compatible Markdown.
- Printable HTML.
- PDF.

Assertions:

- Five-tier hierarchy remains intact.
- Unicode, Indic scripts, and punctuation survive.
- Notes/resources remain attached to the correct leaf.
- Enrollment and historical progress are preserved.
- Unsupported schema versions fail safely.
- Partial import failure does not leave a half-written database.
- Import uses a transaction or staging/commit process.
- HTML/PDF output escapes untrusted content.
- Exports do not include secrets, internal paths, or unrelated user data.

### 2.8 Mocking boundaries

| Dependency | Test approach |
|---|---|
| Ollama HTTP | Stub transport and deterministic model responses |
| OpenAI-compatible endpoint | Mock HTTP; no real credentials |
| University websites | Local fixture server or mocked transport |
| DNS | Inject resolver results; include mixed and changing answers |
| Redirects | Controlled response chain |
| Docling | Stub worker result/failure; separate opt-in integration test |
| LibreOffice | Fake executable/process adapter; separate environment smoke test |
| Filesystem | `tmp_path`, injected storage adapter |
| SQLite | Temporary database per test; explicit WAL settings |
| Background scheduler | Fake clock and controlled task executor |

Tests must not depend on live university portals, actual API credentials, running Ollama, public internet, or private student documents.

### 2.9 SQLite integrity testing

Verify:

- WAL mode is configured as intended.
- Foreign keys are enabled on every connection.
- Transactions commit and roll back correctly.
- Exceptions do not leave open transactions.
- Concurrent reads behave as expected.
- Concurrent writes are serialized or return bounded retryable errors.
- Busy timeout is finite and observable.
- Migrations preserve existing rows and relationships.
- Backup is created using a SQLite-consistent mechanism.
- Restore is validated against schema and referential integrity.
- Interrupted writes do not corrupt completed progress.
- WAL checkpointing does not race with active connections.
- Connection lifecycle is bounded and closed during shutdown.

Never test recovery by deleting the user's real database or WAL files. Use disposable test databases and verified backups.

---

## 3. Frontend Verification Matrix (Vitest, RTL & TypeScript)

### 3.1 Supplied frontend inventory

The project context supplies the following expected test files. Verify their presence and actual coverage before labeling them implemented.

| Supplied file | Responsibility | Required coverage |
|---|---|---|
| `App.test.tsx` | Application integration | Startup, routing, global error/loading states |
| `SyllabusTree.test.tsx` | Five-tier rendering | Parent-child relationships, expansion, leaf-only toggle |
| `FileUpload.test.tsx` | Upload interaction | Type/size validation, progress, errors |
| `UrlImport.test.tsx` | URL ingestion | Invalid URL, loading, SSRF-safe API response handling |
| `ElectiveOnboardingModal.test.tsx` | Elective selection | Selection persistence and historical state |
| `ProgressBar.test.tsx` | Progress display | Derived percentage, empty denominator, accessibility |
| `PacingBadge.test.tsx` | Deadline indicators | Past/upcoming/invalid dates |
| `TopicNotesDrawer.test.tsx` | Notes and auto-save | Debounce, save failure, recovery |
| `TopicResourcesModal.test.tsx` | Resource bookmarking | Add/remove, validation, empty/error states |
| `ExportMenu.test.tsx` | Export interaction | Format selection, loading, error, download behavior |

For each component verify rendering, interactions, accessible names, keyboard behavior, loading/error/empty states, responsive constraints, and regression risks.

### 3.2 Accessibility requirements

Target WCAG 2.2 AA where applicable.

Test:

- All interactive controls reachable by keyboard.
- Visible focus indicators.
- Logical focus order.
- Dialog focus trapping and focus restoration.
- Semantic headings and landmarks.
- Accessible names for icon-only buttons.
- Checkbox checked/indeterminate announcements.
- Tree expansion state exposed to assistive technology.
- Form errors associated with inputs.
- Color contrast.
- Reduced-motion preferences.
- Touch target sizing.
- No hover-only critical action.
- Screen-reader announcements for async save/sync state.

Do not use ARIA roles as a substitute for native semantic elements when native controls are appropriate.

### 3.3 Optimistic UI and rollback

Required scenarios:

1. User toggles a Tier-5 leaf.
2. UI writes local state and outbox entry atomically.
3. Parent state recalculates from leaves.
4. Server acknowledges mutation.
5. Outbox entry becomes acknowledged and is safely retired.
6. Network fails before acknowledgement.
7. Retry uses the same mutation ID.
8. Duplicate request returns the same server outcome.
9. Revision mismatch creates a conflict state.
10. Conflict resolution updates canonical state and recomputes parents.

If local persistence fails, the UI must not claim that the change is saved. If server synchronization fails, retain the pending mutation and clearly distinguish “saved on this device” from “synced”.

### 3.4 Notes auto-save

Test debouncing with fake timers (without requiring real waiting):

- Rapid edits result in bounded writes.
- Component unmount does not silently discard the latest content.
- Offline save persists locally.
- Server failure leaves a recoverable pending mutation.
- Reopening the drawer restores the latest local draft.
- Concurrent server edits trigger a conflict/merge path.
- Markdown preview sanitizes untrusted HTML.
- Empty note deletion is an explicit operation, not an accidental consequence of a failed save.

### 3.5 TypeScript verification

Requirements:

- Strict mode remains enabled.
- API responses are validated at runtime.
- Avoid `any`; use `unknown` at untrusted boundaries and narrow it.
- IndexedDB records include schema versioning.
- Outbox operation/payload pairs are discriminated unions where practical.
- Null/undefined states are handled explicitly.
- Async failures are represented in typed result/error states.
- Parent progress is derived from leaf records, not duplicated in mutable client state.
- Platform-specific APIs are isolated behind adapters.

A TypeScript check/build is a verification step and requires explicit authorization under the execution policy.

---

## 4. Cross-Device & Responsive Viewport Audit

### 4.1 Viewport matrix

| Device category | Width | Height |
|---|---:|---:|
| Small mobile | 360 | 800 |
| Standard mobile | 390 | 844 |
| Tablet portrait | 768 | 1024 |
| Tablet landscape | 1024 | 768 |
| Desktop | 1440 | 900 |
| Large desktop | 2560 | 1440 |

### 4.2 Required Playwright scenarios

- Sidebar collapse and restoration.
- Mobile navigation and focus behavior.
- Five-tier tree expansion/collapse.
- Nested scrolling and scroll containment.
- Action menu wrapping and dismissal.
- Dialog and bottom-sheet overflow.
- Notes drawer sizing and keyboard obstruction.
- Resource modal dimensions.
- Date picker placement near viewport edges.
- Export menu keyboard access.
- Long subject/module/topic names.
- Large leaf counts and deep expansion.
- Unicode and Indic text.
- Landscape orientation.
- Safe-area insets.
- Offline startup and mutation persistence.
- Reconnection and sync status.
- Browser storage quota failure handling.

### 4.3 Acceptance criteria

1. No unintended horizontal page overflow.
2. No clipped primary actions.
3. No inaccessible modal controls.
4. No overlapping navigation.
5. No broken nested scrolling.
6. No inaccessible completion controls.
7. No loss or flattening of academic hierarchy.
8. No critical hover-only interaction.
9. Touch targets satisfy the selected accessibility target.
10. Essential academic operations remain usable on a 360 px viewport.
11. Keyboard opening does not permanently hide save/submit actions.
12. Offline changes are visibly distinguished from server-synchronized changes.

### 4.4 PWA versus Capacitor verification

Test separately:

| Area | PWA browser | Capacitor native WebView |
|---|---|---|
| Install/update | Browser install lifecycle | Native app package lifecycle |
| Storage | Browser quota/eviction | WebView storage plus native facilities |
| Network | Browser fetch/CORS | WebView/native network policies |
| Keyboard | Browser viewport behavior | Native keyboard resize/pan behavior |
| Safe area | CSS environment insets | Native status/navigation bars and insets |
| Background | Browser/Service Worker limits | OS app lifecycle limits |
| Secure storage | Browser limitations | Native secure storage adapter |

Do not treat a successful desktop browser test as evidence that native Android/iOS behavior is correct.

---

## 5. Security Penetration & Adversarial Verification

Security testing must run only in an isolated environment with explicit authorization. Never direct scanners or adversarial fixtures at production student data or third-party university systems without permission.

### 5.1 SSRF protection

Test URL ingestion against:

- `127.0.0.1`, `localhost`, `0.0.0.0`.
- RFC1918 private IPv4 ranges.
- IPv6 loopback and unique-local addresses.
- Link-local addresses.
- Cloud metadata endpoints.
- IPv4-mapped IPv6 addresses.
- Unusual integer/hex/octal IP representations.
- DNS responses containing mixed public/private addresses.
- DNS answers that change between validation and connection.
- Redirects to private addresses.
- Redirect loops.
- Alternate schemes and malformed ports.
- Credentials embedded in URLs.
- Encoded hostnames and trailing-dot variants.

#### Required defense model

1. Parse and canonicalize the URL with a vetted parser.
2. Allow only explicitly supported schemes, normally HTTP/HTTPS.
3. Reject userinfo and malformed authorities.
4. Resolve all destination addresses.
5. Reject the request if any resolved destination is prohibited under the policy.
6. Ensure the actual connection uses the validated destination; do not perform a separate DNS check and then let the HTTP client resolve again without pinning/verification.
7. Revalidate every redirect target.
8. Limit redirect count, response size, decompressed size, and total time.
9. Disable or tightly control proxy environment inheritance.
10. Prevent access to internal services and local files.

DNS rebinding protection must close the validation-to-connection gap. A preflight DNS check alone is insufficient.

### 5.2 Prompt injection and extraction security

Fixtures should contain:

- “Ignore previous instructions” text.
- Requests to reveal hidden prompts or credentials.
- Fake system/developer instructions.
- Fabricated academic courses.
- Malicious hierarchy directives.
- Unsupported metadata.
- HTML/script payloads.
- Malformed JSON and schema-confusing values.
- Content designed to induce hallucinated page references.

Expected behavior:

- Treat document and webpage content as untrusted data.
- Never obey embedded instructions as control instructions.
- Extract only claims supported by source evidence.
- Reject unsupported nodes or mark them for review.
- Do not disclose prompts, environment variables, or secrets.
- Validate all model output independently of model self-reported confidence.

### 5.3 XSS and Markdown security

Test:

- Script tags.
- Event-handler attributes.
- `javascript:` URLs.
- Malicious Markdown links.
- Embedded HTML.
- SVG payloads.
- Stored XSS in topic notes.
- Reflected XSS in imported content.
- Dangerous URL schemes in bookmarked resources.
- Attribute and DOM-clobbering payloads.

Requirements:

- Use a maintained Markdown renderer and explicit HTML policy.
- Disable raw HTML unless a safe use case requires it.
- Sanitize generated HTML with a maintained sanitizer and strict allowlist.
- Validate link protocols.
- Apply safe link attributes when opening external links.
- Avoid unsafe DOM insertion APIs.
- Test the rendered DOM, not only the Markdown source string.

### 5.4 File upload security

Test:

- Oversized documents.
- ZIP bombs and high compression ratios.
- DOCX archive expansion attacks.
- Malformed PDFs.
- Extension/MIME mismatches.
- Double extensions.
- Path traversal names.
- Symlink behavior where applicable.
- Temporary-storage exhaustion.
- Interrupted uploads.
- Extremely long filenames.
- Unicode normalization edge cases.
- Parser timeout and process crash.

Define configurable limits for:

- Maximum upload bytes.
- Maximum extracted text bytes.
- Maximum archive entry count.
- Maximum archive expansion bytes and ratio.
- Maximum page count where applicable.
- Processing wall-clock time.
- Temporary storage per job and globally.
- Concurrent uploads and processing jobs.

Reject before expensive processing when possible. Store uploads under generated internal names, not user-supplied path fragments. Keep source files separate from parser output. Cleanup must be scoped to a job-owned directory.

### 5.5 Authentication and API security

Verify:

- Authentication required on private data routes.
- Authorization is enforced for every document, note, resource, and progress record.
- User/tenant identity is derived from trusted authentication context, not request payload.
- CORS allowlist is explicit.
- Rate limits apply to expensive operations.
- Request sizes and field lengths are bounded.
- Error responses do not leak stack traces, filesystem paths, SQL, tokens, or model prompts.
- Secrets are loaded from protected configuration.
- Tokens are not written to logs or localStorage.
- Local network access is not treated as authentication.
- CSRF protection is considered where cookie-based authentication is used.
- TLS certificate validation is enabled for remote endpoints.

---

## 6. Performance & Resource Regression Testing

### 6.1 Measurement policy

No performance benchmark is currently established by this specification. Establish baselines on named hardware, OS build, Python/Node versions, model artifact, quantization, context length, and dataset revision.

Every benchmark report should include:
- Commit identifier.
- Hardware and OS.
- Runtime/library versions.
- Dataset characteristics (not private source content).
- Warm/cold state.
- Number of repetitions.
- Median and p95 where meaningful.
- Peak memory and GPU memory.
- Failure count.
- Measurement method and known limitations.

### 6.2 Backend metrics

| Metric | Measurement | Baseline/threshold policy |
|---|---|---|
| PDF parser latency | Per-job monotonic timer | Establish by page count and file size |
| DOCX parser latency | Per-job timer | Separate archive expansion and parse time |
| DOC conversion latency | Subprocess wall time | Set timeout from representative fixtures |
| Document concurrency | Active job gauge | Must never exceed configured limit |
| API latency | Request middleware histogram | Define endpoint-specific p50/p95 objectives |
| SQLite query latency | Query timing instrumentation | Flag regressions against stable fixtures |
| Process memory | Private bytes/working set time series | Check peak and post-job return toward baseline |
| Handles/threads | Process telemetry | Detect monotonic growth over repeated jobs |
| Queue depth | Gauge and wait duration | Bounded queue; visible backpressure |
| Temp storage | Per-job and total bytes | Enforce configured quota |

### 6.3 AI metrics

Track:
- Ollama connection time.
- Model load/cold-start duration.
- First-token latency.
- Total generation duration.
- Input/output token counts where available.
- Context size.
- CPU utilization.
- GPU memory and offload.
- Peak system memory.
- Timeout and malformed-output rates.
- Pydantic validation failure rate.
- Human-review/rejection rate.

Compare models only when the source corpus, prompts, output schema, context settings, and hardware are controlled.

### 6.4 Frontend metrics

Track:
- Initial application load.
- Route transition latency.
- Tree render time at defined node counts.
- Expand/collapse responsiveness.
- Search/filter responsiveness.
- Notes save latency.
- IndexedDB read/write latency.
- Outbox processing duration.
- Offline startup success rate.
- Long-task frequency and memory behavior where browser tooling permits.

Do not optimize only for synthetic empty trees. Include realistic large syllabus fixtures.

### 6.5 Mobile metrics

Track:
- First launch and warm launch.
- Offline startup.
- IndexedDB/WebView storage read/write.
- Battery impact of foreground synchronization.
- Pending mutation recovery after process termination.
- Network transition handling.
- Memory pressure and WebView reload recovery.
- Native keyboard/safe-area usability.

### 6.6 Regression threshold policy

Use a staged policy:

1. Capture baseline across repeated runs.
2. Calculate normal variation.
3. Set warning thresholds above expected noise.
4. Set failure thresholds for meaningful regressions.
5. Keep hardware-specific baselines separate.
6. Fail on correctness/data-integrity regressions regardless of speed.
7. Never relax a threshold solely to make a failing build green without recording the reason.

---

## 7. Production Debugging Playbook

### 7.1 Common incident procedure

For every incident:

1. Record timestamp, app version/commit, OS, hardware tier, and correlation/job ID.
2. Determine whether the failure is active or historical.
3. Stop admission of new heavy jobs if resource exhaustion is suspected.
4. Preserve logs and source evidence needed for diagnosis.
5. Identify the owning process and resource boundary.
6. Avoid destructive cleanup until ownership is verified.
7. Protect the database and pending offline mutations.
8. Apply the narrowest reversible recovery.
9. Verify normal operation with a small non-destructive action.
10. Record root cause, contributing factors, and prevention work.

Do not clear all caches, delete databases, or reinstall as the first response.

### 7.2 WinError 1450

**Symptoms**
- File creation/open failure.
- Parser or conversion job fails during heavy processing.
- Intermittent failures after multiple documents.
- Child processes accumulate.
- System becomes unstable under concurrent jobs.

**Likely causes**
- Commit pressure, pool pressure, handle/thread growth, duplicate watchers, excessive Docling jobs, orphaned subprocesses, or disk/resource pressure.

**Diagnostic checks**
1. Record exact failing operation and timestamp.
2. Inspect process private bytes, working set, handle count, thread count.
3. Inspect system commit charge and limit.
4. Inspect paged/nonpaged pool trends.
5. Enumerate application-owned child processes and parent relationships.
6. Check active document queue and Docling concurrency.
7. Check temporary directory size and free disk.
8. Compare metrics before and after a single controlled job.

**Safe recovery**
- Pause new heavy jobs.
- Allow safe jobs to finish or cancel through the job manager.
- Terminate only confirmed application-owned orphan processes.
- Release open file handles and model resources.
- Preserve source documents and database.
- Resume at lower concurrency after resources stabilize.

**Prevention**
- Bounded queue and semaphore.
- No recursive watcher of generated data/venv.
- Process-tree ownership and shutdown.
- Per-job timeout and cleanup.
- Resource telemetry and leak regression tests.

**Escalate** if kernel pool usage continues growing after application processes stop, or if the machine shows system-wide resource instability; investigate drivers/OS rather than assuming application RAM alone.

### 7.3 ERR_CONNECTION_REFUSED

**Symptoms**
- Frontend cannot reach FastAPI.
- Local mobile client cannot connect to desktop backend.
- Requests fail immediately rather than timing out.

**Likely causes**
- Backend not started/crashed.
- Wrong host/port.
- Port conflict.
- Binding only to loopback.
- Firewall rule.
- Network changed or Wi-Fi client isolation.
- Client points to stale endpoint.

**Diagnostic checks**
1. Confirm configured API base URL.
2. Confirm backend process state and startup logs.
3. Identify the process listening on the expected port.
4. Check whether the backend is bound to loopback or the intended interface.
5. Check host firewall and network profile.
6. Confirm phone and laptop network reachability.
7. Check VPN, subnet, and Wi-Fi isolation.

**Safe recovery**
- Restart only the owned backend process.
- Resolve port conflict after identifying the listener.
- Update the configured endpoint through the supported configuration path.
- Apply a narrow firewall rule for the trusted network if required.
- Do not expose an unauthenticated development server publicly.

### 7.4 Ollama cold starts and model failures

**Symptoms**
- First extraction takes longer than subsequent requests.
- Model-not-found or model-load error.
- HTTP timeout or server unavailable.
- GPU allocation failure.
- Malformed/incomplete JSON.

**Likely causes**
- Ollama service unavailable.
- Incorrect model tag.
- Model not pulled.
- Context too large.
- Insufficient RAM/VRAM.
- GPU runtime/driver issue.
- Model unloaded after idle.
- Output token limit too small.

**Diagnostic checks**
1. Verify service connectivity.
2. Verify exact installed model tag.
3. Record model artifact/quantization and runtime version.
4. Inspect available RAM, commit headroom, and VRAM.
5. Record context and parallel request settings.
6. Separate connection, load, and generation timeout.
7. Inspect structured output validation errors without logging sensitive source text.

**Safe recovery**
- Continue parser-only/manual-review workflow.
- Reduce context and parallelism according to the hardware profile.
- Use a smaller configured model if available.
- Use CPU fallback only after resource preflight.
- Retry transient service failures with bounded backoff.
- Do not repeatedly pull large models automatically.
- Do not silently accept malformed output.

### 7.5 LibreOffice DOC conversion timeout

**Symptoms**
- Legacy DOC job remains queued/running.
- Conversion subprocess exceeds timeout.
- Profile lock or stale process.
- Output file absent or incomplete.

**Diagnostic checks**
1. Verify executable path and version.
2. Capture sanitized exit code/stderr.
3. Check job-specific profile directory.
4. Check source readability and destination writability.
5. Inspect the exact process tree created for the job.
6. Determine whether another conversion owns the profile.

**Safe recovery**
- Cancel the job and terminate only its owned process tree.
- Close pipes and handles.
- Remove only the job-specific temporary profile/output after process exit.
- Retry once with a fresh isolated profile if failure is transient.
- Preserve the original DOC file.
- If conversion still fails, report unsupported/corrupt document and request another format.

Never kill every `soffice.exe` process on the machine; another user workflow may own it.

### 7.6 SQLite database is locked

**Symptoms**
- `database is locked` errors.
- Writes stall or fail during background processing.
- WAL file grows or checkpoint is delayed.

**Likely causes**
- Long-running transaction.
- Multiple concurrent writers.
- Connection not closed.
- Missing rollback.
- Excessive background write frequency.
- Busy timeout too short.
- Checkpoint competing with active connections.

**Diagnostic checks**
1. Identify active database connections and transaction duration.
2. Inspect writer concurrency.
3. Verify foreign keys and WAL configuration per connection.
4. Check whether a worker is holding a transaction during network/LLM work.
5. Inspect busy timeout and checkpoint behavior.
6. Correlate lock errors with job IDs.

**Safe recovery**
- Stop admission of new write-heavy jobs.
- Allow short active transactions to complete.
- Roll back failed transactions and close stale owned connections.
- Retry only idempotent transactions with bounded exponential backoff and jitter.
- Preserve the database and WAL files.
- Use a verified backup before any repair procedure.

Never delete the database, `-wal`, or `-shm` files as a routine fix.

### 7.7 Stale CLI lockfiles

**Symptoms**
- Launcher reports another instance despite no active app.
- Startup is blocked by an old lock record.
- Multiple app instances appear.

**Diagnostic checks**
1. Read lock metadata: PID, creation time, process identity token if available.
2. Check whether the PID exists.
3. Verify process executable/path and creation time to protect against PID reuse.
4. Verify the process belongs to this installation/user.
5. Check whether the lock holder is in startup/shutdown transition.

**Safe recovery**
- Remove/replace a lock only after proving the recorded process identity is no longer active.
- Use atomic lock acquisition and OS-level process identity where available.
- If ownership is ambiguous, do not delete the lock; provide a manual recovery path.
- Write lock metadata atomically and clean it during orderly shutdown.

Age alone is never sufficient proof that a lock is stale.

### 7.8 Extraction quality failures

**Symptoms**
- Page markers appear as topics.
- Program headings become leaf nodes.
- Generic fallback labels appear.
- Split tables create duplicate/misplaced units.
- Missing provenance or incorrect course boundaries.

**Diagnostic checks**
1. Preserve the original source and extraction job ID.
2. Identify affected pages/URLs.
3. Compare parser text with page layout.
4. Check chunk boundaries and table continuation metadata.
5. Inspect raw model output and validation errors with sensitive text redacted.
6. Determine whether the issue is parsing, chunking, extraction, or validation.
7. Check whether the model was given complete parent context.

**Safe recovery**
- Mark the affected extraction as requiring review.
- Retain source text and page evidence.
- Re-run only the failed stage when inputs/configuration are controlled.
- Do not auto-create generic courses/modules to fill gaps.
- Do not overwrite a previously reviewed hierarchy without explicit confirmation.
- Allow manual correction while retaining provenance/audit history.

**Prevention**
- Regression fixtures for headers, page markers, split tables, and multi-column layouts.
- Evidence-required schema validation.
- Duplicate detection with context, not label-only merging.
- Confidence/review policy that does not treat model confidence as proof.

### 7.9 Offline synchronization failures

**Symptoms**
- Pending mutations do not clear.
- Duplicate completion changes.
- Local and server progress differ.
- Notes appear stale.
- Sync retries repeat indefinitely.
- IndexedDB quota or schema migration error.

**Diagnostic checks**
1. Inspect outbox count and oldest pending age.
2. Record mutation IDs and entity IDs, not private payload content.
3. Verify authentication state and token expiry.
4. Check server acknowledgement and idempotency record.
5. Compare client base revision with server revision.
6. Inspect IndexedDB schema version and migration outcome.
7. Check Service Worker version and browser storage quota.
8. Determine whether failure occurred before request, during request, or after server commit but before acknowledgement.

**Safe recovery**
- Keep pending mutations.
- Retry with the same mutation ID.
- Refresh authentication through the approved flow.
- For revision conflicts, fetch canonical server state and use the defined conflict UI.
- Export local data when storage is at risk.
- Do not clear IndexedDB or Service Worker storage as a first response.
- Do not create a new mutation ID for a retry of the same logical operation.
- Remove outbox records only after a durable server acknowledgement and local transaction commit.

### 7.10 PWA and Capacitor-specific failures

**PWA symptoms:** stale assets, blank offline shell, update loop, storage eviction.

Recovery:
- Identify active Service Worker and cache version.
- Preserve IndexedDB outbox before any update/reset.
- Activate a known-good application shell.
- Retire only application-owned obsolete caches.
- Re-run foreground sync after update.

**Capacitor symptoms:** WebView cannot reach API, keyboard covers controls, safe-area overlap, native-only crash.

Recovery:
- Record app version, OS version, WebView version, and endpoint configuration.
- Verify TLS and ATS/network policy.
- Check native keyboard resize and status-bar configuration.
- Reproduce on emulator and physical device.
- Keep server-side pending mutations intact during client reinstall/upgrade.

---

## 8. Observability, Logging & Incident Data

### 8.1 Structured log contract

Recommended fields:

```json
{
  "timestamp": "2026-01-01T12:00:00Z",
  "level": "INFO",
  "component": "document_processing",
  "job_id": "opaque-correlation-id",
  "operation": "parse_pdf",
  "duration_ms": 125,
  "error_category": null,
  "resource": {
    "active_jobs": 1,
    "process_memory_bytes": 0
  }
}
```

The values above are illustrative, not measured project telemetry.

Include correlation IDs across frontend request, backend request, background job, parser, and AI extraction. Use opaque IDs; do not use student names or document titles as correlation IDs.

### 8.2 Sensitive-data exclusions

Never log:

- API keys or secrets.
- Authentication tokens/cookies.
- Full private syllabus documents unless explicitly required in a secured diagnostic capture.
- Full notes or student content.
- Unredacted prompts containing private source text.
- Passwords or signing credentials.

Prefer error categories, byte counts, page counts, model identifiers, and sanitized stack traces.

### 8.3 Health and readiness signals

Separate:
- **Liveness:** process/event loop is alive.
- **Readiness:** required local dependencies are available for the operation.
- **Capability status:** optional Ollama, Docling, or cloud provider availability.

An unavailable optional LLM must not make the basic checklist service unhealthy. Health endpoints must not expose secrets, internal paths, or detailed infrastructure metadata to unauthenticated clients.

---

## 9. Backup, Restore & Data-Recovery Verification

### 9.1 Backup policy

- Use a SQLite-consistent backup mechanism.
- Include schema version and backup creation timestamp.
- Preserve hierarchy, leaf progress, enrollment history, notes, and resources.
- Store backups separately from the live database.
- Protect backups according to the sensitivity of student data.
- Define retention and user-controlled export behavior.

### 9.2 Restore verification

A restore test must use an isolated destination database.

1. Create a known test dataset with all five tiers.
2. Include completed and incomplete leaves.
3. Include inactive elective history, notes, and resources.
4. Create a backup using the supported mechanism.
5. Restore into a fresh isolated database.
6. Validate schema version and foreign keys.
7. Compare node identities, hierarchy, leaf progress, and note/resource associations.
8. Recompute parent progress and compare expected results.
9. Record restore duration and any warnings.

Do not overwrite a live database during a routine test.

---

## 10. Release Gates and Verification Records

### 10.1 Proposed release gates

A release should not proceed if any of the following is true:

- Academic hierarchy integrity fails.
- A parent completion state is independently persisted as authoritative.
- Student progress can be lost during elective deactivation.
- Accepted leaves lack source evidence.
- Upload or URL ingestion bypasses security validation.
- Pending offline mutations are silently discarded.
- Duplicate sync requests apply multiple times.
- Secrets appear in logs or client bundles.
- Critical mobile controls are inaccessible.
- Heavy processing can exceed configured concurrency.
- Recovery requires deleting the user's database.

### 10.2 Verification record template

```markdown
## Verification Record

- Date/time:
- Commit:
- Environment:
- OS/device:
- Python / Node / browser versions:
- Test scope authorized:
- Commands/tools executed:
- Tests collected:
- Tests passed:
- Tests failed:
- Tests skipped:
- Security findings:
- Performance measurements:
- Data-integrity checks:
- Known limitations:
- Reviewer:
- Approval:
```

Do not fill this template with invented results. A test count is meaningful only with its commit, environment, collection output, and execution record.

### 10.3 Cross-document consistency

This document verifies the architecture in `8_HARDWARE_MOBILE.md`:

| Document 8 contract | Verification here |
|---|---|
| Hardware tiers and memory guardrails | Resource and performance regression measurements |
| Docling opt-in and bounded concurrency | Job lifecycle, timeout, and resource tests |
| Windows Job Objects | Child-process ownership and shutdown tests |
| Ollama context/model policy | Cold/warm inference and memory tests |
| PWA cache lifecycle | Service Worker update and authenticated-cache tests |
| IndexedDB outbox | Atomic mutation, idempotency, retry, and conflict tests |
| Capacitor connectivity | Native WebView, TLS, keyboard, and safe-area tests |
| Leaf-only progress | Backend and frontend hierarchy/progress invariants |

## 11. Final Operational Rules

1. Protect the original document and all existing academic progress.
2. Do not use destructive database resets as a debugging shortcut.
3. Do not delete WAL/SHM files to clear a lock.
4. Do not clear pending offline mutations to “fix sync”.
5. Do not kill processes without verifying ownership.
6. Do not trust imported document instructions or model output.
7. Do not accept academic leaves without provenance.
8. Do not treat local network access as authentication.
9. Do not report test or benchmark results without execution evidence.
10. Require explicit authorization before running any test, build, scanner, or load test.

**End of specification.**
