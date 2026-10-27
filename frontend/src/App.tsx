import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Cpu,
  Edit2,
  GraduationCap,
  Menu,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { ConfirmDelete } from './components/ConfirmDelete';
import { EmptyState } from './components/EmptyState';
import { ErrorMessage } from './components/ErrorMessage';
import { FileUpload } from './components/FileUpload';
import { ProgressBar } from './components/ProgressBar';
import { SyllabusTree } from './components/SyllabusTree';
import { useSyllabus } from './hooks/useSyllabus';

export const App: React.FC = () => {
  const {
    syllabi,
    activeSyllabus,
    health,
    isLoading,
    isUploading,
    uploadProgress,
    isMutating,
    error,
    clearError,
    refreshList,
    refreshHealth,
    selectSyllabus,
    uploadFile,
    cancelUpload,
    handleToggleLeaf,
    handleToggleBranch,
    handleRename,
    handleDelete,
  } = useSyllabus();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Canonical deduplication at presentation layer by document ID
  const uniqueSyllabi = useMemo(() => {
    const seen = new Set<string>();
    return syllabi.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [syllabi]);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const minSpinPromise = new Promise((resolve) => setTimeout(resolve, 600));
    try {
      await Promise.all([refreshList(), refreshHealth(), minSpinPromise]);
    } catch (err) {
      console.error('Failed to refresh data', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const startRename = () => {
    if (activeSyllabus) {
      setEditedTitle(activeSyllabus.syllabus.title);
      setIsEditingTitle(true);
    }
  };

  const saveRename = async () => {
    if (editedTitle.trim() && editedTitle !== activeSyllabus?.syllabus.title) {
      await handleRename(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="h-screen bg-gray-950 text-gray-100 flex flex-col font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur shrink-0 z-30 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Sidebar Drawer Toggle Button */}
          <button
            type="button"
            data-testid="sidebar-toggle-btn"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-expanded={isSidebarOpen}
            aria-controls="syllabus-sidebar"
            aria-label={isSidebarOpen ? 'Collapse sidebar drawer' : 'Expand sidebar drawer'}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-100 hover:bg-gray-800/80 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl text-gray-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
            <GraduationCap className="w-5 h-5 font-bold" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-gray-100 flex items-center gap-2">
              Syllabus Tracker
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Local-First
              </span>
            </h1>
            <p className="text-xs text-gray-400">Hierarchical Curriculum & Progress Engine</p>
          </div>
        </div>

        {/* Ollama Diagnostic Badge & Actions */}
        <div className="flex items-center gap-3">
          <div
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-all ${
              health?.ollama?.is_reachable
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-amber-950/40 border-amber-800 text-amber-300'
            }`}
            title={health?.ollama?.message || 'Checking local LLM...'}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {health?.ollama?.is_reachable
                ? `Ollama: ${health.ollama.resolved_model || 'Ready'}`
                : 'Ollama: Offline (Rule fallback enabled)'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-2 text-gray-400 hover:text-gray-200 rounded-xl hover:bg-gray-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 ${
              isRefreshing ? 'cursor-not-allowed opacity-75' : ''
            }`}
            title="Refresh database and health"
            aria-label="Refresh data"
          >
            <RefreshCw
              className={`w-4 h-4 transition-transform ${
                isRefreshing ? 'animate-spin text-emerald-400' : ''
              }`}
            />
          </button>

          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
          >
            <Plus className="w-4 h-4" />
            <span>Import Syllabus</span>
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 top-[65px] z-20 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Collapsible Sidebar Drawer */}
        <aside
          id="syllabus-sidebar"
          aria-label="Document Navigation Sidebar"
          className={`flex flex-col min-h-0 bg-gray-900/70 border-r border-gray-800/80 transition-all duration-300 ease-in-out motion-reduce:transition-none z-20 ${
            // Mobile positioning: fixed drawer
            'fixed md:static inset-y-0 left-0 top-[65px] md:top-0 ' +
            (isSidebarOpen
              ? 'w-80 opacity-100 translate-x-0'
              : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:p-0 md:border-none pointer-events-none overflow-hidden')
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-gray-800/60 shrink-0 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Documents ({uniqueSyllabi.length})
            </span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 text-gray-400 hover:text-gray-200 md:hidden rounded-lg"
              aria-label="Dismiss sidebar drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Independently Scrollable Document List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {uniqueSyllabi.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-gray-800 rounded-xl space-y-2">
                <BookOpen className="w-6 h-6 text-gray-600 mx-auto" />
                <p className="text-xs text-gray-400">No syllabus loaded yet.</p>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="text-xs font-medium text-emerald-400 hover:underline"
                >
                  Upload your first syllabus
                </button>
              </div>
            ) : (
              uniqueSyllabi.map((s) => {
                const isSelected = activeSyllabus?.syllabus.id === s.id;
                // Use source_filename as primary label, fall back to title
                const displayFileName = s.source_filename || s.title;

                return (
                  <div
                    key={s.id}
                    data-testid={`sidebar-item-${s.id}`}
                    onClick={() => selectSyllabus(s.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500/60 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : 'border-gray-800/60 hover:border-gray-700 bg-gray-900/50 hover:bg-gray-800/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-sm font-medium text-gray-200 truncate"
                          title={displayFileName}
                        >
                          {displayFileName}
                        </h4>
                        {s.title && s.title !== displayFileName && (
                          <p className="text-[11px] text-gray-400 truncate mt-0.5" title={s.title}>
                            {s.title}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(s.id);
                        }}
                        className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors shrink-0"
                        title={`Delete ${displayFileName}`}
                        aria-label={`Delete ${displayFileName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[11px] text-gray-400">
                        <span>
                          {s.progress.completed_leaves} / {s.progress.total_leaves} topics
                        </span>
                        <span>{s.progress.progress_percent}%</span>
                      </div>
                      <ProgressBar progress={s.progress} size="sm" showLabel={false} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-gray-800 text-[11px] text-gray-500 space-y-1 shrink-0">
            <p>Verifiable Local-First Architecture</p>
            <p>SQLite WAL &bull; Ollama Local LLM &bull; Docling</p>
          </div>
        </aside>

        {/* Content Area with Independent Scrolling */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 custom-scrollbar">
          {error && <ErrorMessage message={error} onDismiss={clearError} />}

          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Loading syllabus hierarchy...</span>
            </div>
          ) : activeSyllabus ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Syllabus Header Card: Document Heading is Outside Academic Checkbox Hierarchy */}
              <div className="p-6 bg-gray-900/80 border border-gray-800 rounded-2xl shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                          className="px-3 py-1 text-lg font-bold bg-gray-800 border border-emerald-500 rounded-lg text-gray-100 focus:outline-hidden w-full"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={saveRename}
                          className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-gray-950 rounded-lg hover:bg-emerald-400"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingTitle(false)}
                          className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl font-bold text-gray-100 truncate">
                          {activeSyllabus.syllabus.source_filename || activeSyllabus.syllabus.title}
                        </h2>
                        {activeSyllabus.syllabus.source_filename &&
                          activeSyllabus.syllabus.title &&
                          activeSyllabus.syllabus.title !==
                            activeSyllabus.syllabus.source_filename && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700">
                              {activeSyllabus.syllabus.title}
                            </span>
                          )}
                        <button
                          type="button"
                          onClick={startRename}
                          className="text-gray-400 hover:text-emerald-400 p-1 rounded-lg hover:bg-gray-800 transition-colors"
                          title="Rename syllabus"
                          aria-label="Rename syllabus"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      File: {activeSyllabus.syllabus.source_filename} &bull; Schema v
                      {activeSyllabus.syllabus.schema_version}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDeletingId(activeSyllabus.syllabus.id)}
                      className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50 border border-red-900/60 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Document</span>
                    </button>
                  </div>
                </div>

                {/* Global Progress Bar */}
                <div className="pt-2 border-t border-gray-800/80">
                  <ProgressBar
                    progress={activeSyllabus.progress}
                    size="lg"
                    showLabel={true}
                    labelPrefix="Overall Curriculum Progress"
                  />
                </div>

                {/* Warnings */}
                {activeSyllabus.warnings && activeSyllabus.warnings.length > 0 && (
                  <div className="p-3 bg-amber-950/30 border border-amber-900/40 rounded-xl text-xs text-amber-300 space-y-1">
                    <p className="font-semibold text-amber-400">Provenance & Extraction Notes:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-200/80">
                      {activeSyllabus.warnings.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 5-Level Syllabus Hierarchy Tree */}
              <SyllabusTree
                syllabus={activeSyllabus.syllabus}
                completedLeafIds={activeSyllabus.completed_leaf_ids}
                nodeProgress={activeSyllabus.node_progress}
                onToggleLeaf={handleToggleLeaf}
                onToggleBranch={handleToggleBranch}
                isMutating={isMutating}
              />
            </div>
          ) : (
            <EmptyState
              title="No Syllabus Selected"
              description="Import an academic curriculum document (PDF, DOCX, DOC, or TXT) to automatically extract the 5-tier hierarchy (Year → Semester → Subject → Module → Topic) and start tracking your study checklist."
              onAction={() => setShowUploadModal(true)}
              actionLabel="Import Syllabus Now"
            />
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-100">Import Syllabus Document</h3>
              <button
                type="button"
                onClick={() => !isUploading && setShowUploadModal(false)}
                disabled={isUploading}
                className="text-gray-400 hover:text-gray-200 p-1 rounded-lg"
              >
                &times;
              </button>
            </div>

            <FileUpload
              onUpload={async (file) => {
                await uploadFile(file);
                setShowUploadModal(false);
              }}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onCancel={cancelUpload}
            />

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
                className="px-4 py-1.5 text-xs text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDelete
        isOpen={Boolean(deletingId)}
        syllabusTitle={
          syllabi.find((s) => s.id === deletingId)?.source_filename ||
          syllabi.find((s) => s.id === deletingId)?.title ||
          'Selected Syllabus'
        }
        onCancel={() => setDeletingId(null)}
        onConfirm={async () => {
          if (deletingId) {
            const id = deletingId;
            setDeletingId(null);
            await handleDelete(id);
          }
        }}
      />
    </div>
  );
};

export default App;
