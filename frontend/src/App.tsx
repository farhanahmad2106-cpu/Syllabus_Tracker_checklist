import React, { useState } from 'react';
import {
  BookOpen,
  Cpu,
  Edit2,
  GraduationCap,
  Plus,
  RefreshCw,
  Trash2,
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
    isMutating,
    error,
    clearError,
    refreshList,
    refreshHealth,
    selectSyllabus,
    uploadFile,
    handleToggleLeaf,
    handleToggleBranch,
    handleRename,
    handleDelete,
  } = useSyllabus();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur sticky top-0 z-30 px-4 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
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
            onClick={() => {
              refreshList();
              refreshHealth();
            }}
            className="p-1.5 text-gray-400 hover:text-gray-200 rounded-lg hover:bg-gray-800 transition-colors"
            title="Refresh database"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Import Syllabus</span>
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Syllabi List */}
        <aside className="w-80 border-r border-gray-800/80 bg-gray-900/40 p-4 hidden md:flex flex-col justify-between overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Curricula ({syllabi.length})
              </span>
            </div>

            {syllabi.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-gray-800 rounded-xl space-y-2">
                <BookOpen className="w-6 h-6 text-gray-600 mx-auto" />
                <p className="text-xs text-gray-400">No syllabus loaded yet.</p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="text-xs font-medium text-emerald-400 hover:underline"
                >
                  Upload your first syllabus
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {syllabi.map((s) => {
                  const isSelected = activeSyllabus?.syllabus.id === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => selectSyllabus(s.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-emerald-500/60 bg-emerald-950/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                          : 'border-gray-800/60 hover:border-gray-700 bg-gray-900/50 hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-medium text-gray-200 line-clamp-1">
                          {s.title}
                        </h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingId(s.id);
                          }}
                          className="text-gray-500 hover:text-red-400 p-0.5 rounded transition-colors"
                          title="Delete syllabus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 space-y-1">
                        <ProgressBar progress={s.progress} size="sm" showLabel={true} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-800 text-[11px] text-gray-500 space-y-1">
            <p>Verifiable Local-First Architecture</p>
            <p>SQLite WAL &bull; Ollama Local LLM &bull; Docling</p>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-6">
          {error && <ErrorMessage message={error} onDismiss={clearError} />}

          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-gray-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              <span>Loading syllabus hierarchy...</span>
            </div>
          ) : activeSyllabus ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Syllabus Header Card */}
              <div className="p-6 bg-gray-900/80 border border-gray-800 rounded-2xl shadow-xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                          className="px-3 py-1 text-lg font-bold bg-gray-800 border border-emerald-500 rounded-lg text-gray-100 focus:outline-none w-full"
                          autoFocus
                        />
                        <button
                          onClick={saveRename}
                          className="px-3 py-1 text-xs font-semibold bg-emerald-500 text-gray-950 rounded-lg hover:bg-emerald-400"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsEditingTitle(false)}
                          className="px-3 py-1 text-xs text-gray-400 hover:text-gray-200"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <h2 className="text-xl font-bold text-gray-100">
                          {activeSyllabus.syllabus.title}
                        </h2>
                        <button
                          onClick={startRename}
                          className="text-gray-400 hover:text-emerald-400 p-1 rounded-lg hover:bg-gray-800 transition-colors"
                          title="Rename syllabus"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Source: {activeSyllabus.syllabus.source_filename} &bull; Schema v
                      {activeSyllabus.syllabus.schema_version}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDeletingId(activeSyllabus.syllabus.id)}
                      className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/50 border border-red-900/60 rounded-xl transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
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
              description="Import an academic curriculum document (PDF, DOCX, DOC, or TXT) to automatically extract the 4-tier hierarchy and start tracking your study checklist."
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
            />

            <div className="flex justify-end pt-2">
              <button
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
          syllabi.find((s) => s.id === deletingId)?.title || 'Selected Syllabus'
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
