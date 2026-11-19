/**
 * Canonical TypeScript interfaces mirroring the backend Pydantic v2 domain contracts.
 * Strictly models the five-tier academic hierarchy beneath the Document Root.
 */

export type GroundingStatus = 'verified' | 'needs_review' | 'unverified' | 'review_required';

export type EnrollmentStatus = 'mandatory' | 'selected' | 'excluded' | 'pending';

export interface Subtopic {
  id: string;
  title: string;
  source_text: string;
  source_page?: number | null;
  source_location?: string | Record<string, unknown> | null;
  source_document_id?: string | null;
  evidence_status?: GroundingStatus;
  grounding_status?: GroundingStatus;
  source_start_offset?: number | null;
  source_end_offset?: number | null;
  order_index?: number;
}

export interface Module {
  id: string;
  module_number?: string | null;
  title: string;
  contact_hours?: number | null;
  topics: Subtopic[];
  order_index?: number;
  evidence_status?: GroundingStatus;
  grounding_status?: GroundingStatus;
}

export interface Subject {
  id: string;
  code?: string | null;
  title: string;
  credits?: number | null;
  ltp?: string | null;
  is_lab?: boolean;
  is_elective?: boolean;
  elective_group?: string | null;
  is_enrolled?: boolean;
  enrollment_status?: EnrollmentStatus;
  modules: Module[];
  order_index?: number;
  evidence_status?: GroundingStatus;
  grounding_status?: GroundingStatus;
}

export interface Topic {
  id: string;
  title: string;
  subtopics?: Subtopic[];
  topics?: Subtopic[];
  modules?: Module[];
  order_index?: number;
}

export interface Semester {
  id: string;
  title: string;
  semester_number?: number | null;
  subjects?: Subject[];
  topics?: Topic[];
  order_index?: number;
}

export interface AcademicYear {
  id: string;
  title: string;
  year_number?: number | null;
  semesters: Semester[];
  order_index?: number;
}

export type Year = AcademicYear;

export interface HierarchicalSyllabus {
  id: string;
  title: string;
  years: AcademicYear[];
  created_at: string;
  updated_at: string;
  source_filename: string;
  source_type?: 'upload' | 'url';
  source_url?: string | null;
  schema_version: number;
  content_hash?: string | null;
  source_file_hash?: string | null;
  source_file_type?: string;
  extraction_status?: string;
  requires_enrollment_confirmation?: boolean;
}

export interface ProgressSummary {
  total_leaves: number;
  completed_leaves: number;
  progress_percent: number;
}

export interface SyllabusResponse {
  syllabus: HierarchicalSyllabus;
  completed_leaf_ids: string[];
  progress: ProgressSummary;
  node_progress: Record<string, ProgressSummary>;
  warnings: string[];
}

export interface SyllabusSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  source_filename: string;
  source_type?: 'upload' | 'url';
  source_url?: string | null;
  progress: ProgressSummary;
  leaf_count: number;
}

export interface HealthResponse {
  status: string;
  database: string;
  active_provider?: string;
  provider_status?: {
    is_reachable: boolean;
    message: string;
  };
  ollama: {
    is_reachable: boolean;
    message: string;
    configured_model: string;
    configured_fallback: string;
    resolved_model: string | null;
    available_models: string[];
  };
}

export interface LeafTogglePayload {
  leaf_id: string;
  is_completed?: boolean;
  completed?: boolean;
}

export interface BulkTogglePayload {
  node_type?: string;
  node_id?: string;
  leaf_ids?: string[];
  is_completed?: boolean;
  completed?: boolean;
}

export interface SyllabusRenamePayload {
  title: string;
}

export type CheckboxCheckedState = boolean | 'indeterminate';

export interface AppConfigResponse {
  max_upload_size_bytes: number;
  max_upload_size_mib: number;
  allowed_extensions: string[];
  active_provider: string;
  configured_model: string;
  active_model: string | null;
  ollama_connected: boolean;
  features: {
    legacy_doc_conversion: boolean;
    evidence_grounding: boolean;
    tri_state_checkboxes: boolean;
    leaf_only_persistence: boolean;
    dual_provider_extraction?: boolean;
    elective_onboarding?: boolean;
  };
  app_version: string;
  schema_version: number;
}

export type UploadStage =
  | 'queued'
  | 'validating'
  | 'extracting_text'
  | 'parsing'
  | 'cleaning'
  | 'chunking'
  | 'extracting'
  | 'extracting_curriculum'
  | 'validating_result'
  | 'merging'
  | 'persisting'
  | 'awaiting_enrollment'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface StartUploadResponse {
  job_id: string;
  stage: UploadStage;
  percent: number;
  message: string;
}

