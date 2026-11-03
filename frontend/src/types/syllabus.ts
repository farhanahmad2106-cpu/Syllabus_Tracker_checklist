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
}

export interface Subject {
  id: string;
  code?: string | null;
  title: string;
  is_lab?: boolean;
  is_elective?: boolean;
  elective_group?: string | null;
  is_enrolled?: boolean;
  enrollment_status?: EnrollmentStatus;
  modules: Module[];
  order_index?: number;
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
