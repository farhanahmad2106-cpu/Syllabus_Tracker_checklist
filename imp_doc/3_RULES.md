# 3_RULES.md
# Engineering Constitution — Hierarchical Syllabus Checklist & Progress Tracker

**Document Type:** Authoritative Engineering Rules  
**Authority:** Domain, Data Integrity, Mathematical, AI Extraction, Security, UI/UX and Engineering Governance  
**Project:** Hierarchical Syllabus Checklist & Progress Tracker  
**Repository:** https://github.com/farhanahmad2106-cpu/Syllabus_Tracker_checklist  
**Status:** Normative Engineering Specification  
**Applies To:** Backend, frontend, database, extraction pipeline, local runtime, AI providers, future PWA/mobile clients and all AI coding agents.

---

## 1. PURPOSE, SCOPE AND AUTHORITY

This document defines the non-negotiable engineering rules governing the Hierarchical Syllabus Checklist & Progress Tracker.

It serves as the project's engineering constitution. Every developer, subsystem, automated process and AI coding agent MUST comply with these rules.

### 1.1 Normative terminology

| Keyword | Meaning |
|---|---|
| MUST / MUST NOT | Absolute requirement or prohibition |
| SHOULD / SHOULD NOT | Strong recommendation requiring documented justification for deviation |
| MAY | Optional implementation choice |
| VERIFIED | Supported by inspected implementation or reproducible evidence |
| UNVERIFIED | Insufficient evidence to establish implementation status |

### 1.2 Architectural baseline

The established architecture is:

- Backend: Python 3.12, FastAPI, Pydantic v2, SQLAlchemy.
- Persistence: SQLite, WAL mode, foreign keys enabled.
- Extraction: Instructor, Ollama and configurable OpenAI-compatible providers.
- Parsing: pypdf, python-docx, LibreOffice and optional Docling.
- Frontend: React 19, TypeScript, Vite, Tailwind CSS v4 and Radix UI.
- Runtime: Windows 11, Python launcher, supervised child processes and authenticated loopback IPC.

These technologies MUST NOT be replaced without explicit authorization.

### 1.3 Evidence and configuration precedence

When implementation and documentation conflict, agents MUST investigate before changing anything.

Use this order:

1. Verified current implementation and database constraints.
2. Explicitly approved architectural decisions.
3. `Master_Context.md`.
4. `README.md`.
5. `3_RULES.md` and `4_PHASES.md`.
6. Explicitly supplied project requirements.
7. Proposed engineering improvements.

A conflict MUST be documented rather than silently resolved.

**Known operational discrepancy:** The repository README reports a 1,000-page PDF limit, while `Master_Context.md` documents a 300-page limit. The latter records the Phase 7 alignment. The currently deployed configuration MUST be inspected before either value is changed. The 300-page value is the intended specification baseline until that verification is performed.

---

# SECTION 1 — DOMAIN & DATA STRUCTURE INVARIANTS

## D-01 — Canonical Five-Tier Academic Hierarchy

The application MUST preserve exactly five academic tiers.

```text
Document Root (Container — not an academic tier)
└── Academic Year (Tier 1)
    └── Semester (Tier 2)
        └── Subject / Course (Tier 3)
            └── Module / Unit (Tier 4)
                └── Subtopic Leaf (Tier 5)
```

### Mandatory requirements

1. Document Root MUST remain a container, not a completion-bearing academic tier.
2. Academic Year MUST be Tier 1.
3. Semester MUST be Tier 2.
4. Subject/Course MUST be Tier 3.
5. Module/Unit MUST be Tier 4.
6. Subtopic MUST be Tier 5.
7. Every node MUST have a valid parent consistent with its tier.
8. The frontend MUST render the canonical hierarchy without flattening or silently skipping tiers.
9. The backend MUST validate structural relationships before persistence.
10. Extraction MUST NOT manufacture missing academic information to satisfy a schema.

A course without an explicitly supported module MUST NOT receive an invented module title.

