# `16_UI_COMPLIANCE_SPEC.md`

> **Repository verification status:** The supplied repository could not be independently inspected through the available public repository search. Consequently, this specification distinguishes user-provided architectural facts from implementation details that require verification. No source files, dependencies, component implementations, or test results are represented as independently verified.

## **Document control**

| Field                  | Value                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| Document               | `16_UI_COMPLIANCE_SPEC.md`                                                |
| Product                | Hierarchical Syllabus Checklist & Progress Tracker                        |
| Repository             | `farhanahmad2106-cpu/Syllabus_Tracker_checklist`                          |
| Branch                 | `main`                                                                    |
| Specification type     | Normative engineering contract                                            |
| Accessibility baseline | WCAG 2.1 Level AA                                                         |
| Responsive target      | 360px–2560px                                                              |
| Status                 | Engineering specification; implementation compliance pending verification |

### **Evidence and status conventions**

- `[VERIFIED]` — explicitly supported by accessible repository documentation.
- `[PARTIALLY_VERIFIED]` — architecture or capability is documented, but implementation details remain uninspected.
- `[PLANNED]` — future acceptance requirement.
- `[RECOMMENDED]` — proposed engineering improvement.
- `[NOT_VERIFIED]` — requires direct source or runtime inspection.

Repository documentation identifies React 19, TypeScript, Vite, Tailwind CSS v4, Radix Checkbox, and Lucide React. It also documents the existing elective onboarding component, evidence-grounded extraction, leaf-only persistence, collapsible lab courses, and SSE upload progress. These are architectural facts, not proof that their current visual and accessibility implementations pass this specification.

The repository README reports historical test results of 102 backend tests and 26 frontend tests. These are not current test results. The alternative counts in the supplied prompt (191 and 53) must not be treated as verified repository baselines.

# **1. Executive Summary & Compliance Objectives**

## **1.1 Purpose**

This specification establishes the mandatory frontend accessibility, responsive design, visual consistency, interaction behavior, and cross-device release requirements for the Hierarchical Syllabus Checklist & Progress Tracker.

It is the authoritative UI compliance contract for:

- Existing frontend components.
- New frontend features.
- Phase 10 UI modernization.
- Phase 11 responsive and PWA modernization.
- Phase 12 study analytics interfaces.
- Future mobile WebView integrations.
- Production release verification.

The objective is not merely to make the application visually attractive. The interface must remain understandable, operable, predictable, and reliable across input methods, assistive technologies, screen sizes, and supported environments.

## **1.2 Scope**

This specification covers:

| Area                | Scope                                         |
| ------------------- | --------------------------------------------- |
| Academic workspace  | Five-tier syllabus hierarchy                  |
| Document management | Upload, selection, rename, delete             |
| Extraction          | Progress, warnings, verification, errors      |
| Academic progress   | Completion, parent states, percentages        |
| Electives           | Enrollment and reconfiguration                |
| Study management    | Notes, resources, deadlines                   |
| Navigation          | Header, sidebar, drawers, responsive controls |
| Export              | Export and restoration interfaces             |
| Feedback            | Loading, empty, success, error, offline       |
| Accessibility       | Keyboard, screen readers, contrast, semantics |
| Responsive UI       | Desktop, tablet, mobile                       |
| Future deployment   | PWA and mobile WebView                        |

## **1.3 Supported Environments**

| Environment        | Required support               |
| ------------------ | ------------------------------ |
| Windows 11 desktop | Primary environment            |
| Desktop Chrome     | Required                       |
| Desktop Edge       | Required                       |
| Desktop Firefox    | Required                       |
| Desktop Safari     | Compatibility target           |
| Android Chrome     | Required mobile-browser target |
| iOS Safari         | Compatibility target           |
| Installed PWA      | Future acceptance requirement  |
| Android WebView    | Future acceptance requirement  |
| Capacitor wrapper  | Future acceptance requirement  |

Browser compatibility must be tested against the actual browser versions selected by the release team.

## **1.4 Normative Language**

| Classification | Meaning                                                                   |
| -------------- | ------------------------------------------------------------------------- |
| MUST           | Mandatory requirement; violation blocks release where designated critical |
| SHOULD         | Strong recommendation; exceptions require documented justification        |
| MAY            | Optional enhancement                                                      |

Exceptions must be recorded with:

1. Requirement ID.
2. Reason for deviation.
3. Affected components and workflows.
4. User impact.
5. Compensating accessibility measure.
6. Risk classification.
7. Reviewer.
8. Expiration or reassessment date.

An exception cannot waive a legal or contractual accessibility obligation.

## **1.5 Executive Compliance Matrix**

| Quality Domain        | Required Standard                | Verification Method | Release Criticality |
| --------------------- | -------------------------------- | ------------------- | ------------------- |
| Accessibility         | WCAG 2.1 AA                      | Automated + manual  | Blocker             |
| Keyboard navigation   | Full workflow support            | Manual E2E          | Blocker             |
| Screen-reader support | Meaningful semantic interaction  | Manual testing      | Blocker             |
| Responsive layout     | 360px–2560px                     | Viewport testing    | Blocker             |
| Theme contrast        | WCAG contrast ratios             | Automated           | Blocker             |
| Focus visibility      | Clearly perceivable focus        | Manual + automated  | Blocker             |
| Touch interaction     | 44 × 44px design target          | Viewport testing    | Blocker             |
| Reduced motion        | OS preference respected          | Manual + automated  | Required            |
| Offline feedback      | Accurate sync state              | Functional testing  | Conditional         |
| Visual hierarchy      | Consistent design tokens         | Design review       | Required            |
| PWA compatibility     | Responsive, accessible operation | Browser testing     | Future gate         |
| WebView compatibility | Mobile interaction support       | Device testing      | Future gate         |

## **1.6 Release Philosophy**

Compliance is continuous rather than a final visual-polish exercise.

Every newly introduced component MUST be reviewed against this document before being considered production-ready.

A component is not compliant merely because:

- It renders correctly.
- It has an `aria-label`.
- It passes an automated accessibility scanner.
- It looks correct in a desktop screenshot.
- It responds to mouse clicks.

Compliance requires functional keyboard operation, correct semantics, appropriate visual feedback, and verified behavior in relevant workflows.

# **2. WCAG 2.1 AA Accessibility Compliance Matrix**

## **2.1 Accessibility Baseline**

The required baseline is WCAG 2.1 Level AA.

Relevant criteria include:

| Criterion | Requirement               |
| --------- | ------------------------- |
| 1.1.1     | Non-text Content          |
| 1.3.1     | Info and Relationships    |
| 1.3.2     | Meaningful Sequence       |
| 1.3.3     | Sensory Characteristics   |
| 1.4.1     | Use of Color              |
| 1.4.3     | Contrast (Minimum)        |
| 1.4.4     | Resize Text               |
| 1.4.10    | Reflow                    |
| 1.4.11    | Non-text Contrast         |
| 1.4.12    | Text Spacing              |
| 2.1.1     | Keyboard                  |
| 2.1.2     | No Keyboard Trap          |
| 2.4.3     | Focus Order               |
| 2.4.4     | Link Purpose              |
| 2.4.6     | Headings and Labels       |
| 2.4.7     | Focus Visible             |
| 2.5.1     | Pointer Gestures          |
| 2.5.2     | Pointer Cancellation      |
| 2.5.3     | Label in Name             |
| 2.5.4     | Motion Actuation          |
| 3.1.1     | Language of Page          |
| 3.2.3     | Consistent Navigation     |
| 3.2.4     | Consistent Identification |
| 3.3.1     | Error Identification      |
| 3.3.2     | Labels or Instructions    |
| 3.3.3     | Error Suggestion          |
| 3.3.4     | Error Prevention          |
| 4.1.2     | Name, Role, Value         |
| 4.1.3     | Status Messages           |

WCAG 2.2 additions MUST be considered separately.

In particular:

- 2.4.11 Focus Not Obscured (Minimum).
- 2.5.8 Target Size (Minimum).

The project adopts additional focus-obscuration and target-size requirements as design requirements, without incorrectly treating them as WCAG 2.1 criteria.

## **2.2 Requirement Register**

| ID       | Requirement                                                         | Priority | Verification             | Pass condition                     |
| -------- | ------------------------------------------------------------------- | -------- | ------------------------ | ---------------------------------- |
| A11Y-001 | All interactive elements MUST have accessible names                 | MUST     | axe + manual             | Zero unnamed controls              |
| A11Y-002 | Semantic HTML MUST represent actual relationships                   | MUST     | DOM inspection           | Correct element roles              |
| A11Y-003 | Completion state MUST be exposed programmatically                   | MUST     | Screen reader            | Correct checked state              |
| A11Y-004 | Hierarchy disclosures MUST expose expansion state                   | MUST     | Keyboard + DOM           | Correct expanded state             |
| A11Y-005 | Progress MUST expose valid values                                   | MUST     | Accessibility inspection | Values match application data      |
| A11Y-006 | Dialogs MUST manage focus correctly                                 | MUST     | Keyboard E2E             | Focus contained and restored       |
| A11Y-007 | Status messages MUST be announced appropriately                     | MUST     | Screen reader            | Relevant announcements             |
| A11Y-008 | Icons MUST have appropriate accessible treatment                    | MUST     | DOM inspection           | Decorative icons hidden            |
| A11Y-009 | Form fields MUST have persistent labels                             | MUST     | axe + manual             | All fields identified              |
| A11Y-010 | Visual status MUST not rely exclusively on color                    | MUST     | Visual inspection        | Text or shape provides distinction |
| A11Y-011 | Dynamic hierarchy updates MUST preserve logical reading order       | MUST     | Screen reader            | Logical sequence                   |
| A11Y-012 | Accessible names MUST remain meaningful at all five hierarchy tiers | MUST     | Manual                   | Correct item identification        |
| A11Y-013 | Focus MUST remain visible and unobscured                            | MUST     | Manual                   | Entire focused control perceivable |
| A11Y-014 | Touch controls MUST meet project target dimensions                  | MUST     | Measurement              | Minimum 44 × 44 CSS px             |

## **2.3 Academic Tree Components**

The academic tree MUST preserve the canonical structure:

```text
Document Root
└── Academic Year
    └── Semester
        └── Subject / Course
            └── Module / Unit
                └── Topic / Subtopic Leaf
```

Each level MUST have a distinguishable semantic and visual role.

The hierarchy MUST NOT be represented through indentation alone.

### **Component compliance matrix**

| Component          | Semantic Element     | ARIA Requirements       | Keyboard Interaction                           | Screen Reader Announcement    | Acceptance Criteria            |
| ------------------ | -------------------- | ----------------------- | ---------------------------------------------- | ----------------------------- | ------------------------------ |
| Academic Year      | Section with heading | Disclosure state        | Enter/Space                                    | Academic year, expanded state | Correct heading and disclosure |
| Semester           | Section with heading | Disclosure state        | Enter/Space                                    | Semester and state            | Correct nesting                |
| Subject            | Section with heading | Disclosure state        | Enter/Space                                    | Subject name and enrollment   | Correct enrolled status        |
| Module             | Section with heading | Disclosure state        | Enter/Space                                    | Module name and progress      | Correct hierarchy              |
| Topic Leaf         | Native checkbox      | Checked state           | Space                                          | Topic name, completion        | Completion works               |
| Parent Checkbox    | Radix Checkbox       | Mixed/checked/unchecked | Space                                          | Branch selection and state    | State matches descendants      |
| Progress Indicator | Progressbar          | Value attributes        | Not independently focusable unless interactive | Completion percentage         | Actual percentage              |
| Lab Badge          | Non-interactive text | No unnecessary role     | None                                           | Lab course                    | Text distinguishes lab         |
| Contact Hours      | Metadata text        | Appropriate grouping    | None                                           | Contact-hour value            | No completion semantics        |
| Grounding Badge    | Status text          | Accessible status label | None                                           | Verification state            | Status accurately described    |