export interface UploadProgress {
  job_id: string;
  stage: UploadStage;
  percent: number;
  message: string;
  syllabus_id?: string | null;
  result: SyllabusResponse | null;
  error: string | null;
}

export interface ParseReviewResponse {
  syllabus_id: string;
  title: string;
  detected_electives: Subject[];
  elective_groups: Record<string, Subject[]> | string[];
  years: AcademicYear[];
  requires_enrollment_confirmation: boolean;
  extraction_warnings?: string[];
}

export interface FinalizeEnrollmentRequest {
  enrolled_subject_ids: string[];
}

export type PacingStatus =
  | 'completed'
  | 'on_track'
  | 'at_risk'
  | 'behind'
  | 'not_set';

export interface PacingMetrics {
  node_id: string;
  target_date?: string | null;
  days_remaining?: number | null;

  total_leaves: number;
  completed_leaves: number;
  remaining_leaves: number;

  remaining_contact_hours: number;

  topics_per_week: number;
  hours_per_week: number;

  status: PacingStatus;
}

export interface SyllabusPacingSummary {
  syllabus_id: string;
  deadlines: Record<string, PacingMetrics>;
}

export interface SetTargetDatePayload {
  node_id: string;
  node_type: 'subject' | 'semester';
  target_date: string;
}

// --- Option-B: Notes, Resources & Export/Restore Types ---

export interface TopicNote {
  leaf_id: string;
  content: string;
  updated_at?: string | null;
}

export type ResourceType = 'youtube' | 'documentation' | 'slides' | 'github' | 'link';
export type ResourceNodeType = 'subtopic' | 'module';

export interface TopicResource {
  id: number;
  node_id: string;
  node_type: ResourceNodeType;
  title: string;
  url: string;
  resource_type: ResourceType;
  created_at: string;
}

export interface AddResourcePayload {
  node_id: string;
  node_type: ResourceNodeType;
  title: string;
  url: string;
  resource_type?: ResourceType;
}

export interface ExportOptions {
  include_notes: boolean;
  include_resources: boolean;
  include_pacing: boolean;
  enrolled_only: boolean;
}

export interface BackupRestorePayload {
  backup_data: Record<string, unknown>;
  mode: 'clone' | 'replace';
  target_syllabus_id?: string;
}

export interface BackupRestoreResult {
  success: boolean;
  syllabus_id: string;
  restored_completed_leaves: number;
  restored_notes: number;
  restored_resources: number;
  restored_deadlines: number;
  warnings: string[];
}

// --- Option-C: Web Scraper & Portal Ingestion Types ---

export interface EmbeddedDocumentPreview {
  url: string;
  filename: string;
  document_type: string;
  relevance_score: number;
  relevance_label: string;
  display_title: string;
}

export interface ScrapePreview {
  url: string;
  final_url: string;
  resolved_title: string;
  content_type: string;
  source_kind: 'html' | 'pdf' | 'docx';
  detected_embedded_files: EmbeddedDocumentPreview[];
  content_preview: string;
  warnings: string[];
  requires_document_selection: boolean;
  preview_token?: string | null;
}

export interface IngestUrlPayload {
  url: string;
  follow_embedded_pdf?: boolean;
  custom_title?: string;
  selected_document_url?: string;
  preview_token?: string | null;
}

// --- Phase 12: Study Analytics & Spaced Repetition Types ---

export interface CompletionVelocityDay {
  date: string;
  completed_count: number;
  uncompleted_count: number;
  net_change: number;
  cumulative_completed: number;
}

export interface StreakMetrics {
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  is_active_today: boolean;
}

export interface SubjectCoverageItem {
  subject_id: string;
  subject_code: string;
  subject_title: string;
  is_lab: boolean;
  total_leaves: number;
  completed_leaves: number;
  completion_percentage: number;
}

export interface RevisionQueueMetrics {
  due_today_count: number;
  overdue_count: number;
  upcoming_7d_count: number;
  mastered_count: number;
  total_scheduled: number;
}

export interface ExamRiskItem {
  node_id: string;
  node_type: string;
  title: string;
  target_date: string;
  days_remaining: number;
  total_leaves: number;
  completed_leaves: number;
  incomplete_leaves: number;
  completion_percentage: number;
  required_velocity_per_day: number;
  current_velocity_per_day: number;
  risk_level: 'Low' | 'Moderate' | 'High' | 'Critical';
  risk_reason: string;
}

export interface SyllabusAnalytics {
  syllabus_id: string;
  overall_completion_percentage: number;
  total_eligible_leaves: number;
  completed_eligible_leaves: number;
  remaining_eligible_leaves: number;
  streak: StreakMetrics;
  velocity_14d: CompletionVelocityDay[];
  subject_coverage: SubjectCoverageItem[];
  revision_queue: RevisionQueueMetrics;
  exam_risks: ExamRiskItem[];
}