If a source genuinely omits structural information, the application MUST use an explicitly documented unresolved-structure or review representation. Such a representation MUST NOT be misrepresented as a verified academic module or Tier-5 topic.

### Structural invariant

For every academic node `n`:

```text
tier(n) ∈ {1, 2, 3, 4, 5}

tier(child) = tier(parent) + 1
```

The root is excluded from the academic tier calculation.

Cycles, orphan nodes, duplicate parent relationships and invalid cross-tier references MUST be rejected.

## D-02 — Deterministic Academic Year Inference

When academic-year headings are absent and semester numbering is unambiguous and sequential, the system MUST use:

```text
Year = ceil(Semester / 2)
```

Equivalent integer arithmetic:

```python
academic_year = (semester_number + 1) // 2
```

| Semester | Inferred Academic Year |
|---:|---:|
| 1 | 1 |
| 2 | 1 |
| 3 | 2 |
| 4 | 2 |
| 5 | 3 |
| 6 | 3 |
| 7 | 4 |
| 8 | 4 |

### Precedence

1. Explicit source-defined academic year.
2. Validated deterministic inference.
3. Unresolved academic-year information requiring review.

Explicit source information MUST take precedence over inferred information.

The formula MUST NOT be applied blindly to:

- Ambiguous semester labels.
- Repeated semester numbering.
- Irregular academic programs.
- Non-sequential semester identifiers.
- Academic structures where semester numbers represent something other than chronological semesters.

An inferred value SHOULD retain its inference origin so that it can be distinguished from an explicit source value.

## D-03 — Academic Identity and Stable Node IDs

Every persisted academic node MUST have a stable identifier within its document ownership context.

The system MUST preserve:

- Stable node identifiers.
- Parent-child relationships.
- Document ownership.
- Academic year and semester identity.
- Subject/course identity.
- Module and leaf identity.
- Source provenance.
- Deterministic ordering.
- Relevant content fingerprints.

### Duplicate detection

Duplicate detection SHOULD use a combination of:

- Normalized title.
- Parent identity.
- Academic context.
- Source location.
- Source evidence.
- Content fingerprint.

A title match alone MUST NOT automatically establish academic identity.

### Re-import behavior

Re-importing an unchanged syllabus MUST NOT:

- Duplicate the academic hierarchy.
- Reset completion records.
- Delete notes.
- Erase bookmarks.
- Destroy elective enrollment decisions.
- Change stable identifiers unnecessarily.

Changed source content MUST be handled through an explicit reconciliation policy.

Where an existing node can be matched confidently, its identity and associated student data SHOULD be retained.

Where matching is ambiguous, the application MUST request review rather than silently transferring historical completion to an unrelated topic.

### Content hashing

Content hashes MAY be used for duplicate detection and source-change detection.

A hash MUST NOT be treated as a complete substitute for semantic academic identity.

### Ordering

Academic node ordering MUST be deterministic and source-aware.

The application MUST NOT reorder academic topics alphabetically if doing so destroys the source's meaningful curriculum sequence.

## D-04 — Leaf-Only Completion Persistence

Only Tier-5 leaf identifiers may represent persisted syllabus completion truth.

The canonical persistence relationship is conceptually:

```text
Document
  └── Academic Nodes
        └── Tier-5 Leaves
              └── LeafCompletionRecord
```

Parent completion MUST be derived dynamically.

### Requirements

1. Only valid Tier-5 identifiers may be persisted as completion records.
2. Parent checked states MUST NOT be independently persisted as completion truth.
3. Completion updates MUST validate document ownership and leaf identity.
4. Foreign-key enforcement MUST be enabled.
5. Database mutations MUST use appropriate transactions.
6. Duplicate completion records MUST be prevented by database constraints.
7. Repeated completion operations SHOULD be idempotent.
8. Bulk operations MUST operate on valid eligible descendant leaves.
9. Parent states MUST be recalculated after completion changes.

A parent checkbox is a user-interface representation of its eligible descendants, not an independent completion record.

Historical records MUST remain recoverable during elective enrollment changes.