### **A.1 Hierarchy semantics**

Use semantic headings at appropriate levels.

Recommended structure:

```html
<section aria-labelledby="year-heading">
  <h2 id="year-heading">Academic Year 1</h2>

  <section aria-labelledby="semester-heading">
    <h3 id="semester-heading">Semester 1</h3>
  </section>
</section>
```

The exact heading level MUST follow the document's existing heading hierarchy.

Avoid using heading elements exclusively for their default font size.

### **A.2 Tri-state checkboxes**

The application uses `@radix-ui/react-checkbox`.

Radix Checkbox MUST remain the preferred checkbox implementation for parent and leaf states.

Required states:

| State         | Accessible Value |
| ------------- | ---------------- |
| Unchecked     | `false`          |
| Checked       | `true`           |
| Indeterminate | `mixed`          |

Example:

```tsx
<Checkbox.Root
  checked={branchState}
  aria-label={`Select all topics in ${academicItem.title}`}
>
  <Checkbox.Indicator>
    {branchState === 'indeterminate' ? <Minus /> : <Check />}
  </Checkbox.Indicator>
</Checkbox.Root>
```

Implementation requirements:

1. Parent states MUST be derived from eligible descendant leaves.
2. Parent state MUST never be independently persisted.
3. Excluded electives MUST not contribute to enrolled progress.
4. Zero-leaf branches MUST NOT appear completed.
5. Checkbox accessible names MUST identify the relevant academic item.
6. Decorative icons MUST not replace checkbox semantics.
7. A branch bulk action MUST communicate that it affects descendant topics.

**A11Y-015 — Tri-state accuracy**

- Priority: MUST.
- Verification: Component tests and screen-reader testing.
- Pass: Checked, unchecked, and mixed states match the underlying descendant completion data.
- Fail: Any visual or announced state differs from the actual branch state.

### **A.3 Collapsible hierarchy nodes**

Every disclosure control MUST:

- Be a native button.
- Have an accessible name.
- Expose `aria-expanded`.
- Reference its content using `aria-controls` where appropriate.
- Keep its expanded state synchronized with the rendered content.

Example:

```html
<button
  type="button"
  aria-expanded={isExpanded}
  aria-controls={contentId}
  onClick={toggleExpanded}
>
  Toggle Academic Year
</button>
```

When collapsed, hidden descendants MUST NOT remain keyboard-focusable.

A visually collapsed container using opacity or grid height alone is insufficient if its contents remain accessible to keyboard users.

**A11Y-016 — Disclosure correctness**

- Priority: MUST.
- Verification: DOM and keyboard testing.
- Pass: Expanded state, rendered content, and accessibility tree remain synchronized.

### **A.4 Lab courses**

Lab courses MUST:

- Display a visible textual `Lab Course` indicator.
- Start collapsed.
- Preserve their normal descendant completion behavior.
- Remain keyboard-expandable.
- Communicate their status without relying exclusively on color.

Lab status MUST NOT imply a separate completion category.

### **A.5 Contact-hour metadata**

Contact hours are informational metadata.

Rules:

- Render only when a positive meaningful value exists.
- Do not render repeated `Contact Hours Not Specified` badges.
- Do not count contact hours as completed topics.
- Do not use contact-hour values as progress percentages.
- Use a readable textual representation, such as `12 contact hours`.

### **A.6 Extraction verification badges**

Supported statuses:

| Status         | Meaning                                     | Suggested visual treatment |
| -------------- | ------------------------------------------- | -------------------------- |
| `verified`     | Evidence validation succeeded               | Emerald                    |
| `needs_review` | Evidence requires human review              | Amber                      |
| `unverified`   | Verification is unavailable or unsuccessful | Rose or neutral warning    |

Status colors are supplementary.

Every badge MUST provide meaningful text and MUST NOT suggest that unverified content has been approved.

## **2.4 Application Navigation**

| Component         | Semantic Element          | ARIA Requirements                          | Keyboard Interaction  | Screen Reader Announcement | Acceptance Criteria     |
| ----------------- | ------------------------- | ------------------------------------------ | --------------------- | -------------------------- | ----------------------- |
| Desktop Header    | Header                    | Landmark                                   | Tab navigation        | Application header         | Correct landmark        |
| Sidebar           | Navigation                | Accessible label                           | Tab navigation        | Document navigation        | All actions operable    |
| Mobile Drawer     | Navigation/Dialog pattern | Expanded state, modal semantics when modal | Tab, Escape           | Navigation drawer          | Focus managed           |
| Document Selector | Button or native select   | Selected value                             | Enter, arrows         | Selected document          | Correct value announced |
| Search            | Search input              | Label                                      | Typing, Escape        | Search field               | Results announced       |
| Command Palette   | Dialog with search        | Dialog semantics                           | Arrows, Enter, Escape | Command results            | Full keyboard operation |
| Theme Switcher    | Button or switch          | State                                      | Space/Enter           | Current theme              | Correct state           |
| Export Menu       | Button + menu             | Expanded state                             | Arrows/Escape         | Export options             | All formats accessible  |
| Action Button     | Button                    | Accessible name                            | Enter/Space           | Action label               | No mouse dependency     |

### **A.7 Sidebar and document selection**

The sidebar MUST provide a logical navigation structure.

The current document MUST expose its selected state.

A clickable `<div>` MUST NOT substitute for a button or link.

Document entries MUST:

- Support keyboard selection.
- Have visible selected styling.
- Expose selection programmatically.
- Keep delete actions independently operable.
- Avoid nested interactive elements.

### **A.8 Command palette**

The command palette is a planned or otherwise unverified capability until its implementation is inspected.

When implemented, it MUST support:

- `Ctrl + K` on Windows/Linux.
- `Cmd + K` on macOS.
- Escape dismissal.
- Arrow-key result navigation.
- Enter activation.
- Search input labeling.
- Focus restoration.
- Empty search results.
- No-result announcements.

### **A.9 Mobile bottom action bar**

If implemented, it MUST use semantic navigation or appropriately grouped actions.

It MUST NOT duplicate controls in a way that creates confusing screen-reader announcements.

## **2.5 Workflow Modals and Drawers**

### **A.10 Modal compliance matrix**

| Component               | Semantic Element                       | ARIA Requirements                | Keyboard Interaction   | Screen Reader Announcement | Acceptance Criteria         |
| ----------------------- | -------------------------------------- | -------------------------------- | ---------------------- | -------------------------- | --------------------------- |
| ElectiveOnboardingModal | Dialog                                 | `aria-modal`, title, description | Tab, Shift+Tab, Escape | Elective selection dialog  | Selection operable          |
| SourceEvidence          | Dialog                                 | Title, description               | Tab, Escape            | Evidence details           | Evidence accessible         |
| TopicNotesDrawer        | Dialog or labeled complementary region | Correct modal semantics          | Tab, Escape            | Notes editor               | Editing accessible          |
| TopicResourcesModal     | Dialog                                 | Title and description            | Tab, Escape            | Resource manager           | Resource actions accessible |
| ConfirmDelete           | Alert dialog                           | Destructive description          | Tab, Escape            | Confirmation warning       | No accidental dismissal     |
| CommandPalette          | Dialog                                 | Search label, result state       | Arrows, Enter, Escape  | Search and results         | Commands operable           |

### **A.11 Dialog behavior**

Every modal dialog MUST:

1. Have an accessible title.
2. Have a meaningful description where necessary.
3. Receive initial focus.
4. Keep focus within the dialog while modal.
5. Support Tab and Shift+Tab.
6. Support Escape when dismissal is allowed.
7. Restore focus to the triggering control.
8. Prevent interaction with background content.
9. Avoid rendering focusable hidden content.
10. Remain usable at 360px viewport width.

For destructive actions, Escape MUST cancel only when deletion has not entered a non-cancellable operation.

A deletion MUST NOT be triggered merely by clicking outside the confirmation dialog.

### **A.12 Focus strategy**

For ordinary informational dialogs, focus the dialog heading or first appropriate interactive control.

For destructive confirmation dialogs, focusing Cancel by default is acceptable and SHOULD be retained if it provides the safer decision path.

For long dialogs, initial focus may be placed on a static heading with `tabIndex={-1}`.

### **A.13 Focus restoration**

When the dialog closes:

- Return focus to the initiating control if it still exists.
- If it no longer exists, move focus to a logical surviving parent control.
- Never send focus to the document body without an intentional reason.

## **2.6 Data and Feedback Components**

| Component         | Semantic Element | ARIA Requirements                      | Keyboard Interaction | Screen Reader Announcement | Acceptance Criteria         |
| ----------------- | ---------------- | -------------------------------------- | -------------------- | -------------------------- | --------------------------- |
| Global Progress   | Progressbar      | Value attributes and label             | None                 | Overall progress           | Actual percentage           |
| Node Progress     | Progressbar      | Value attributes and label             | None                 | Node completion            | Correct branch              |
| Upload Progress   | Progressbar      | Value attributes and label             | Cancel button        | Current stage and progress | Correct job state           |
| Loading Indicator | Status region    | `aria-live="polite"` where appropriate | None                 | Loading message            | No repeated announcements   |
| Empty State       | Section          | Heading and action                     | Tab                  | Empty-state explanation    | Action available            |
| Error Message     | Alert/status     | Appropriate live region                | Dismiss button       | Error and recovery         | Error identified            |
| Success Message   | Status           | `role="status"`                        | None                 | Completion feedback        | One meaningful announcement |
| Offline Indicator | Status           | Textual state                          | Retry if available   | Connection state           | Accurate status             |
| Grounding Badge   | Textual status   | Accessible name                        | Evidence action      | Verification state         | Correct evidence link       |

### **A.14 Progress indicators**

Use:

```html
<div
  role="progressbar"
  aria-label="Overall curriculum progress"
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={progressPercent}
/>
```

The progress value MUST be calculated from actual eligible descendant leaves.

When progress is genuinely indeterminate:

- Omit `aria-valuenow`.
- Provide a meaningful accessible label.
- Explain the current operation.
- Do not fabricate percentages.

A zero-topic branch may display `0 / 0`, but it MUST NOT imply completion.

### **A.15 Status messages**

Use:

| Situation                           | Recommended semantics    |
| ----------------------------------- | ------------------------ |
| Upload started                      | `role="status"`          |
| Upload stage changed                | Polite live announcement |
| Upload completed                    | `role="status"`          |
| Validation failure                  | `role="alert"`           |
| Network failure requiring attention | `role="alert"`           |
| Background synchronization          | `role="status"`          |
| Search result count                 | Polite live region       |
| Minor visual update                 | No announcement required |

Use `aria-live="assertive"` only when immediate interruption is justified.

Do not announce every SSE percentage change.

Recommended announcement policy:

- Announce initial processing.
- Announce meaningful stage transitions.
- Announce completion.
- Announce failure.
- Announce cancellation.

### **A.16 Requirement acceptance criteria**

| ID       | Requirement                                   | Priority | Verification        | Pass condition                    |
| -------- | --------------------------------------------- | -------- | ------------------- | --------------------------------- |
| A11Y-017 | Dialog focus MUST be contained                | MUST     | Keyboard E2E        | No background focus               |
| A11Y-018 | Dialog focus MUST be restored                 | MUST     | Keyboard E2E        | Logical trigger receives focus    |
| A11Y-019 | Progress MUST be accurately labeled           | MUST     | DOM + screen reader | Correct accessible name and value |
| A11Y-020 | Live announcements MUST avoid excessive noise | MUST     | Screen reader       | Only meaningful events announced  |
| A11Y-021 | Empty states MUST expose a useful next action | SHOULD   | Manual              | Action reachable                  |
| A11Y-022 | Error messages MUST identify recovery options | MUST     | Manual              | Clear recovery guidance           |

# **3. Keyboard-Only Navigation & Focus Management**

