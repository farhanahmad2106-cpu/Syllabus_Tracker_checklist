/**
 * Canonical TypeScript interfaces mirroring the backend Pydantic v2 domain contracts.
 */

export interface Subtopic {
  id: string;
  title: string;
  source_text: string;
  source_page: number | null;
  source_location?: string | Record<string, unknown> | null;
  source_document_id?: string | null;
  evidence_status?: 'verified' | 'needs_review';
  order_index: number;
}

export interface Topic {
  id: string;
  title: string;
  subtopics: Subtopic[];
  order_index: number;
}

export interface Semester {
  id: string;
  title: string;
  topics: Topic[];
  order_index: number;
}

export interface AcademicYear {
  id: string;
  title: string;
  semesters: Semester[];
  order_index: number;
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
  is_completed: boolean;
}

export interface BulkTogglePayload {
  node_id?: string;
  leaf_ids?: string[];
  is_completed: boolean;
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
  };
  app_version: string;
  schema_version: number;
}