Permanent document deletion MAY cascade to associated academic records and completion records, but only through an explicit user-authorized deletion operation.

## D-05 — Elective Enrollment and Historical Preservation

Course enrollment and course completion are separate concepts.

The canonical enrollment state is:

```text
is_enrolled = True   → Included in active progress.
is_enrolled = False  → Excluded from active progress.
```

Unenrollment MUST NOT imply deletion.

### Mandatory behavior

- Excluded courses MUST NOT contribute to active progress.
- Excluded courses MUST NOT contribute to active parent tri-state calculations.
- Excluded courses MUST retain their academic structure.
- Excluded courses MUST retain their historical completion records.
- Re-enrollment MUST restore previously recorded completion states.
- Repeated enrollment updates MUST be idempotent.
- Mandatory courses MUST NOT be excluded where the source or domain model identifies them as mandatory.

### Data preservation invariant

```text
Unenroll(course)
    changes active eligibility
    does not delete completion history

Re-enroll(course)
    restores eligibility
    reuses existing completion history
```

The application MUST NOT reset a student's historical work because a course was temporarily excluded from the active semester.

## D-06 — Academic Metadata Separation

Academic classification, scheduling metadata and completion state MUST remain independent.

The system MUST distinguish:

| Field | Purpose | Changes completion weight? |
|---|---|---|
| `is_lab` | Laboratory/practical classification | No |
| `contact_hours` | Declared instructional workload | No |
| `is_enrolled` | Active course eligibility | Determines inclusion |
| Academic year | Curriculum grouping | No |
| Semester | Curriculum grouping | No |
| Subject classification | Course metadata | No |
| Completion record | Student completion truth | Yes, through leaf state |

### Lab classification

Laboratory classification MUST be contextual.

A lab badge MUST NOT imply automatic completion, additional completion weighting or a different leaf hierarchy.

### Contact hours

Contact hours MUST:

- Remain informational metadata.
- Preserve unknown values as unknown.
- Be associated with the appropriate source-defined academic scope.
- Be available to the study-pacing engine where appropriate.
- Never be silently fabricated.

The application MUST distinguish declared instructional hours from actual student study time.

---

# SECTION 2 — MATHEMATICAL & PROGRESS CALCULATION RULES

## M-01 — Uniform Leaf Weighting

Every eligible Tier-5 leaf MUST have equal completion weight.

```text
w(leaf) = 1
```

No weighting adjustments are permitted based on:

- Contact hours.
- Lab classification.
- Subject difficulty.
- Module size.
- Course type.
- AI-generated importance.
- Estimated examination difficulty.

This rule guarantees that progress has one consistent interpretation throughout the application.

## M-02 — Completion Percentage

Define:

```text
C = Number of completed eligible Tier-5 leaves
T = Number of eligible Tier-5 leaves
```

Then:

```text
Progress (%) = (C / T) × 100
```

The eligible leaf set MUST exclude every leaf belonging to an unenrolled course.

### Zero-denominator policy

When `T = 0`:

```text
Progress = 0%
State = EMPTY / NO ELIGIBLE TOPICS
Display = 0 / 0
```

The system MUST NOT display 100% merely because there are no topics.

The UI SHOULD distinguish an empty curriculum from an incomplete curriculum.

### Validity constraints

```text
0 ≤ C ≤ T
0 ≤ Progress ≤ 100
```

Invalid completion counts MUST be rejected or corrected through a documented data-integrity recovery process.

## M-03 — Cascading Tri-State Logic

Parent states MUST be dynamically derived from eligible descendant leaves.

Let:

```text
N = Number of eligible descendant leaves
C = Number of completed eligible descendant leaves
```

The state is:

| Condition | State |
|---|---|
| `N > 0` and `C = N` | CHECKED |
| `C = 0` | UNCHECKED |
| `0 < C < N` | INDETERMINATE |
| `N = 0` | UNCHECKED / EMPTY |

### Empty-parent behavior

A parent without eligible descendants MUST NOT become checked automatically.

An empty parent MUST NOT create phantom completion.

The UI SHOULD expose an empty-state indication where appropriate.