## **3.1 Global Keyboard Contract**

The entire application MUST be operable without a mouse.

| Key         | Expected Behavior                                   |
| ----------- | --------------------------------------------------- |
| Tab         | Move to next interactive element                    |
| Shift + Tab | Move to previous interactive element                |
| Enter       | Activate buttons and links                          |
| Space       | Toggle checkboxes and activate appropriate controls |
| Escape      | Close dismissible dialogs, drawers, and palettes    |
| Arrow Keys  | Navigate supported composite controls               |
| Home        | First item in supported composite controls          |
| End         | Last item in supported composite controls           |
| Ctrl + K    | Open command palette on Windows/Linux               |
| Cmd + K     | Open command palette on macOS                       |

Native controls SHOULD retain their expected browser keyboard behavior.

Do not introduce custom keyboard handlers that interfere with native interactions.

## **3.2 Workflow Keyboard Matrix**

| Workflow             | Required keyboard sequence        | Acceptance condition       |
| -------------------- | --------------------------------- | -------------------------- |
| Upload syllabus      | Tab to Import → Enter             | Upload interface opens     |
| Select file          | Tab to file input → Enter         | Native file chooser opens  |
| Enter portal URL     | Tab to labeled URL field → type   | Text entered               |
| Start ingestion      | Tab to submit → Enter             | Job starts                 |
| Cancel ingestion     | Tab to Cancel → Enter             | Job cancellation requested |
| Select electives     | Tab through options → Space       | Selection updates          |
| Confirm electives    | Tab to Confirm → Enter            | Enrollment submitted       |
| Expand year          | Tab to disclosure → Enter         | Year expands               |
| Collapse semester    | Tab to disclosure → Enter         | Semester collapses         |
| Complete topic       | Tab to checkbox → Space           | Leaf toggles               |
| Open notes           | Tab to Notes → Enter              | Notes interface opens      |
| Edit notes           | Tab to editor → type              | Changes saved              |
| Open evidence        | Tab to Evidence → Enter           | Evidence opens             |
| Close evidence       | Escape                            | Evidence closes            |
| Open resources       | Tab to Resources → Enter          | Resource interface opens   |
| Assign deadline      | Tab to date control               | Date can be entered        |
| Export               | Tab to Export → Enter             | Export menu opens          |
| Select export format | Navigate menu → Enter             | Correct format selected    |
| Delete document      | Tab to Delete → Enter             | Confirmation opens         |
| Confirm deletion     | Tab to Confirm → Enter            | Deletion starts            |
| Open command palette | Ctrl/Cmd + K                      | Palette opens              |
| Search command       | Type query                        | Results update             |
| Navigate results     | Arrow keys                        | Selection changes          |
| Activate command     | Enter                             | Command runs               |
| Change theme         | Tab to theme control → Space      | Theme changes              |
| Mobile navigation    | Tab to navigation control → Enter | Navigation opens           |

## **3.3 Academic Tree Navigation**

The hierarchy MUST remain navigable in a predictable order.

Recommended sequence:

1. Academic Year disclosure.
2. Academic Year checkbox.
3. Semester disclosure.
4. Semester checkbox.
5. Subject disclosure.
6. Subject checkbox.
7. Module disclosure.
8. Module checkbox.
9. Topic leaf checkbox.
10. Contextual topic actions.

Avoid creating dozens of redundant focusable elements for decorative information.

The user MUST be able to reach all relevant actions without traversing unrelated hidden controls.

## **3.4 Focus Indicators**

Required visual baseline:

```css
focus-visible:outline-none
focus-visible:ring-2
focus-visible:ring-emerald-400
focus-visible:ring-offset-2
```

The actual offset and ring colors MUST be verified against both themes.

Focus indicators MUST:

- Be visible against the component background.
- Remain visible around small icon buttons.
- Not be clipped by parent containers.
- Not disappear during animations.
- Not rely exclusively on a subtle background color change.

## **3.5 Focus Management Requirements**

| ID      | Requirement                                                        | Priority | Verification | Pass condition                    |
| ------- | ------------------------------------------------------------------ | -------- | ------------ | --------------------------------- |
| KEY-001 | Entire application MUST support keyboard-only operation            | MUST     | Manual E2E   | All critical workflows work       |
| KEY-002 | Focus order MUST follow visual and semantic order                  | MUST     | Manual       | No unexpected jumps               |
| KEY-003 | Focus indicator MUST be visible                                    | MUST     | Manual       | Visible in both themes            |
| KEY-004 | Hidden elements MUST not receive focus                             | MUST     | Keyboard E2E | No collapsed content focus        |
| KEY-005 | Modal focus MUST be contained                                      | MUST     | Keyboard E2E | No background interaction         |
| KEY-006 | Modal focus MUST be restored                                       | MUST     | Keyboard E2E | Correct focus destination         |
| KEY-007 | Command palette shortcuts MUST not break text entry                | SHOULD   | Manual       | No unintended activation          |
| KEY-008 | Hover controls MUST also work through focus                        | MUST     | Manual       | Equivalent keyboard access        |
| KEY-009 | Keyboard operation MUST have no traps                              | MUST     | Manual       | Escape or normal navigation works |
| KEY-010 | No essential functionality may depend exclusively on pointer hover | MUST     | Manual       | All actions accessible            |

# **4. Color Contrast & Design System Compliance**

## **4.1 Design Direction**

The target visual direction combines:

- Linear-inspired interaction clarity.
- Notion-inspired organizational simplicity.
- A refined academic productivity workspace.

This is a design reference, not a requirement to duplicate another product.

The existing dark emerald aesthetic remains the foundation.

The modernization objective is to reduce visual noise and improve information hierarchy.

## **4.2 Dark Theme**

Suggested starting palette:

| Token          | Suggested Value | Purpose                |
| -------------- | --------------- | ---------------------- |
| Background     | `#090D16`       | Main workspace         |
| Surface        | `#111827`       | Cards                  |
| Elevated       | `#1F2937`       | Dialogs and menus      |
| Border         | `#374151`       | Structural separation  |
| Primary text   | `#F9FAFB`       | Main content           |
| Secondary text | `#D1D5DB`       | Supporting information |
| Muted text     | `#9CA3AF`       | Secondary metadata     |
| Accent         | `#10B981`       | Primary actions        |
| Accent strong  | `#059669`       | Interactive emphasis   |

These values are candidate tokens, not proof of contrast compliance.

Every actual foreground/background combination MUST be measured.

## **4.3 Light Theme**

The light theme MUST be a complete theme rather than an inversion filter.

Suggested starting palette:

| Token          | Suggested Value |
| -------------- | --------------- |
| Background     | `#F8FAFC`       |
| Surface        | `#FFFFFF`       |
| Elevated       | `#F1F5F9`       |
| Border         | `#CBD5E1`       |
| Primary text   | `#0F172A`       |
| Secondary text | `#334155`       |
| Muted text     | `#475569`       |
| Accent         | `#047857`       |
| Accent strong  | `#065F46`       |

All values require contrast verification.

The application MUST NOT introduce a light theme that leaves individual dialogs, menus, badges, or inputs using unreadable dark-theme colors.

## **4.4 Contrast Requirements**

| Element                 | Minimum Contrast                                                   |
| ----------------------- | ------------------------------------------------------------------ |
| Normal text             | 4.5:1                                                              |
| Large text              | 3:1                                                                |
| Essential UI components | 3:1                                                                |
| Meaningful icons        | 3:1                                                                |
| Focus indicators        | 3:1 against adjacent colors as project target                      |
| Disabled controls       | WCAG contrast exemption may apply, but MUST remain distinguishable |

Large text means at least 18pt regular or 14pt bold.

Every meaningful state MUST be tested:

- Default.
- Hover.
- Focus.
- Active.
- Selected.
- Error.
- Warning.
- Success.
- Disabled.

A gradient MUST be tested at the lowest-contrast point behind text or meaningful UI content.

Transparency MUST be composited against its actual background before measuring contrast.

## **4.5 Semantic Design Tokens**

The repository currently has CSS custom properties in `frontend/src/index.css`.

The existing token architecture SHOULD be extended rather than replaced with unrelated hardcoded color systems.

Required token categories:

```css
:root {
  --color-bg-base: #090d16;
  --color-bg-surface: #111827;
  --color-bg-elevated: #1f2937;

  --color-text-primary: #f9fafb;
  --color-text-secondary: #d1d5db;
  --color-text-muted: #9ca3af;

  --color-border-default: #374151;
  --color-border-subtle: #4b5563;

  --color-accent-primary: #10b981;
  --color-accent-hover: #059669;

  --color-success: #16a34a;
  --color-warning: #d97706;
  --color-error: #dc2626;
  --color-info: #0284c7;

  --color-focus: #34d399;
}
```

The light theme MUST override semantic tokens rather than requiring every component to contain separate hardcoded color definitions.

Token names SHOULD describe purpose, not a specific visual shade.

## **4.6 Typography**

Recommended typography system:

| Role                    | Target  |
| ----------------------- | ------- |
| Main heading            | 24–32px |
| Section heading         | 18–24px |
| Academic item title     | 14–18px |
| Body text               | 14–16px |
| Secondary labels        | 12–14px |
| Numeric metadata        | 12–14px |
| Evidence text           | 13–15px |
| Code/source identifiers | 12–14px |

Requirements:

1. Body text MUST remain readable at 14px or larger in ordinary interfaces.
2. Essential instructions SHOULD use at least 14px.
3. Small metadata MUST not be the only source of critical information.
4. Text MUST scale without clipping.
5. Academic titles MUST wrap appropriately.
6. Long source excerpts MUST remain readable.
7. Numeric values SHOULD use tabular numerals.
8. `JetBrains Mono` MAY be used for technical metadata.

A system font stack is acceptable and SHOULD remain the default unless a bundled font provides a measurable benefit.

## **4.7 Visual Hierarchy**

The academic workspace MUST distinguish:

1. Document identity.
2. Global progress.
3. Academic year.
4. Semester.
5. Subject.
6. Module.
7. Topic.
8. Supporting metadata.
9. Contextual actions.

Nested borders SHOULD be reduced.

Avoid placing every hierarchy level inside an equally prominent bordered card.

Recommended visual treatment:

- Year: Primary container.
- Semester: Subsection.
- Subject: Distinct heading and enrollment state.
- Module: Compact grouped section.
- Topic: Lightweight checklist row.

The five-tier relationship MUST remain understandable without requiring repeated heavy borders.

## **4.8 Badge Hygiene**

Badge rules:

| Badge         | Requirement                                        |
| ------------- | -------------------------------------------------- |
| Lab           | Visible when `is_lab` is true                      |
| Contact Hours | Only for meaningful positive values                |
| Verified      | Only for verified evidence                         |
| Needs Review  | Requires human review                              |
| Unverified    | Verification unavailable or unsuccessful           |
| Offline       | Display only when connectivity state supports it   |
| Completion    | Use checkbox/progress rather than redundant badges |

Prohibited patterns:

- Repeated `Contact Hours Not Specified`.
- Multiple badges repeating the same information.
- Color-only verification indicators.
- Treating metadata as completion status.
- Showing `verified` without corresponding validation evidence.

## **4.9 Extraction Artifact Presentation**

Extraction noise MUST NOT be presented as verified academic content.

Potential examples:

- `[Page 2]`
- `[Page 3]`
- `General Curriculum`
- `Course 2`
- `Unit 2`
- Repeated degree or institutional headings.

Requirements:

1. Suspicious extracted content MUST be visually distinguishable.
2. Source evidence MUST remain inspectable.
3. Questionable content MUST not receive a verified badge.
4. Fallback titles MUST not be silently presented as authoritative academic names.
5. Users MUST receive meaningful review guidance.
6. The frontend MUST NOT independently delete academic content based solely on superficial string matching.

The UI MUST preserve the underlying data and source evidence unless a separately approved sanitization process changes the extraction result.