export interface DueRevisionItem {
  schedule_id: number;
  leaf_id: string;
  leaf_title: string;
  module_id: string;
  module_title: string;
  subject_id: string;
  subject_code: string;
  subject_title: string;
  semester_id: string;
  semester_title: string;
  due_date: string;
  days_overdue: number;
  is_overdue: boolean;
  repetition_count: number;
  interval_days: number;
  ease_factor: number;
  last_reviewed_at: string | null;
  has_notes: boolean;
  resource_count: number;
}

export interface DueRevisionsResponse {
  syllabus_id: string;
  total_due: number;
  items: DueRevisionItem[];
}

export interface ReviewRatingRequest {
  quality: 1 | 2 | 3 | 4;
  idempotency_key?: string;
  client_review_date?: string;
}

export interface ReviewRatingResponse {
  schedule_id: number;
  syllabus_id: string;
  leaf_id: string;
  repetition_count: number;
  interval_days: number;
  ease_factor: number;
  next_review_date: string;
  quality: number;
  reviewed_at: string;
}

// =========================================================================
// Phase 13 — Cycle A: Academic Planning & Multi-Syllabus Comparison Types
// =========================================================================

export type GradeScale = '10.0' | '4.0';

export interface SubjectAcademicPlanUpdate {
  credit_override?: number | null;
  target_grade_points?: number | null;
  grade_scale?: GradeScale;
}

export interface SubjectAcademicPlanItem {
  subject_id: string;
  subject_title: string;
  subject_code?: string | null;
  semester_id: string;
  semester_title: string;
  is_enrolled: boolean;
  is_lab: boolean;
  is_elective: boolean;
  declared_credits?: number | null;
  credit_override?: number | null;
  effective_credits?: number | null;
  ltp?: string | null;
  grade_scale: GradeScale;
  target_grade_points?: number | null;
  is_gpa_eligible: boolean;
  is_completed: boolean;
  total_leaves: number;
  completed_leaves: number;
}

export interface SemesterCreditSummary {
  semester_id: string;
  semester_title: string;
  semester_number?: number | null;
  enrolled_subject_count: number;
  known_credit_subject_count: number;
  total_declared_credits: number;
  completed_credits: number;
  remaining_credits: number;
  proportional_earned_estimate: number;
  unassigned_credit_count: number;
  target_sgpa_10?: number | null;
  target_sgpa_4?: number | null;
  eligible_credits_10: number;
  eligible_credits_4: number;
}

export interface ProgramCreditSummary {
  total_enrolled_subjects: number;
  known_credit_subject_count: number;
  total_declared_credits: number;
  completed_credits: number;
  remaining_credits: number;
  proportional_earned_estimate: number;
  unassigned_credit_count: number;
  target_cgpa_10?: number | null;
  target_cgpa_4?: number | null;
  eligible_credits_10: number;
  eligible_credits_4: number;
}

export interface GradeScaleProjection {
  grade_scale: GradeScale;
  target_cgpa?: number | null;
  eligible_credits: number;
  eligible_subjects_count: number;
}

export interface AcademicPlanResponse {
  syllabus_id: string;
  program_credit_summary: ProgramCreditSummary;
  semester_summaries: SemesterCreditSummary[];
  grade_scale_projections: GradeScaleProjection[];
  subject_plans: SubjectAcademicPlanItem[];
  unassigned_credit_subjects: string[];
  calculation_metadata: Record<string, unknown>;
}

export interface SyllabusComparisonItem {
  syllabus_id: string;
  title: string;
  source_type: string;
  source_filename: string;
  year_count: number;
  semester_count: number;
  total_subjects: number;
  enrolled_subjects: number;
  excluded_electives: number;
  lab_subjects: number;
  lab_ratio_percent: number;
  total_modules: number;
  total_topics: number;
  completed_topics: number;
  completion_percent: number;
  total_known_declared_credits: number;
  missing_credit_subject_count: number;
  target_gpa_subject_count: number;
}

export interface SharedSubjectMatch {
  subject_title_a: string;
  subject_title_b: string;
  syllabus_id_a: string;
  syllabus_id_b: string;
  subject_id_a: string;
  subject_id_b: string;
  match_type: 'exact_title' | 'course_code' | 'token_similarity';
  match_strength: number;
}

export interface SyllabusComparisonResponse {
  syllabi: SyllabusComparisonItem[];
  shared_subjects: SharedSubjectMatch[];
  compared_at: string;
}