### Excluded descendants

Unenrolled-course leaves MUST be excluded from the calculation.

A parent containing only excluded courses MUST therefore be treated as empty for active progress.

### Parent operations

When a parent is toggled, the backend MUST resolve its eligible descendant leaves and update only those leaves.

The operation MUST be transactional and MUST NOT persist a parent completion record.

## M-04 — Study Pacing and Deadline Mathematics

The deadline engine MUST support Semester-level and Subject-level targets.

It MUST distinguish estimated study requirements from measured student activity.

### Remaining topics

```text
Remaining Topics = Total Eligible Leaves
                   - Completed Eligible Leaves
```

### Remaining contact hours

```text
Remaining Contact Hours =
    Sum of applicable remaining declared contact-hour workload
```

The calculation MUST use an explicitly defined metadata scope.

If contact hours are declared per module, they MUST NOT be summed once per descendant leaf.

If the source does not provide a usable contact-hour value, the engine MUST preserve the value as unknown.

### Remaining study weeks

Let:

```text
D = Target date
N = Current calculation date
W = Remaining weeks
```

The application SHOULD use a documented calendar convention, such as seven-day intervals:

```text
W = max(0, (D - N) / 7)
```

Partial weeks MUST retain sufficient precision for calculations.

### Topics per week

When `W > 0`:

```text
Topics / Week = Remaining Topics / W
```

### Hours per week

When valid remaining contact hours exist and `W > 0`:

```text
Hours / Week = Remaining Contact Hours / W
```

### Edge cases

| Condition | Required behavior |
|---|---|
| No remaining topics | Mark target scope as complete |
| Past target date with remaining topics | OVERDUE |
| Current-day target with remaining topics | DUE TODAY |
| Future target | Calculate remaining workload |
| No valid contact hours | Display unavailable, not zero |
| Zero remaining weeks | Do not divide by zero |
| Negative or invalid workload | Reject invalid calculation |
| Unenrolled course | Exclude from active workload |

A past deadline with unfinished topics MUST NOT generate negative weeks or negative study recommendations.

### Estimates versus actuals

`Topics / Week` and `Hours / Week` are planning recommendations, not guarantees.

Declared contact hours MUST NOT be presented as actual student study time.

## M-05 — Aggregation Consistency

Every progress level MUST use the same eligible Tier-5 leaf weighting.

Supported aggregation levels:

- Module.
- Subject.
- Semester.
- Academic Year.
- Entire document/program.

The aggregate MUST be independent of:

- Tree expansion.
- Tree collapse.
- Current viewport.
- Pagination.
- Frontend component virtualization.
- Display grouping.

### Rounding policy

The backend MUST retain full numerical precision for calculations.

The frontend MAY display percentages rounded to two decimal places.

Rounding MUST occur only at the presentation boundary.

Fractional progress MUST remain consistent with completed/total counts.

A displayed percentage MUST NOT replace the underlying integer completion counts.

---

# SECTION 3 — AI EXTRACTION & SANITIZATION RULES

## AI-01 — Zero-Hallucination Extraction

The extraction engine MUST only produce academic content supported by source evidence.

It MUST NOT invent:

- Academic topics.
- Module titles.
- Subject names.
- Semester names.
- Learning outcomes.
- Contact hours.
- Course classifications.
- Examination requirements.
- Academic-year headings.

Unknown information MUST remain unknown.

Where a model is uncertain, it MUST request review or return a structured unresolved state.

A syntactically valid response is not necessarily a factually valid extraction.

## AI-02 — Source Grounding and Provenance

Every verified academic node MUST retain traceable provenance.

Minimum conceptual fields:

| Field | Requirement |
|---|---|
| `source_document_id` | Identifies the originating document |
| `source_text` | Verbatim supporting excerpt |
| `source_page` | Physical source page, where applicable |
| `source_start_offset` | Original canonical text offset, where supported |
| `source_end_offset` | Original canonical text offset, where supported |
| `source_url` | Original URL for remote sources |
| `extraction_method` | Parser/provider or extraction path |
| `evidence_status` | Verified, needs review or unverified |
| Confidence | Optional calibrated confidence metadata |