## **4.10 Acceptance Criteria**

| ID      | Requirement                                     | Priority | Verification        | Pass condition                            |
| ------- | ----------------------------------------------- | -------- | ------------------- | ----------------------------------------- |
| VIS-001 | Dark theme MUST meet contrast requirements      | MUST     | Contrast scanner    | All essential combinations pass           |
| VIS-002 | Light theme MUST meet contrast requirements     | MUST     | Contrast scanner    | All essential combinations pass           |
| VIS-003 | Focus indicators MUST be visible in both themes | MUST     | Manual              | Focus is unmistakable                     |
| VIS-004 | Status MUST not rely exclusively on color       | MUST     | Manual              | Textual distinction exists                |
| VIS-005 | Design tokens MUST be centralized               | SHOULD   | Source review       | No unnecessary scattered values           |
| VIS-006 | Typography MUST remain readable                 | MUST     | Viewport testing    | No clipped or unreadable text             |
| VIS-007 | Badge duplication MUST be eliminated            | MUST     | Component tests     | No repeated empty metadata                |
| VIS-008 | Extraction warnings MUST be distinguishable     | MUST     | Visual + functional | Review state clear                        |
| VIS-009 | Hierarchy levels MUST remain visually distinct  | MUST     | Design review       | All five levels identifiable              |
| VIS-010 | Decorative nested borders SHOULD be reduced     | SHOULD   | Design review       | Clear hierarchy without excessive framing |

# **5. Responsive Viewport & Mobile WebView Compliance Matrix**

## **5.1 Required Viewports**

| Device Class    | Width  | Expected Layout             |
| --------------- | ------ | --------------------------- |
| Small Mobile    | 360px  | Single-column               |
| Standard Mobile | 390px  | Single-column               |
| Large Mobile    | 430px  | Adaptive single-column      |
| Tablet          | 768px  | Adaptive navigation/content |
| Laptop          | 1024px | Compact desktop             |
| Desktop         | 1440px | Full workspace              |
| Large Desktop   | 1920px | Expanded workspace          |
| Ultra-wide      | 2560px | Controlled content width    |

All widths are CSS viewport widths.

Test both portrait and landscape mobile orientations where applicable.

## **5.2 Responsive Layout Rules**

### **A. Mobile: 360px–430px**

Requirements:

- Single-column content.
- No horizontal document overflow.
- Sidebar becomes a drawer.
- Actions wrap or move into contextual menus.
- Academic titles wrap.
- Progress indicators remain readable.
- Dialogs fit within the viewport.
- Touch targets meet 44 × 44px.
- No fixed-width content exceeding the viewport.

### **B. Tablet: 768px**

Requirements:

- Navigation may use a compact persistent sidebar or drawer.
- Main content receives priority.
- Action groups may wrap.
- Academic tree indentation is reduced.
- Dialogs use available screen width.
- No overlapping controls.

### **C. Desktop: 1024px–1920px**

Requirements:

- Sidebar and workspace remain independently usable.
- Academic tree uses appropriate content width.
- Secondary metadata does not dominate.
- Action groups remain visually grouped.
- Content does not stretch excessively.

### **D. Ultra-wide: 2560px**

Requirements:

- Main content MUST use a controlled maximum width.
- Cards MUST NOT expand indefinitely.
- Long text MUST remain readable.
- Sidebar width MUST remain stable.
- Empty space MUST be distributed intentionally.

## **5.3 Sidebar**

The current `App.tsx` contains a collapsible sidebar with a mobile backdrop.

The responsive modernization MUST preserve its document-navigation functionality.

Required behavior:

| Behavior           | Desktop                         | Mobile                      |
| ------------------ | ------------------------------- | --------------------------- |
| Sidebar            | Persistent or collapsible       | Slide-over drawer           |
| Backdrop           | Not normally required           | Required                    |
| Escape             | Close if modal behavior applies | Close drawer                |
| Focus management   | Normal navigation               | Modal drawer focus behavior |
| Body scroll lock   | Not required                    | When drawer is modal        |
| Safe area          | Standard                        | Required                    |
| Document selection | Keyboard operable               | Touch and keyboard operable |

The mobile drawer MUST:

- Have an accessible trigger.
- Expose expanded state.
- Support Escape.
- Manage focus if implemented as modal.
- Restore focus to the trigger.
- Close on backdrop click when safe.
- Prevent background interaction while modal.
- Remain usable with mobile virtual keyboards.

## **5.4 Academic Tree**

Requirements:

1. No horizontal page overflow.
2. Long academic titles MUST wrap.
3. Nested indentation MUST reduce at narrow widths.
4. Actions MUST remain accessible.
5. Parent-child relationships MUST remain visible.
6. Cards MUST not become excessively compressed.
7. Checkbox labels MUST not overlap actions.
8. Progress information MUST not disappear without an alternative.
9. Expanded hierarchy content MUST remain scrollable.
10. Lab indicators MUST remain visible.

Recommended layout behavior:

```css
.academic-node {
  min-width: 0;
  overflow-wrap: anywhere;
}

.academic-node-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  min-width: 0;
}
```

Use responsive indentation rather than hiding hierarchy levels.

## **5.5 Action Controls**

The following actions require responsive treatment:

| Action              | Desktop                  | Mobile                                |
| ------------------- | ------------------------ | ------------------------------------- |
| Evidence            | Inline action            | Compact accessible action             |
| Notes               | Inline action            | Touch-sized action                    |
| Resources           | Inline action            | Contextual action                     |
| Target Date         | Inline date control      | Responsive date dialog                |
| Export & Backup     | Dropdown                 | Full-width menu or dialog             |
| Configure Electives | Primary/secondary action | Full-width action                     |
| Delete Document     | Destructive action       | Clearly labeled destructive menu item |

Essential actions MUST remain discoverable.

A responsive overflow menu MUST provide an accessible name and keyboard navigation.

Do not hide important functionality behind hover-only interactions.

## **5.6 Bottom Navigation and Action Bar**

A bottom navigation bar is a planned design option, not an existing verified component.

If introduced:

- It MUST have a clear navigation purpose.
- It SHOULD contain only primary destinations.
- It MUST not duplicate every sidebar action.
- Active destination MUST be programmatically identified.
- It MUST respect the safe-area inset.
- It MUST not cover scrollable content.
- It MUST not obscure the mobile keyboard.
- It MUST remain accessible at 360px.

If the application remains a single primary workspace, a compact bottom action bar may be more appropriate than a full bottom navigation system.

The final architecture decision MUST be documented in the implementation plan.

## **5.7 Touch Interaction**

Project target: 44 × 44 CSS px

Every interactive target SHOULD be at least 44 × 44 CSS pixels.

Independent adjacent targets SHOULD have at least 8px spacing where practical.

This is a stricter project design requirement than WCAG 2.2's 24 × 24 CSS pixel minimum in applicable cases.

Do not confuse the project's 44px target with the WCAG 2.1 baseline.

## **5.8 Safe Areas**

Required CSS support:

```css
.app-shell {
  padding-top: env(safe-area-inset-top, 0px);
  padding-right: env(safe-area-inset-right, 0px);
  padding-bottom: env(safe-area-inset-bottom, 0px);
  padding-left: env(safe-area-inset-left, 0px);
}
```

For fixed bottom controls:

```css
.mobile-bottom-bar {
  padding-bottom: max(
    12px,
    env(safe-area-inset-bottom, 0px)
  );
}
```

Requirements:

- No controls behind device notches.
- No buttons obscured by gesture-navigation areas.
- No fixed dialogs positioned outside the usable viewport.
- Safe-area support MUST degrade gracefully in browsers that do not expose these environment variables.

## **5.9 Overflow Prevention**

`overflow-x: hidden` MUST NOT be used as a universal repair.

Investigate:

| Cause                      | Required remediation      |
| -------------------------- | ------------------------- |
| Fixed-width containers     | Use fluid sizing          |
| Long academic names        | Allow wrapping            |
| Excessive indentation      | Responsive indentation    |
| Oversized buttons          | Wrap or compact controls  |
| Wide tables                | Responsive table strategy |
| Flex children overflowing  | Use `min-width: 0`        |
| Grid overflow              | Use flexible grid tracks  |
| Wide dialogs               | Constrain dialog width    |
| Long URLs                  | Allow safe word breaking  |
| Large code/evidence blocks | Internal scrolling        |

The application MUST distinguish intentional internal horizontal scrolling from unintended document-level overflow.

## **5.10 Responsive Acceptance Criteria**

| ID      | Requirement                                 | Priority | Verification    | Pass condition              |
| ------- | ------------------------------------------- | -------- | --------------- | --------------------------- |
| RWD-001 | All required widths MUST render             | MUST     | Playwright      | No layout-breaking overflow |
| RWD-002 | Mobile layout MUST be single-column         | MUST     | Visual testing  | No forced desktop layout    |
| RWD-003 | Academic names MUST wrap                    | MUST     | Browser testing | No clipped names            |
| RWD-004 | All essential actions MUST remain reachable | MUST     | Manual          | No hidden essential action  |
| RWD-005 | Sidebar MUST support mobile drawer behavior | MUST     | E2E             | Opens and closes correctly  |
| RWD-006 | Dialogs MUST fit small screens              | MUST     | Viewport tests  | No inaccessible content     |
| RWD-007 | Ultra-wide content MUST be constrained      | SHOULD   | Visual testing  | Readable content width      |
| RWD-008 | Horizontal overflow MUST be investigated    | MUST     | Automated       | Zero unintended overflow    |
| MOB-001 | Touch targets MUST meet 44px project target | MUST     | Measurement     | All primary controls pass   |
| MOB-002 | Safe-area spacing MUST be respected         | MUST     | Device testing  | No obscured controls        |
| MOB-003 | Orientation changes MUST preserve usability | MUST     | Device testing  | No broken layout            |

# **6. Interactive States & User Feedback Compliance**

## **6.1 General State Model**

Every asynchronous or interactive operation MUST expose an accurate state.

Recommended shared state categories:

```text
idle
loading
success
error
cancelled
offline
pending_sync
syncing
conflict
```

Not every component needs every state.

State representation MUST reflect actual application data rather than arbitrary frontend timers.

## **6.2 Loading States**

| Operation                | Required feedback    | Cancellation                       |
| ------------------------ | -------------------- | ---------------------------------- |
| Initial document loading | Loading hierarchy    | Usually unnecessary                |
| File upload              | Upload progress      | Supported                          |
| PDF parsing              | Parsing stage        | Supported through job cancellation |
| DOC/DOCX extraction      | Processing stage     | Supported                          |
| LLM extraction           | Extraction stage     | Supported                          |
| URL ingestion            | URL processing stage | Supported where job supports it    |
| Tree generation          | Result preparation   | Backend-dependent                  |
| Export                   | Exporting format     | If technically supported           |
| Offline synchronization  | Syncing changes      | Depends on operation               |

Loading feedback MUST:

- Identify the operation.
- Avoid indefinite silent loading.
- Remain screen-reader accessible.
- Provide cancellation where supported.
- Provide retry where safe.
- Preserve user-entered information when possible.

## **6.3 SSE Ingestion Progress**

The repository documents:

- Upload job IDs.
- SSE progress streaming.
- Polling fallback.
- Cancellation.
- Processing stages.
- Progress from 0% to 100%.

The frontend MUST render the actual backend job state.

Documented stages include:

| Stage             | Progress Reference |
| ----------------- | ------------------ |
| Queued            | 0%                 |
| Validating        | 5%                 |
| Parsing           | 10–30%             |
| Chunking          | 30–40%             |
| Extracting        | 40–85%             |
| Validating result | 85–95%             |
| Persisting        | 95–99%             |
| Completed         | 100%               |

These values are implementation-reported stage references, not permission for the frontend to invent intermediate percentages.

Requirements:

1. Current stage MUST be displayed.
2. Progress MUST remain within 0–100.
3. Progress MUST never decrease if the backend guarantees monotonic progression.
4. Completion MUST only appear after a completed job state.
5. Failed jobs MUST expose actionable errors.
6. Cancelled jobs MUST be distinguished from failures.
7. Polling fallback MUST preserve user-visible state.
8. Lost SSE connections MUST not falsely imply success.
9. Screen readers MUST receive meaningful stage updates.
10. Excessive percentage announcements MUST be avoided.

## **6.4 Empty States**

| Scenario              | Required explanation               | Suggested next action  |
| --------------------- | ---------------------------------- | ---------------------- |
| No uploaded documents | No syllabus has been imported      | Import syllabus        |
| No syllabus content   | No usable curriculum was extracted | Review source or retry |
| No enrolled electives | No elective courses selected       | Configure electives    |
| No available topics   | No trackable topics exist          | Inspect extraction     |
| No notes              | No notes saved for topic           | Add notes              |
| No resources          | No bookmarks exist                 | Add resource           |
| No deadlines          | No target dates assigned           | Set target date        |
| No search results     | Nothing matches query              | Change search terms    |

Empty states MUST be contextual.

Do not use a generic empty-state illustration without explanatory text.

## **6.5 Error States**

| Error                    | Required response                                        |
| ------------------------ | -------------------------------------------------------- |
| Invalid file             | Explain accepted formats                                 |
| Oversized file           | Display maximum upload size                              |
| Unsupported format       | Identify accepted extensions                             |
| Parsing failure          | Explain whether retry or alternate format is appropriate |
| Extraction failure       | Preserve source and expose retry                         |
| URL security rejection   | Explain that the URL cannot be processed safely          |
| Network failure          | Explain connection issue                                 |
| Backend unavailable      | Identify service unavailability                          |
| Export failure           | Identify format and retry option                         |
| Synchronization conflict | Explain conflicting versions and recovery                |
| Cancellation             | Distinguish cancellation from failure                    |

Error messages MUST NOT expose:

- Internal stack traces.
- Local filesystem secrets.
- API keys.
- Authentication tokens.
- Internal provider credentials.

The UI MUST preserve recoverable user input.

## **6.6 Grounding Review Badges**

Supported states:

| Status         | Required interpretation                  | User-facing explanation        |
| -------------- | ---------------------------------------- | ------------------------------ |
| `verified`     | Evidence validation succeeded            | Evidence matched the source    |
| `needs_review` | Review is required                       | Check the extracted content    |
| `unverified`   | Verification unavailable or unsuccessful | Evidence has not been verified |

Requirements:

- Evidence MUST be available from the relevant item.
- Source page information MUST be preserved.
- Exact source excerpts MUST remain inspectable.
- Status MUST remain consistent with backend data.
- Unverified content MUST not be silently presented as verified.
- Extraction warnings MUST be visible without overwhelming the workspace.

## **6.7 Offline Synchronization**

Offline synchronization is a future acceptance requirement unless its implementation is independently verified.

Required states:

| State    | Meaning                                     |
| -------- | ------------------------------------------- |
| Online   | Connection available                        |
| Offline  | No network connection                       |
| Pending  | Local changes await synchronization         |
| Syncing  | Synchronization is in progress              |
| Synced   | Server confirmed successful synchronization |
| Failed   | Synchronization failed                      |
| Conflict | Server and local data require resolution    |
| Retry    | Synchronization retry is available          |

A `Synced` indicator MUST only appear after authoritative confirmation.

A successful local database write MUST NOT be presented as a successful remote synchronization.

## **6.8 Lab and Contact-Hour Presentation**

Requirements:

- Labs collapsed by default.
- Lab indicators visible.
- Contact hours displayed only when meaningful.
- Contact hours excluded from completion percentages.
- Empty contact-hour badges prohibited.
- Parent progress derived exclusively from eligible leaves.

## **6.9 State Acceptance Criteria**

| ID        | Requirement                                      | Priority | Verification       | Pass condition           |
| --------- | ------------------------------------------------ | -------- | ------------------ | ------------------------ |
| STATE-001 | Every async operation MUST expose its real state | MUST     | Functional         | Correct operation state  |
| STATE-002 | SSE progress MUST reflect backend values         | MUST     | Integration        | No fabricated values     |
| STATE-003 | Upload failure MUST provide recovery guidance    | MUST     | E2E                | Retry or explanation     |
| STATE-004 | Cancellation MUST be distinguishable             | MUST     | E2E                | Correct terminal state   |
| STATE-005 | Empty states MUST provide contextual actions     | SHOULD   | Manual             | Useful next action       |
| STATE-006 | Error messages MUST be understandable            | MUST     | Manual             | Cause and recovery       |
| STATE-007 | Grounding badges MUST match validation status    | MUST     | Integration        | Correct evidence status  |
| STATE-008 | Offline state MUST be accurate                   | MUST     | Network simulation | Correct connection state |
| STATE-009 | Sync success MUST require server confirmation    | MUST     | Integration        | No premature success     |
| STATE-010 | Contact-hour metadata MUST remain informational  | MUST     | Regression         | No effect on progress    |

# **7. Motion & Reduced-Motion Compliance**

## **7.1 Scope**

Motion applies to:

- Sidebar transitions.
- Mobile drawers.
- Modal transitions.
- Expand/collapse interactions.
- Loading indicators.
- Progress bars.
- Hover effects.
- Command palette appearance.
- Notification transitions.

## **7.2 Motion Requirements**

| Motion              | Standard                  |
| ------------------- | ------------------------- |
| Small interaction   | 100–180ms                 |
| Modal transition    | 150–220ms                 |
| Sidebar transition  | 180–250ms                 |
| Expand/collapse     | 150–250ms                 |
| Progress transition | 150–250ms                 |
| Decorative effects  | Avoid excessive animation |

These are design targets, not WCAG-prescribed timing limits.

Avoid:

- Continuous decorative animations.
- Flashing effects.
- Large unexpected movement.
- Unnecessary parallax.
- Repeated attention-grabbing effects.
- Essential information communicated only through movement.

## **7.3 Reduced Motion**

Mandatory CSS behavior:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

This is a starting implementation and MUST be reviewed for any functional animation that requires a different treatment.

Tailwind-compatible examples:

```css
motion-reduce:transition-none
motion-reduce:animate-none
```

Requirements:

1. OS reduced-motion preference MUST be respected.
2. Essential information MUST remain available.
3. Progress MUST not depend on animation.
4. Dialog appearance MUST remain immediate and understandable.
5. Expand/collapse MUST work without animated movement.
6. Loading MUST remain identifiable without decorative spinning.
7. No unnecessary flashing or pulsing.

## **7.4 Motion Acceptance Criteria**

| ID         | Requirement                                        | Priority | Verification      | Pass condition                    |
| ---------- | -------------------------------------------------- | -------- | ----------------- | --------------------------------- |
| MOTION-001 | OS reduced-motion MUST be respected                | MUST     | Browser emulation | Motion reduced                    |
| MOTION-002 | Essential information MUST not depend on animation | MUST     | Manual            | Static state communicates meaning |
| MOTION-003 | Continuous decorative motion SHOULD be avoided     | SHOULD   | Review            | No distracting animation          |
| MOTION-004 | Transitions MUST remain consistent                 | SHOULD   | Visual testing    | Consistent timing                 |
| MOTION-005 | Functional controls MUST remain responsive         | MUST     | E2E               | No disabled interaction           |

# **8. Component-Level UI Compliance Inventory**

## **8.1 Repository Inspection Basis**

The following files were independently accessible in the public repository at the time of preparing this document:

- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/index.css`
- `frontend/src/components/SyllabusTree.tsx`
- `frontend/src/components/ProgressBar.tsx`
- `frontend/src/components/ConfirmDelete.tsx`
- `frontend/src/components/SourceEvidence.tsx`
- `Master_Context.md`
- `README.md`

The frontend package manifest identifies:

- React 19.
- TypeScript.
- Vite.
- Tailwind CSS v4.
- Radix Checkbox.
- Lucide React.
- Vitest.
- React Testing Library.
- Oxlint.

The manifest does not establish that Playwright, axe-core, or a dedicated accessibility-testing plugin is installed.

Documents `14_IMPLEMENTATION_PLAN.md` and `15_TRACKER.md` were not found at the inspected repository root. Their contents and implementation decisions therefore remain unavailable for direct reconciliation.

The supplied screenshots were not available for independent inspection.

## **8.2 Current Component Inventory**

Classification describes the inspected source evidence, not a completed runtime WCAG audit.

| File / Component                                            | Current Responsibility        | Compliance Requirement                      | Required Change                                            | Priority | Verification        |
| ----------------------------------------------------------- | ----------------------------- | ------------------------------------------- | ---------------------------------------------------------- | -------- | ------------------- |
| `frontend/src/App.tsx` — `App`                              | Main workspace and navigation | Semantic layout and accessible interactions | Audit nested controls, landmarks, focus, and mobile drawer | P1       | Keyboard + axe      |
| `frontend/src/components/SyllabusTree.tsx` — `SyllabusTree` | Five-tier recursive tree      | Correct hierarchy and disclosure semantics  | Audit all five tiers and hidden descendants                | P1       | DOM + keyboard      |
| `SyllabusTree.tsx` — `BranchCheckbox`                       | Parent selection              | Correct tri-state behavior                  | Verify accessible state and name                           | P1       | Radix tests         |
| `SyllabusTree.tsx` — `CollapsibleWrapper`                   | Animated hierarchy collapse   | Hidden descendants must be inaccessible     | Ensure collapsed descendants are not focusable             | P1       | Keyboard E2E        |
| `ProgressBar.tsx` — `ProgressBar`                           | Completion progress           | Accessible progressbar                      | Add accessible name and zero-total handling                | P1       | DOM + screen reader |
| `ConfirmDelete.tsx` — `ConfirmDelete`                       | Destructive confirmation      | Complete dialog behavior                    | Add focus containment and restoration verification         | P1       | Keyboard E2E        |
| `SourceEvidence.tsx` — `SourceEvidence`                     | Source-grounding details      | Accessible evidence dialog                  | Add dialog semantics, focus management, Escape             | P1       | Manual + E2E        |
| `frontend/src/index.css`                                    | Global theme and styling      | Semantic theme tokens                       | Add light theme and centralized state tokens               | P2       | Contrast audit      |
| `FileUpload.tsx`                                            | File upload and ingestion     | Accessible upload workflow                  | Verify labels, progress, errors, cancellation              | P1       | E2E                 |
| `ElectiveOnboardingModal.tsx`                               | Elective enrollment           | Accessible dialog and selection             | Verify focus, selection, warnings                          | P1       | E2E                 |
| `TopicNotesDrawer.tsx`                                      | Topic notes                   | Accessible editor                           | Verify labeling, save feedback, focus                      | P1       | E2E                 |
| `TopicResourcesModal.tsx`                                   | Resource management           | Accessible resource controls                | Verify modal and form semantics                            | P1       | E2E                 |
| `ExportMenu.tsx`                                            | Export and restoration        | Accessible menu                             | Verify keyboard navigation and format labels               | P1       | E2E                 |
| `EmptyState.tsx`                                            | Empty workspace feedback      | Contextual empty state                      | Verify headings and action                                 | P2       | Component tests     |
| `ErrorMessage.tsx`                                          | Error notification            | Correct alert semantics                     | Verify dismissal and announcement                          | P1       | Screen reader       |
| `PacingBadge.tsx`                                           | Study pacing metadata         | Meaningful status                           | Verify color-independent meaning                           | P2       | Manual              |
| `useSyllabus.ts`                                            | Frontend state and mutations  | Reliable UI state transitions               | Verify cancellation, errors, state preservation            | P1       | Integration         |
| `frontend/src/lib/api.ts`                                   | HTTP/SSE client               | Accurate backend feedback                   | Verify error and reconnect states                          | P1       | Integration         |
| `frontend/src/types/syllabus.ts`                            | Domain types                  | Correct status representation               | Preserve canonical types                                   | P1       | Typecheck           |

Components whose existence is documented but whose exact current implementation was not inspected are classified as `[NOT_VERIFIED]` for source-level compliance.

## **8.3 Detailed Source Findings**

### **A. **`frontend/src/App.tsx`

[VERIFIED]

Observed:

- Main application header.
- Sidebar state.
- Mobile backdrop.
- Document list.
- Import modal.
- Delete confirmation.
- Elective modal.
- Notes drawer.
- Resource modal.
- Export controls.
- Global progress.

Compliance findings:

1. The document list includes a clickable `div`; it SHOULD be converted to a native interactive element or use a properly structured selection control.
2. The mobile sidebar has an open/close state, but complete modal focus management requires verification.
3. The upload modal uses manually composed overlay elements; complete dialog semantics and focus behavior require implementation review.
4. The header and main content should be verified for complete landmark and heading structure.
5. The sidebar toggle already exposes `aria-expanded` and `aria-controls`.
6. The responsive sidebar MUST be tested at all mandatory viewport widths.
7. Action clusters require responsive wrapping and touch-target review.

### **B. **`frontend/src/components/SyllabusTree.tsx`

[VERIFIED]

Observed:

- Recursive five-tier hierarchy.
- Radix Checkbox.
- Branch state derivation.
- Collapsible content.
- Lab courses initialized collapsed.
- Leaf-only progress calculations.
- Source evidence integration.
- Notes and resource actions.
- Target-date actions.

Compliance findings:

1. Preserve the existing branch-state derivation.
2. Ensure all hierarchy disclosure buttons have correct state.
3. Ensure collapsed descendants cannot receive keyboard focus.
4. Verify every nested action is reachable.
5. Verify all five levels remain readable on mobile.
6. Review `contentId` uniqueness for multiple document trees.
7. Verify long names and action wrapping.
8. Ensure all branch checkboxes communicate their item context.

### **C. **`frontend/src/components/ProgressBar.tsx`

[PARTIALLY_COMPLIANT]

Observed:

- `role="progressbar"`.
- `aria-valuenow`.
- `aria-valuemin`.
- `aria-valuemax`.
- Visible completed/total values.

Required changes:

- Add `aria-label` or `aria-labelledby`.
- Verify the label identifies the associated academic item.
- Handle zero-total branches without implying completion.
- Preserve the actual numeric progress.
- Ensure a hidden visual label does not create an unnamed progressbar.

### **D. **`frontend/src/components/ConfirmDelete.tsx`

[PARTIALLY_COMPLIANT]

Observed:

- `role="dialog"`.
- `aria-modal="true"`.
- `aria-labelledby`.
- `aria-describedby`.
- Initial focus on Cancel.
- Escape handling.

Required changes:

- Implement or verify focus containment.
- Restore focus after dismissal.
- Prevent background interaction.
- Ensure destructive processing cannot be dismissed incorrectly.
- Consider `role="alertdialog"` where the interaction requires an immediate destructive decision.
- Verify accessible naming of both actions.
- Test small-screen behavior.

### **E. **`frontend/src/components/SourceEvidence.tsx`

[PARTIALLY_COMPLIANT]

Observed:

- Evidence trigger.
- Verbatim source snippet.
- Page information.
- Grounding status.
- Modal-style overlay.
- Close actions.

Required changes:

- Add dialog semantics.
- Associate title and description.
- Add focus containment.
- Add Escape dismissal.
- Restore focus.
- Prevent background interaction.
- Make the evidence snippet independently readable.
- Preserve long evidence content through accessible scrolling.

### **F. **`frontend/src/index.css`

[PARTIALLY_COMPLIANT]

Observed:

- Tailwind CSS import.
- Dark-theme CSS variables.
- System font stack.
- Global scrollbar styling.

Required changes:

- Add semantic light-theme tokens.
- Centralize state colors.
- Add verified focus-ring tokens.
- Add reduced-motion behavior.
- Verify text and scrollbar contrast.
- Avoid global styles that suppress focus visibility.

## **8.4 Findings Classification**

Use these labels in future audits:

| Classification          | Definition                                                  |
| ----------------------- | ----------------------------------------------------------- |
| `[COMPLIANT]`           | Verified against all relevant criteria                      |
| `[NON_COMPLIANT]`       | Verified failure                                            |
| `[PARTIALLY_COMPLIANT]` | Some requirements implemented, others missing or unverified |
| `[NOT_IMPLEMENTED]`     | Required capability does not exist                          |
| `[NOT_VERIFIED]`        | Insufficient source or runtime evidence                     |

Do not mark a component `[COMPLIANT]` solely because it contains ARIA attributes.

## **8.5 Architectural Boundaries**

The following must remain unchanged unless separately approved:

- Canonical academic hierarchy.
- Leaf-only completion persistence.
- Dynamic parent progress calculation.
- Elective history preservation.
- SQLite schema and data.
- Existing REST API contracts.
- Source evidence structure.
- Export data formats.
- Existing upload job lifecycle.

Frontend modernization MUST NOT introduce duplicate sources of truth for progress.

## **8.6 Roadmap Compatibility**

| Phase    | UI compliance responsibility                              | Status in this document         |
| -------- | --------------------------------------------------------- | ------------------------------- |
| Phase 10 | Extraction artifact presentation and commercial UI polish | Acceptance requirements defined |
| Phase 11 | Responsive UI, PWA, offline synchronization               | Acceptance requirements defined |
| Phase 12 | Study analytics and spaced-repetition interfaces          | Future acceptance requirements  |

The actual implementation status of these phases MUST be synchronized with Document 15 when it becomes available.

# **9. Automated Testing & Quality Assurance Strategy**

## **9.1 Testing Principles**

The test strategy MUST verify both accessibility and existing academic functionality.

UI modernization MUST NOT weaken existing tests.

Existing tests MUST NOT be:

- Deleted.
- Disabled.
- Skipped without justification.
- Rewritten to remove meaningful assertions.
- Modified to accept incorrect application behavior.
- Bypassed through artificial success responses.

## **9.2 Tooling Strategy**

| Tool                  | Purpose                              | Status                               |
| --------------------- | ------------------------------------ | ------------------------------------ |
| Vitest                | Unit/component tests                 | Existing dependency                  |
| React Testing Library | Accessible component testing         | Existing dependency                  |
| jsdom                 | DOM testing                          | Existing dependency                  |
| Oxlint                | Static linting                       | Existing dependency                  |
| Playwright            | Browser E2E and viewport testing     | Recommended; installation unverified |
| axe-core              | Accessibility automation             | Recommended; installation unverified |
| Lighthouse            | Performance and accessibility audits | Recommended                          |
| Browser DevTools      | Responsive and contrast inspection   | Available externally                 |
| NVDA                  | Windows screen-reader testing        | Recommended manual tool              |
| VoiceOver             | Apple accessibility testing          | Recommended manual tool              |
| TalkBack              | Android accessibility testing        | Recommended manual tool              |

Avoid installing multiple tools that provide overlapping functionality without a clear benefit.

## **9.3 Accessibility Test Matrix**

| Test ID | Test                         | Method             | Pass Condition                     |
| ------- | ---------------------------- | ------------------ | ---------------------------------- |
| QA-001  | Missing accessible names     | axe                | Zero critical violations           |
| QA-002  | Invalid ARIA relationships   | axe + DOM          | All references valid               |
| QA-003  | Tri-state checkbox behavior  | Vitest             | All states correct                 |
| QA-004  | Keyboard traps               | Playwright         | No trapped focus                   |
| QA-005  | Focus visibility             | Manual             | Focus visible everywhere           |
| QA-006  | Dialog focus restoration     | Playwright         | Correct trigger restored           |
| QA-007  | Progressbar labeling         | axe + DOM          | Accessible name present            |
| QA-008  | Screen-reader status updates | Manual             | Meaningful announcements           |
| QA-009  | Contrast                     | Contrast analyzer  | Required ratios pass               |
| QA-010  | Text resizing                | Browser testing    | No content loss                    |
| QA-011  | Reflow                       | Responsive testing | No unintended horizontal scrolling |
| QA-012  | Reduced motion               | Browser emulation  | Preference respected               |

## **9.4 Responsive Testing**

Required viewport matrix:

```text
360 × 800
390 × 844
430 × 932
768 × 1024
1024 × 768
1440 × 900
1920 × 1080
2560 × 1440
```

These are reference test dimensions, not exclusive supported dimensions.

For every viewport:

- Check document overflow.
- Check clipped text.
- Check overlapping actions.
- Check navigation.
- Check modal visibility.
- Check focus indicators.
- Check touch targets.
- Check safe-area behavior where applicable.

Suggested Playwright overflow assertion:

```typescript
const overflow = await page.evaluate(() => {
  return document.documentElement.scrollWidth >
    document.documentElement.clientWidth;
});

expect(overflow).toBe(false);
```

This assertion MUST be evaluated against the page's intended layout.

Intentional internal scrolling may be acceptable, but unintended document-level overflow is not.

## **9.5 Functional Regression Matrix**

| Feature             | Regression requirement                            |
| ------------------- | ------------------------------------------------- |
| File upload         | Accepted files still upload                       |
| URL ingestion       | Existing security controls remain effective       |
| PDF parsing         | Existing parser behavior preserved                |
| DOCX parsing        | Existing parser behavior preserved                |
| DOC parsing         | Existing conversion behavior preserved            |
| TXT parsing         | Existing extraction preserved                     |
| Hierarchy rendering | All five tiers remain correct                     |
| Leaf completion     | Only Tier 5 completion persists                   |
| Parent state        | Dynamically calculated                            |
| Parent progress     | Correct descendant percentage                     |
| Elective filtering  | Excluded items do not count                       |
| Historical progress | Unenrollment preserves history                    |
| Re-enrollment       | Historical progress restored                      |
| Notes               | Existing save behavior preserved                  |
| Resources           | Existing bookmarks preserved                      |
| Target dates        | Assignment and clearing preserved                 |
| Contact hours       | Informational only                                |
| Labs                | Collapsed by default                              |
| Evidence            | Original source evidence preserved                |
| Export              | Existing schemas preserved                        |
| Delete              | Existing confirmation and deletion flow preserved |
| Offline sync        | Future synchronization semantics preserved        |

## **9.6 Component Testing Examples**

### **A. Progressbar**

```typescript
expect(
  screen.getByRole('progressbar', {
    name: /overall curriculum progress/i,
  })
).toHaveAttribute('aria-valuenow', '50');
```

The test MUST use the actual component's accessible name and numeric output.

### **B. Disclosure**

```typescript
const toggle = screen.getByRole('button', {
  name: /toggle academic year/i,
});

await user.click(toggle);

expect(toggle).toHaveAttribute('aria-expanded', 'false');
```

### **C. Tri-state Checkbox**

```typescript
expect(checkbox).toHaveAttribute(
  'aria-checked',
  'mixed'
);
```

### **D. Modal**

```typescript
expect(
  screen.getByRole('dialog')
).toBeInTheDocument();
```

Additional tests MUST verify:

- Initial focus.
- Focus containment.
- Escape.
- Focus restoration.
- Background interaction.

## **9.7 Performance Targets**

These are proposed acceptance targets, not measured current results.

| Metric                     | Target                                              |
| -------------------------- | --------------------------------------------------- |
| Initial interactive UI     | p75 within 2.5 seconds on agreed reference hardware |
| Tree checkbox feedback     | Within 100ms                                        |
| Disclosure interaction     | Within 100ms                                        |
| Modal opening              | Within 150ms                                        |
| Command palette appearance | Within 150ms                                        |
| Local search feedback      | Within 150ms for normal datasets                    |
| Layout stability           | CLS ≤ 0.1                                           |
| Unnecessary re-rendering   | No measurable interaction-blocking regression       |

The initial interactive target MUST be measured separately from backend ingestion or LLM processing.

Tree interaction responsiveness MUST be evaluated against representative large academic datasets.

Do not optimize away meaningful updates merely to achieve artificial benchmark scores.

## **9.8 Test Baseline Reconciliation**

The public repository README reports historical values of:

- 102 backend tests.
- 26 frontend tests.

The supplied prompt separately mentions 191 backend and 53 frontend tests.

These counts are inconsistent.

Therefore:

1. Inspect the current test directories before release.
2. Determine the current test count.
3. Record the commit used for measurement.
4. Preserve every existing test.
5. Record additions and removals with justification.
6. Do not use historical test counts as current passing results.

No test execution is claimed by this specification.

## **9.9 Test Acceptance Criteria**

| ID     | Requirement                               | Priority | Verification           | Pass condition                        |
| ------ | ----------------------------------------- | -------- | ---------------------- | ------------------------------------- |
| QA-013 | Existing tests MUST be preserved          | MUST     | Git diff + test review | No unjustified deletion               |
| QA-014 | Accessibility tests MUST run in CI        | SHOULD   | CI inspection          | Required accessibility suite executes |
| QA-015 | All required viewports MUST be tested     | MUST     | Playwright/manual      | All eight widths pass                 |
| QA-016 | Core workflows MUST have regression tests | MUST     | E2E                    | Critical workflows pass               |
| QA-017 | Performance MUST be measured              | SHOULD   | Browser profiling      | Targets documented                    |
| QA-018 | Test results MUST include commit identity | MUST     | CI report              | Reproducible evidence                 |
| QA-019 | Tests MUST not be weakened                | MUST     | Code review            | Existing assertions retained          |
| QA-020 | Screen-reader testing MUST be performed   | MUST     | Manual                 | Major workflows verified              |

# **10. PWA, Mobile WebView & Cross-Device Compatibility**

## **10.1 Deployment Scope**

The specification distinguishes current browser functionality from future platform integration.

| Environment                | Status               |
| -------------------------- | -------------------- |
| Windows 11 desktop browser | Existing target      |
| Desktop responsive browser | Required             |
| Android browser            | Required target      |
| iOS browser                | Compatibility target |
| Installed PWA              | Planned acceptance   |
| Capacitor Android wrapper  | Planned acceptance   |
| Embedded WebView           | Planned acceptance   |

A PWA or native wrapper MUST NOT be represented as implemented until independently verified.

## **10.2 Viewport Configuration**

The frontend HTML entry point MUST include an appropriate viewport declaration.

Recommended:

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, viewport-fit=cover"
/>
```

Do not disable user zoom.

The application MUST support text enlargement without losing essential content.

## **10.3 Mobile Keyboard Resizing**

The application MUST handle:

- Virtual keyboard appearance.
- Input focus.
- Viewport resizing.
- Scroll repositioning.
- Dialog repositioning.
- Keyboard dismissal.

Notes editors, URL inputs, search, and date controls MUST remain usable while the keyboard is open.

Do not position critical input fields behind fixed bottom navigation.

## **10.4 Scroll Behavior**

Requirements:

- One clearly defined primary page scroll region.
- Avoid unnecessary nested scrolling.
- Preserve independent sidebar scrolling only where justified.
- Ensure modals remain scrollable.
- Prevent background scroll when modal.
- Restore scroll position after modal dismissal where appropriate.

## **10.5 File Input Compatibility**

File upload MUST use a browser-compatible input mechanism.

Requirements:

- Supported file formats MUST be communicated.
- Maximum size MUST be displayed.
- Validation MUST occur before upload when possible.
- Backend validation remains authoritative.
- Cancel and retry controls MUST remain accessible.
- File chooser behavior MUST be tested in supported browsers and WebViews.

Native file chooser support varies across embedded environments.

A Capacitor implementation may require a platform-specific integration boundary.

## **10.6 Export and Download Compatibility**

Export behavior MUST be tested for:

- Browser download.
- Mobile browser download.
- Installed PWA.
- Android WebView.
- Future Capacitor file sharing.

Do not assume that desktop download behavior works identically in every WebView.

Where browser downloads are unavailable, define an appropriate native file handling or share integration.

## **10.7 Theme Persistence**

Theme behavior MUST:

- Support dark and light modes.
- Persist the user's selection using the existing approved storage strategy.
- Avoid flashing the wrong theme during initial rendering.
- Respect system preference when no explicit user preference exists.
- Remain consistent after reload.
- Work in supported PWA contexts.

Theme persistence MUST NOT depend on a network connection.

## **10.8 Offline Communication**

Where offline functionality is implemented:

- Show connection status.
- Distinguish local persistence from remote synchronization.
- Display pending changes.
- Identify synchronization failures.
- Explain conflicts.
- Preserve recoverable user data.

A browser offline event alone MUST NOT be interpreted as proof that all local data is safely persisted.

## **10.9 Native Integration Boundary**

Future native integration MUST separate:

**Web application responsibilities**

- Academic hierarchy.
- UI rendering.
- Accessible controls.
- Form validation.
- Client-side interaction.
- API communication.

**Native wrapper responsibilities**

- Platform file selection where necessary.
- Native share sheet.
- Platform permissions.
- Device-specific file access.
- Native lifecycle integration.

Native capabilities MUST have web fallbacks where feasible.

## **10.10 PWA Acceptance Criteria**

| ID      | Requirement                                           | Priority | Verification        | Pass condition         |
| ------- | ----------------------------------------------------- | -------- | ------------------- | ---------------------- |
| PWA-001 | Responsive viewport MUST be configured                | MUST     | Browser inspection  | Correct scaling        |
| PWA-002 | User zoom MUST remain available                       | MUST     | Mobile test         | Zoom works             |
| PWA-003 | Virtual keyboard MUST not hide critical controls      | MUST     | Device testing      | Controls reachable     |
| PWA-004 | Theme MUST persist locally                            | MUST     | Reload testing      | Preference retained    |
| PWA-005 | File selection MUST work in supported environments    | MUST     | Device testing      | File can be selected   |
| PWA-006 | Export behavior MUST have a supported fallback        | SHOULD   | Device testing      | Output retrievable     |
| PWA-007 | Safe areas MUST be respected                          | MUST     | Device testing      | No obscured controls   |
| PWA-008 | Orientation changes MUST preserve layout              | MUST     | Device testing      | No broken content      |
| PWA-009 | Offline state MUST be communicated accurately         | MUST     | Network simulation  | Correct state          |
| PWA-010 | Native APIs MUST remain behind integration boundaries | MUST     | Architecture review | Web fallback preserved |

# **11. Compliance Severity & Release Gates**

## **11.1 Severity Levels**

### **P0 — Critical Release Blocker**

Examples:

- Keyboard trap.
- Critical academic workflow inaccessible.
- Data loss caused by inaccessible or broken interaction.
- Unusable supported mobile layout.
- Destructive operation without meaningful confirmation.
- Core completion workflow cannot be operated by keyboard.
- Misleading state causes irreversible user action.

Resolution:

- Mandatory before release.
- Requires verification evidence.
- Requires technical lead approval after remediation.

### **P1 — Major**

Examples:

- Incorrect ARIA state.
- Significant contrast failure.
- Dialog focus management failure.
- Essential controls clipped.
- Important screen-reader workflow broken.
- Incorrect progress announcement.
- Essential controls inaccessible on supported devices.

Resolution:

\- Must be fixed before production release unless an explicitly approved exception is legally and technically acceptable.

### **P2 — Moderate**

Examples:

- Inconsistent secondary styling.
- Minor responsive spacing problems.
- Redundant badges.
- Non-critical visual hierarchy issues.
- Minor interaction inconsistencies.

Resolution:

- Should be addressed before release.
- May be deferred with documented justification and an owner.

### **P3 — Minor**

Examples:

- Cosmetic alignment.
- Non-essential animation polish.
- Small decorative inconsistencies.

Resolution:

\- May enter the backlog.

## **11.2 Release Gate Matrix**

| Gate   | Requirement                                                | Blocking |
| ------ | ---------------------------------------------------------- | -------- |
| RG-001 | No unresolved P0 accessibility issues                      | Yes      |
| RG-002 | Core keyboard workflows work                               | Yes      |
| RG-003 | Critical screen-reader workflows work                      | Yes      |
| RG-004 | Essential mobile workflows work                            | Yes      |
| RG-005 | Required contrast thresholds pass                          | Yes      |
| RG-006 | No major academic functional regression                    | Yes      |
| RG-007 | Existing tests are not weakened                            | Yes      |
| RG-008 | Progress and verification states are accurate              | Yes      |
| RG-009 | All mandatory viewport tests pass                          | Yes      |
| RG-010 | Reduced-motion preference is respected                     | Yes      |
| RG-011 | P1 issues are resolved or approved under a valid exception | Yes      |
| RG-012 | P2/P3 issues are documented                                | No       |

## **11.3 Release Decision Rules**

A release MUST NOT be approved when:

1. Critical accessibility blockers remain.
2. Essential keyboard workflows are broken.
3. Essential mobile controls cannot be reached.
4. Required contrast checks fail.
5. Major functional regressions exist.
6. Existing regression tests have been weakened.
7. Completion or grounding statuses are misleading.
8. Dialogs permit unintended destructive interaction.
9. Essential information is inaccessible to assistive technology.
10. A synchronization success state is displayed without confirmation.

## **11.4 Exception Governance**

An exception MUST contain:

```text
Requirement ID:
Affected component:
Severity:
Reason:
User impact:
Risk:
Compensating measure:
Responsible engineer:
Reviewer:
Approval:
Review date:
Expiration date:
```

Exceptions MUST be reviewed when the affected component changes.

P0 exceptions are not acceptable for ordinary production release approval.

## **11.5 Release Acceptance Criteria**

| ID      | Requirement                     | Priority | Verification     | Pass condition      |
| ------- | ------------------------------- | -------- | ---------------- | ------------------- |
| REL-001 | No P0 issue remains             | MUST     | Issue review     | Zero unresolved P0  |
| REL-002 | P1 issues are resolved          | MUST     | Issue review     | Zero unapproved P1  |
| REL-003 | Keyboard release suite passes   | MUST     | Manual E2E       | All core workflows  |
| REL-004 | Responsive release suite passes | MUST     | Viewport E2E     | All required widths |
| REL-005 | Contrast suite passes           | MUST     | Automated/manual | Required ratios     |
| REL-006 | Regression suite passes         | MUST     | CI               | No weakened tests   |
| REL-007 | Exceptions are documented       | MUST     | Release review   | Complete records    |
| REL-008 | Technical lead signs off        | MUST     | Release approval | Recorded approval   |

# **12. Final Pre-Release UI Compliance Sign-Off Checklist**

The following checklist MUST be completed for each production release containing UI changes.

## **12.1 Accessibility**

- [ ] Semantic HTML is used appropriately.
- [ ] All interactive elements have accessible names.
- [ ] Correct ARIA attributes are present.
- [ ] ARIA relationships reference valid elements.
- [ ] Tri-state checkboxes expose correct values.
- [ ] Parent completion remains dynamically calculated.
- [ ] Collapsible hierarchy nodes expose expanded state.
- [ ] Hidden descendants cannot receive focus.
- [ ] Progress indicators expose meaningful labels.
- [ ] Dialogs have accessible titles and descriptions.
- [ ] Dialog focus is correctly managed.
- [ ] Dialog focus is restored after dismissal.
- [ ] Keyboard-only workflows are verified.
- [ ] Screen-reader announcements are meaningful.
- [ ] Live regions do not produce excessive announcements.
- [ ] Focus indicators are visible.
- [ ] Focus indicators work in dark theme.
- [ ] Focus indicators work in light theme.
- [ ] Contrast requirements are verified.
- [ ] Color is not the only indicator of status.
- [ ] Text resizing does not hide essential content.