### Page numbering

Physical PDF page numbering MUST be distinguished from parser-internal zero-based indexing.

Where the application exposes page numbers to students, the value SHOULD correspond to the physical document page.

### Grounding requirements

1. Every verified Tier-5 leaf MUST have supporting evidence.
2. Source excerpts MUST NOT be fabricated or paraphrased and presented as verbatim.
3. Missing evidence MUST NOT silently become verified.
4. Cross-page content MUST retain valid source references.
5. Provenance MUST survive normalization and sanitization.
6. Provider changes MUST NOT erase evidence.

The repository currently documents `verified`, `needs_review` and `unverified` grounding states. Their semantics MUST remain consistent across backend, frontend and exports.

## AI-03 — Artifact Sanitization

The extraction pipeline MUST distinguish document structure from academic content.

### Artifacts requiring detection

- `[Page 1]`, `[Page 2]`, and similar parser markers.
- Repeated university headers.
- Repeated institutional footers.
- Page numbers.
- Program titles.
- Degree names.
- Table column headings.
- Empty table cells.
- OCR fragments.
- Broken cross-page tables.
- Repeated section titles.
- Parser metadata.
- Duplicate academic entries.
- Unsupported placeholder titles.

### Invalid leaf examples

The following MUST NOT become verified Tier-5 leaves solely because they appear in extracted text:

```text
General Curriculum
Course 2
Unit 2
Module 1
Bachelor of Science in Computer Science & AI
[Page 12]
```

These are context-dependent examples, not universal forbidden phrases.

A legitimate course or module MAY contain a generic-looking word.

Therefore:

1. Sanitization MUST consider parent context.
2. Sanitization MUST consider source evidence.
3. Sanitization MUST consider structural position.
4. Sanitization MUST consider repetition patterns.
5. Sanitization MUST preserve legitimate academic terminology.
6. Ambiguous content MUST enter review instead of being indiscriminately deleted.

### Deterministic processing

The sanitization pipeline SHOULD be deterministic for identical input and configuration.

Normalization MUST preserve mappings between normalized text and original source offsets wherever possible.

## AI-04 — Structured Extraction and Provider Independence

The extraction architecture MUST use validated structured output.

Instructor and Pydantic schemas MUST validate model responses before academic persistence.

Supported providers:

- Local Ollama.
- Configurable cloud OpenAI-compatible endpoints.

Provider switching MUST NOT change:

- Academic hierarchy.
- Domain schemas.
- Source grounding requirements.
- Enrollment semantics.
- Completion persistence.
- Progress mathematics.
- Sanitization rules.

### Failure handling

The extraction engine MUST safely handle:

- Invalid JSON.
- Incomplete output.
- Schema validation errors.
- Provider timeouts.
- Unavailable Ollama services.
- Missing models.
- Rate limits.
- Cloud provider errors.
- Excessive response size.
- Retry exhaustion.

Retries MUST be bounded.

Failed extraction MUST NOT partially corrupt an existing curriculum.

Provider selection MUST remain explicit and configurable.

## AI-05 — Prompt Injection Fencing

All imported content MUST be treated as untrusted data.

This includes:

- PDF text.
- DOCX text.
- OCR output.
- Embedded document instructions.
- HTML.
- University portal pages.
- Scraped content.
- External PDF content.
- User-supplied source excerpts.

Where supported, delimiters SHOULD isolate source text:

```text
<untrusted_syllabus_content>
    Imported academic source content
</untrusted_syllabus_content>
```

These delimiters are defense-in-depth, not a security boundary.

System and developer instructions MUST remain separate from imported content.

Imported documents MUST NOT be allowed to:

- Override system instructions.
- Request credentials or secrets.
- Execute arbitrary code.
- Trigger tools.
- Modify application configuration.
- Read unrelated local files.
- Access the database directly.
- Send information to external endpoints.
- Change security settings.

Extraction must remain a constrained transformation of source material into validated academic data.

---

# SECTION 4 — SECURITY, PRIVACY & SSRF GUARDRAILS

## SEC-01 — SSRF Protection

The portal ingestion engine MUST block destinations that resolve to:

- RFC 1918 private IPv4 ranges.
- IPv4 loopback.
- IPv4 link-local.
- Cloud metadata endpoints, including `169.254.169.254`.
- IPv6 loopback.
- IPv6 unique-local addresses.
- IPv6 link-local addresses.
- Internal service networks.
- Disallowed non-HTTP(S) schemes.

### Validation requirements

The application MUST validate:

1. Input URL syntax.
2. URL scheme.
3. Hostname.
4. DNS results.
5. Every resolved IPv4 address.
6. Every resolved IPv6 address.
7. Redirect destination.
8. Actual connection destination.

Hostname-only filtering is insufficient.

DNS resolution MUST NOT be assumed to produce a public destination merely because the hostname appears legitimate.

## SEC-02 — DNS Rebinding Protection

The scraper MUST defend against DNS rebinding.

A hostname MUST NOT be validated once and trusted indefinitely.

### Required controls

- Connection-time destination validation.
- A/AAAA result validation.
- IPv4-mapped IPv6 normalization.
- Redirect-by-redirect validation.
- DNS result consistency.
- Protection against validation-to-connection races.
- Connection pinning or an equivalent mechanism binding the validated address to the actual outgoing connection.

The documented `SafeAnyIOBackend` architecture SHOULD be preserved where it provides these guarantees.

However, its name or presence MUST NOT be treated as proof of effective protection.

The implementation MUST be inspected to verify that the HTTP client's actual connection path uses validated destinations.

## SEC-03 — Web Scraper Sandboxing

The scraper MUST implement bounded resource consumption.

| Control | Requirement |
|---|---|
| Protocol | HTTP/HTTPS only |
| Redirects | Bounded and revalidated |
| Connection timeout | Explicit |
| Read timeout | Explicit |
| Total request deadline | Explicit |
| Response size | Bounded |
| Download size | Bounded |
| Content types | Allowlisted |
| Embedded PDFs | Independently validated |
| HTML parsing | Non-executable |
| Extraction workload | Bounded |
| Concurrent requests | Controlled |

The scraper MUST NOT execute JavaScript, browser automation scripts or embedded document code merely to extract curriculum content unless a separately approved sandbox architecture is introduced.

Remote servers MUST never receive:

- Local filesystem contents.
- Environment variables.
- API keys.
- Provider credentials.
- Private notes.
- Completion records.
- Unrelated student data.

## SEC-04 — Local Data Privacy

The application MUST remain local-first.

Academic documents, progress records, bookmarks and notes SHOULD remain on the user's machine unless the user explicitly chooses another storage or transmission mode.

### Cloud inference

Cloud inference MUST be explicitly configured.

The system MUST clearly identify:

- Active provider.
- Data sent externally.
- Purpose of transmission.
- Relevant privacy configuration.
- Provider errors and fallback behavior.

The application MUST NOT silently switch from local Ollama to a cloud provider.

Unrelated historical completion data and personal notes MUST NOT be included in extraction requests.

The minimum necessary source text SHOULD be transmitted.

## SEC-05 — Input and File Security

All imported files MUST undergo validation before parsing.

### Required controls

- Extension allowlisting.
- Content/MIME validation.
- File-size enforcement.
- PDF page-count enforcement.
- Extraction character limits.
- Processing deadlines.
- Temporary directory isolation.
- Safe filename handling.
- Path traversal prevention.
- Resource exhaustion protection.
- Malformed document handling.
- Temporary file cleanup.
- Safe error reporting.

### Intended operational limits

| Parameter | Intended value |
|---|---:|
| Maximum upload size | 50 MiB |
| Maximum PDF pages | 300 |
| Maximum extracted text | 1,500,000 characters |
| Extraction timeout | Configured bounded timeout |