## **12.2 Visual Design**

- [ ] Dark theme is consistent.
- [ ] Light theme is consistent.
- [ ] Semantic design tokens are centralized.
- [ ] Typography is readable.
- [ ] Academic hierarchy levels remain distinguishable.
- [ ] Excessive nested borders are reduced.
- [ ] Contact-hour badges appear only when meaningful.
- [ ] Lab indicators are visible.
- [ ] Grounding statuses are accurately represented.
- [ ] Extraction artifacts are distinguishable from verified content.
- [ ] Empty states are contextual.
- [ ] Error states are understandable.
- [ ] Loading states identify actual operations.
- [ ] Success messages are meaningful.
- [ ] Disabled controls remain distinguishable.
- [ ] No critical information relies exclusively on icons.

## **12.3 Responsive Design**

- [ ] 360px viewport tested.
- [ ] 390px viewport tested.
- [ ] 430px viewport tested.
- [ ] 768px viewport tested.
- [ ] 1024px viewport tested.
- [ ] 1440px viewport tested.
- [ ] 1920px viewport tested.
- [ ] 2560px viewport tested.
- [ ] No unintended horizontal overflow.
- [ ] Academic names wrap correctly.
- [ ] Action controls do not overlap.
- [ ] Sidebar works at mobile widths.
- [ ] Main content remains readable.
- [ ] Dialogs fit all supported widths.
- [ ] Nested hierarchy indentation remains usable.
- [ ] No essential action is hidden.
- [ ] No fixed-width component breaks the layout.

## **12.4 Mobile Readiness**

- [ ] Sidebar drawer is accessible.
- [ ] Backdrop behavior is correct.
- [ ] Escape dismissal works where applicable.
- [ ] Focus management works.
- [ ] Touch targets meet 44 × 44px project target.
- [ ] Adjacent targets have sufficient spacing.
- [ ] Bottom navigation/action bar does not obscure content.
- [ ] Safe-area top padding is correct.
- [ ] Safe-area bottom padding is correct.
- [ ] Orientation changes are handled.
- [ ] Virtual keyboard behavior is tested.
- [ ] File chooser behavior is tested.
- [ ] Export behavior is tested.
- [ ] Mobile scrolling is predictable.
- [ ] WebView-specific limitations are documented.

## **12.5 Interaction and Functional Regression**

- [ ] File upload works.
- [ ] URL ingestion works.
- [ ] Upload cancellation works.
- [ ] Upload retry works.
- [ ] SSE progress displays accurate stages.
- [ ] Polling fallback works where supported.
- [ ] Elective onboarding works.
- [ ] Elective filtering works.
- [ ] Historical progress is preserved.
- [ ] Five-tier hierarchy renders correctly.
- [ ] Topic completion works.
- [ ] Leaf-only persistence remains enforced.
- [ ] Parent tri-state calculation works.
- [ ] Parent progress percentages remain correct.
- [ ] Notes open and save correctly.
- [ ] Resources can be bookmarked.
- [ ] Source evidence opens correctly.
- [ ] Evidence status remains accurate.
- [ ] Target dates can be assigned.
- [ ] Target dates can be cleared.
- [ ] Contact-hour metadata remains informational.
- [ ] Labs are collapsed by default.
- [ ] Export functionality works.
- [ ] Import/restore functionality works where implemented.
- [ ] Delete confirmation works.
- [ ] Destructive actions remain protected.
- [ ] Offline synchronization is accurately represented where implemented.
- [ ] Command palette works if implemented.
- [ ] Theme switching works.

## **12.6 Motion and Accessibility Preferences**

- [ ] Reduced-motion preference is respected.
- [ ] Essential information does not depend on animation.
- [ ] No unnecessary continuous animation exists.
- [ ] Modal transitions remain usable.
- [ ] Sidebar transitions remain usable.
- [ ] Progress transitions remain usable.
- [ ] Keyboard focus remains visible during transitions.

## **12.7 Automated Testing and QA**

- [ ] Existing backend tests are preserved.
- [ ] Existing frontend tests are preserved.
- [ ] Current test counts have been verified.
- [ ] TypeScript validation passes.
- [ ] Production build passes.
- [ ] Lint checks pass.
- [ ] Accessibility automation has been executed.
- [ ] Responsive browser testing has been executed.
- [ ] Keyboard testing has been executed.
- [ ] Screen-reader testing has been executed.
- [ ] Contrast testing has been executed.
- [ ] Functional regression testing has been executed.
- [ ] Performance has been measured.
- [ ] Test evidence identifies the relevant commit.
- [ ] No test has been weakened to achieve a passing result.

## **12.8 Release Governance**

- [ ] All P0 findings are resolved.
- [ ] All P1 findings are resolved or validly approved.
- [ ] P2 findings are recorded.
- [ ] P3 findings are recorded.
- [ ] Exceptions contain responsible owners.
- [ ] Exceptions have review dates.
- [ ] Architecture compatibility has been checked.
- [ ] Academic data-model compatibility has been checked.
- [ ] API compatibility has been checked.
- [ ] Export compatibility has been checked.
- [ ] Technical lead approval is recorded.

## **12.9 Final Sign-Off**

| Role                   | Responsibility                    | Status  | Sign-off |
| ---------------------- | --------------------------------- | ------- | -------- |
| Frontend Engineer      | Component compliance              | Pending |          |
| Accessibility Reviewer | WCAG verification                 | Pending |          |
| QA Engineer            | Regression and viewport testing   | Pending |          |
| Technical Lead         | Architecture and release approval | Pending |          |

### **Release Information**

| Field                    | Value   |
| ------------------------ | ------- |
| Release version          | Pending |
| Git commit               | Pending |
| Test execution date      | Pending |
| Accessibility audit date | Pending |
| Responsive audit date    | Pending |
| Open P0 issues           | Pending |
| Open P1 issues           | Pending |
| Approved exceptions      | Pending |
| Release decision         | Pending |

# **13. Master Requirement Traceability Register**

This section provides a consolidated reference for engineering planning and issue tracking.

Requirement IDs MUST remain unique and MUST NOT be reused for unrelated requirements.

| Prefix | Domain                    |
| ------ | ------------------------- |
| A11Y   | Accessibility             |
| KEY    | Keyboard and focus        |
| VIS    | Visual design             |
| RWD    | Responsive design         |
| MOB    | Mobile interaction        |
| STATE  | UI states and feedback    |
| MOTION | Motion and reduced motion |
| QA     | Quality assurance         |
| PWA    | PWA and WebView           |
| REL    | Release governance        |

The individual requirements in Sections 2–12 are authoritative.

The consolidated register MUST be extended when new requirements are introduced.

# **14. Backward Compatibility & Engineering Guardrails**

## **14.1 Academic Data Integrity**

UI changes MUST NOT alter the following invariants:

1. The five-tier academic hierarchy.
2. Leaf-only completion persistence.
3. Dynamic parent tri-state calculation.
4. Eligible descendant filtering.
5. Historical elective completion preservation.
6. SQLite data integrity.
7. Source evidence traceability.
8. Contact-hour metadata semantics.
9. Lab course semantics.
10. Existing export schemas.

## **14.2 API Compatibility**

The frontend MUST preserve existing backend contracts.

In particular, UI changes MUST NOT silently alter:

- Upload request format.
- Upload job lifecycle.
- SSE event structure.
- Polling response format.
- Cancellation behavior.
- Elective review payloads.
- Elective enrollment payloads.
- Leaf completion endpoints.
- Branch completion endpoints.
- Progress response structures.

Any API modification requires separate documentation and compatibility testing.

## **14.3 Persistence Compatibility**

UI modernization MUST NOT introduce a second independent completion store.

Parent completion MUST remain derived.

Local notes and bookmarks MUST retain their existing persistence semantics.

Future offline synchronization MUST define its consistency and conflict-resolution strategy before implementation.

## **14.4 Performance and Dependency Discipline**

Prefer existing dependencies.

Do not add a dependency merely to implement a small accessibility behavior that can be handled with native HTML or existing Radix components.

Potential new dependencies require:

- A clear technical justification.
- Compatibility assessment.
- Bundle-size assessment.
- Maintenance assessment.
- Accessibility assessment.
- License review.

## **14.5 Source Evidence Preservation**

Source evidence MUST remain associated with the relevant academic item.

The UI MUST NOT:

- Rewrite original excerpts.
- Fabricate source pages.
- Invent verification confidence.
- Discard provenance during presentation.
- Present extraction fallbacks as source-verified content.

## **14.6 Documentation Governance**

This document is the authoritative UI compliance contract.

When implementation requirements change:

1. Update the relevant requirement.
2. Preserve its ID if the meaning remains unchanged.
3. Introduce a new ID if the requirement materially changes.
4. Update verification methods.
5. Reconcile with Documents 14 and 15.
6. Record unresolved decisions.
7. Obtain technical review.

# **15. Unresolved Decisions & Required Engineering Clarifications**

The following decisions require verification or explicit architectural approval.

| ID      | Decision                        | Current Position                           | Required Resolution                                     |
| ------- | ------------------------------- | ------------------------------------------ | ------------------------------------------------------- |
| DEC-001 | Light-theme architecture        | Required by this specification             | Define final token implementation                       |
| DEC-002 | Mobile bottom navigation        | Not verified                               | Decide navigation vs action bar                         |
| DEC-003 | Command palette                 | Not verified                               | Confirm roadmap and component architecture              |
| DEC-004 | PWA deployment                  | Planned                                    | Confirm manifest, service worker, installation strategy |
| DEC-005 | Offline synchronization         | Planned/unverified                         | Define outbox and conflict semantics                    |
| DEC-006 | Mobile native wrapper           | Future direction                           | Decide Capacitor integration                            |
| DEC-007 | Automated browser testing       | Not verified                               | Confirm Playwright adoption                             |
| DEC-008 | Accessibility automation        | Not verified                               | Confirm axe-core integration                            |
| DEC-009 | Documents 14 and 15             | Not available at inspected repository root | Reconcile when available                                |
| DEC-010 | Screenshot evidence             | Not accessible                             | Conduct visual comparison when supplied                 |
| DEC-011 | Screen-reader test environment  | Not verified                               | Select NVDA and mobile testing matrix                   |
| DEC-012 | Responsive sidebar architecture | Existing implementation documented         | Finalize modal vs non-modal behavior by viewport        |

No unresolved decision may be silently converted into an assertion that a feature exists.

# **16. Definition of UI Compliance Complete**

The application may be declared UI-compliant for a release only when all of the following conditions are satisfied:

1. All mandatory accessibility requirements pass.
2. All five academic hierarchy levels remain correctly represented.
3. Tri-state checkboxes expose correct accessible states.
4. Parent progress is derived from eligible descendant leaves.
5. All core workflows are keyboard-operable.
6. Dialogs have correct focus management.
7. Progress indicators expose accurate values and labels.
8. Dark and light themes pass required contrast checks.
9. All eight required viewport widths have been tested.
10. No unintended horizontal overflow remains.
11. Essential mobile interactions meet the project touch-target requirement.
12. Reduced-motion preferences are respected.
13. Upload and ingestion feedback reflect actual backend state.
14. Extraction verification is communicated accurately.
15. Existing academic functionality remains backward-compatible.
16. Existing automated regression tests are preserved.
17. Accessibility and screen-reader testing have been documented.
18. All P0 and unapproved P1 issues are resolved.
19. Release exceptions are documented.
20. Required engineering sign-offs are complete.

**Final compliance principle:** The Syllabus Tracker MUST provide the same essential academic capabilities regardless of whether a user interacts through a mouse, keyboard, touchscreen, screen reader, desktop browser, or supported mobile environment. Accessibility, data integrity, and responsive usability are core product requirements, not optional visual enhancements.

**End of `16_UI_COMPLIANCE_SPEC.md`**