The repository's `Master_Context.md` records 300 pages and 1.5 million characters. The current README contains a conflicting 1,000-page value. The actual application configuration MUST be inspected before changing limits.

Limits MUST be enforced server-side even when equivalent frontend validation exists.

## SEC-06 — Process and Network Isolation

The local application MUST:

- Bind backend services only to intended interfaces.
- Prefer loopback for local-only services.
- Authenticate local control IPC.
- Validate IPC requests.
- Avoid treating localhost as authentication.
- Supervise child processes.
- Clean up abandoned extraction jobs.
- Avoid blocking the frontend during extraction.
- Apply bounded concurrency.
- Avoid indiscriminate process termination.
- Protect user-owned files during cleanup.

Windows Job Objects MUST be used consistently with the established launcher architecture where applicable.

Background jobs MUST have bounded lifecycle and recoverable terminal states.

---

# SECTION 5 — UI/UX & CROSS-DEVICE COMPLIANCE

## UI-01 — Responsive Layout

The frontend MUST support the following viewport classes:

| Class | Width |
|---|---:|
| Small mobile | 360px |
| Standard mobile | 390–430px |
| Tablet | 768px |
| Laptop | 1024–1440px |
| Desktop | 1920px |
| Wide desktop | 2560px |

No viewport may introduce unintended:

- Horizontal overflow.
- Clipped controls.
- Overlapping navigation.
- Unreachable actions.
- Truncated essential academic titles.
- Unusable tree controls.

Responsive behavior MUST be tested at intermediate widths, not only the listed reference widths.

## UI-02 — Visual Design Consistency

Preserve the established dark emerald visual identity.

The design MAY draw inspiration from Linear and Notion's information hierarchy but MUST NOT copy their branding.

### Requirements

- Clear academic hierarchy.
- Consistent typography.
- Predictable spacing.
- Reduced repetitive borders.
- Progressive disclosure.
- Contextual metadata.
- Purposeful badges.
- Semantic color usage.
- Consistent interactive states.
- Clear document navigation.
- Polished loading and error states.
- Distinct empty and offline states.

The interface MUST retain all five academic tiers even when visually simplified.

Contact-hour information MUST be displayed only when meaningful.

The phrase `Contact Hours Not Specified` MUST NOT be repeated as a redundant badge on every academic card.

## UI-03 — Accessible Interactions

All interactive components MUST support:

- Semantic HTML.
- Keyboard navigation.
- Visible focus indicators.
- Accessible names and descriptions.
- Screen-reader announcements.
- Sufficient contrast.
- Accessible modal focus management.
- Touch-friendly interaction.
- Reduced-motion preferences.

Tri-state checkboxes MUST communicate their checked, unchecked and indeterminate states programmatically.

Color MUST NOT be the only indication of completion or grounding status.

## UI-04 — Mobile Interaction Model

Desktop action rows MUST adapt to narrow screens.

The following operations MUST remain discoverable:

- Evidence.
- Notes.
- Links.
- Target dates.
- Export and backup.
- Configure electives.
- Delete document.

Use responsive menus, drawers, contextual actions or adaptive toolbars.

Destructive actions MUST require explicit accessible confirmation.

Mobile layouts MUST preserve access to source evidence and academic hierarchy.

## UI-05 — Performance and State Consistency

The frontend MUST avoid:

- Unnecessary recursive tree rerenders.
- Full-document refreshes after individual leaf changes.
- Blocking interactions during extraction.
- Duplicate sidebar records.
- Lost unsaved notes.
- Inconsistent parent progress.
- Divergent frontend and database state.

Long-running work MUST expose meaningful progress.

Cancellation MUST be supported where the underlying operation allows safe cooperative cancellation.

The frontend MUST reconcile server responses without discarding newer user changes.

---

# SECTION 6 — REPOSITORY GOVERNANCE & AI AGENT EXECUTION RULES

## GOV-01 — Technology Stack Preservation

The established technology stack MUST be preserved unless a change is explicitly approved.

Agents MUST NOT independently introduce:

- A competing frontend framework.
- An alternative primary database.
- A second academic hierarchy.
- Unnecessary state-management frameworks.
- Unnecessary mobile-specific frontend rewrites.
- Unapproved extraction providers.
- Unnecessary dependency substitutions.

New dependencies MUST have documented justification.

## GOV-02 — Documentation Consistency

The following documents MUST remain consistent:

- `Master_Context.md`.
- `3_RULES.md`.
- `4_PHASES.md`.
- `README.md`.
- Relevant subsystem documentation.

Responsibilities:

| Document | Authority |
|---|---|
| Master_Context.md | Consolidated project identity and architectural context |
| 3_RULES.md | Inviolable rules and invariants |
| 4_PHASES.md | Historical delivery and future roadmap |
| README.md | User-facing setup and operational documentation |

`3_RULES.md` defines what MUST remain true.

`4_PHASES.md` defines what has been delivered and what remains to be delivered.

## GOV-03 — Safe AI Agent Execution

Every AI coding agent MUST:

1. Inspect existing implementation before proposing changes.
2. Identify affected subsystems.
3. Preserve existing user data.
4. Avoid destructive migrations.
5. Avoid unrequested refactoring.
6. Identify assumptions.
7. Explain architectural consequences.
8. Preserve backward compatibility where required.
9. Report incomplete work honestly.
10. Update relevant documentation after approved architectural changes.

### Testing restriction

Automated tests MUST NOT be executed unless explicitly instructed by the user.

This includes:

- pytest.
- Vitest.
- Jest.
- Playwright.
- Cypress.
- Full CI suites.
- Other automated test runners.

For documentation-only tasks, agents MUST NOT execute terminal commands, install dependencies, modify source code, change databases or run migrations.

A user-authorized verification task MAY use the relevant tools within its explicitly approved scope.

## GOV-04 — Change Traceability and Acceptance

Every implementation milestone MUST document:

| Field | Required information |
|---|---|
| Objective | Problem being solved |
| Scope | Included and excluded work |
| Affected subsystems | Backend, frontend, database, runtime, etc. |
| Dependencies | Required prior capabilities |
| Data integrity | Persistence and migration effects |
| Security | Threats and mitigation |
| Acceptance criteria | Observable success conditions |
| Verification | How compliance is established |
| Rollback | Recovery procedure where applicable |
| Documentation | Files requiring updates |

A feature MUST NOT be declared complete merely because its UI exists.

Completion requires functioning behavior, persistence where applicable, error handling, integration and the relevant verification evidence.

---

## 7. GLOBAL INVARIANT CHECKLIST

Every future implementation MUST preserve the following:

- [ ] Exactly five academic tiers.
- [ ] No fabricated academic structure.
- [ ] Explicit academic-year information takes precedence.
- [ ] Stable node identity.
- [ ] Leaf-only completion persistence.
- [ ] Parent progress dynamically derived.
- [ ] Uniform leaf weighting.
- [ ] Unenrolled courses excluded from active progress.
- [ ] Elective history preserved.
- [ ] Contact hours remain metadata.
- [ ] Lab classification does not affect completion.
- [ ] Every verified leaf has source evidence.
- [ ] Imported content is untrusted.
- [ ] Provider switching preserves extraction semantics.
- [ ] SSRF defenses validate actual connection destinations.
- [ ] Local-first privacy is preserved.
- [ ] Frontend and backend state remain consistent.
- [ ] Mobile and desktop users retain equivalent core functionality.
- [ ] No unapproved architecture replacement.
- [ ] No automated tests without explicit authorization.

## 8. CHANGE CONTROL

Any proposal that changes an invariant MUST include:

1. The existing rule identifier.
2. The reason the existing rule is insufficient.
3. The affected domain and subsystems.
4. Data migration and compatibility implications.
5. Security and privacy implications.
6. A proposed replacement rule.
7. An explicit approval decision.

No AI coding agent may override this constitution merely because a different implementation appears simpler.

**Final authority:** Approved architectural decisions and verified data-integrity constraints take precedence over implementation convenience.

---

**End of `3_RULES.md`**
