import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Cpu,
  Edit2,
  ExternalLink,
  Globe,
  GraduationCap,
  Menu,
  Monitor,
  Moon,
  MoreVertical,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { CommandPalette } from './components/CommandPalette';
import { ConfirmDelete } from './components/ConfirmDelete';
import { ElectiveOnboardingModal } from './components/ElectiveOnboardingModal';
import { EmptyState } from './components/EmptyState';
import { ErrorMessage } from './components/ErrorMessage';
import { ExportMenu } from './components/ExportMenu';
import { FileUpload } from './components/FileUpload';
import { ProgressBar } from './components/ProgressBar';
import { SyllabusTree } from './components/SyllabusTree';
import { TopicNotesDrawer } from './components/TopicNotesDrawer';
import { TopicResourcesModal } from './components/TopicResourcesModal';
import { useSyllabus } from './hooks/useSyllabus';
import { useTheme } from './hooks/useTheme';
import { downloadExportMarkdown } from './lib/api';

export const App: React.FC = () => {
  const {
    syllabi,
    activeSyllabus,
    pacingData,
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
    ingestUrl,
    cancelUpload,
    handleToggleLeaf,
    handleToggleBranch,
    handleRename,
    handleDelete,
    handleSetDeadline,
    handleClearDeadline,
    noteLeafIds,
    resourceCounts,
    syllabusNotes,
    syllabusResources,
    activeNoteLeaf,
    activeResourceNode,
    openNoteDrawer,
    closeNoteDrawer,
    handleNoteChange,
    openResourceModal,
    closeResourceModal,
    handleResourceCountChange,
    reviewData,
    showElectiveModal,
    openElectiveModal,
    closeElectiveModal,
    handleFinalizeEnrollment,
  } = useSyllabus();

  const { theme, resolvedTheme, setTheme } = useTheme();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const [targetNavNodeId, setTargetNavNodeId] = useState<string | null>(null);

  const isMac = useMemo(() => {
    return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || '');
  }, []);

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

  const handleQuickExportMarkdown = async () => {
    if (!activeSyllabus) return;
    try {
      await downloadExportMarkdown(
        activeSyllabus.syllabus.id,
        {
          include_notes: true,
          include_resources: true,
          include_pacing: true,
          enrolled_only: true,
        },
        activeSyllabus.syllabus.source_filename || activeSyllabus.syllabus.title
      );
    } catch (err) {
      console.error('Failed to export markdown', err);
    }
  };

  const handleDeepNavigate = (nodeId: string) => {
    setTargetNavNodeId(nodeId);
  };

  return (
    <div className="h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans overflow-hidden transition-colors duration-200">
      {/* Top Navigation Bar */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/90 backdrop-blur shrink-0 z-30 px-3 sm:px-4 lg:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4 transition-colors">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {/* Sidebar Drawer Toggle Button */}
          <button
            type="button"
            data-testid="sidebar-toggle-btn"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-expanded={isSidebarOpen}
            aria-controls="syllabus-sidebar"
            aria-label={isSidebarOpen ? 'Collapse sidebar drawer' : 'Expand sidebar drawer'}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 shrink-0"
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl text-gray-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] shrink-0">
            <GraduationCap className="w-5 h-5 font-bold" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2 truncate">
              <span>Syllabus Tracker</span>
              <span className="hidden md:inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Local-First
              </span>
            </h1>
            <p className="text-[11px] text-[var(--text-muted)] truncate hidden sm:block">Hierarchical Curriculum & Progress Engine</p>
          </div>
        </div>

        {/* Center: Command Palette Trigger Button */}
        <div className="flex-1 max-w-md mx-2 hidden md:block">
          <button
            type="button"
            data-testid="global-search-trigger"
            onClick={() => setIsCommandPaletteOpen(true)}
            aria-label={`Search curriculum (${isMac ? 'Cmd+K' : 'Ctrl+K'})`}
            className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Search courses, topics, notes...</span>
            </div>
            <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
              {isMac ? '⌘K' : 'Ctrl+K'}
            </kbd>
          </button>
        </div>

        {/* Right Actions: Mobile search, Theme selector, Diagnostic Badge, Refresh, Import */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Mobile search trigger */}
          <button
            type="button"
            data-testid="mobile-search-trigger"
            onClick={() => setIsCommandPaletteOpen(true)}
            aria-label="Open search and command palette"
            className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] md:hidden transition-colors border border-[var(--border-subtle)]"
          >
            <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </button>

          {/* Accessible Three-Way Theme Control */}
          <div
            role="radiogroup"
            aria-label="Select color theme"
            className="flex items-center p-0.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] shrink-0"
          >
            <button
              type="button"
              role="radio"
              data-testid="theme-btn-light"
              aria-checked={theme === 'light'}
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold shadow-xs'
                  : 'hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
              title="Light theme"
              aria-label="Light theme"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              role="radio"
              data-testid="theme-btn-dark"
              aria-checked={theme === 'dark'}
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
              title="Dark theme"
              aria-label="Dark theme"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              role="radio"
              data-testid="theme-btn-system"
              aria-checked={theme === 'system'}
              onClick={() => setTheme('system')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                theme === 'system'
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                  : 'hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
              title="System theme"
              aria-label="System theme"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Ollama Diagnostic Badge */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border transition-all ${
              health?.ollama?.is_reachable
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300'
            }`}
            title={health?.ollama?.message || 'Checking local LLM...'}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>
              {health?.ollama?.is_reachable
                ? `Ollama: ${health.ollama.resolved_model || 'Ready'}`
                : 'Ollama: Offline (Rule fallback)'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-xl hover:bg-[var(--bg-surface-hover)] transition-colors focus:outline-hidden focus:ring-2 focus:ring-emerald-500/50 ${
              isRefreshing ? 'cursor-not-allowed opacity-75' : ''
            }`}
            title="Refresh database and health"
            aria-label="Refresh data"
          >
            <RefreshCw
              className={`w-4 h-4 transition-transform ${
                isRefreshing ? 'animate-spin text-emerald-500' : ''
              }`}
            />
          </button>

          <button
            type="button"
            data-testid="import-syllabus-btn"
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white dark:text-gray-950 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-emerald-400"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Import Syllabus</span>
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Mobile Backdrop Overlay */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 top-[57px] sm:top-[65px] z-20 bg-black/60 backdrop-blur-xs md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Collapsible Sidebar Drawer */}
        <aside
          id="syllabus-sidebar"
          aria-label="Document Navigation Sidebar"
          className={`flex flex-col min-h-0 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] transition-all duration-300 ease-in-out motion-reduce:transition-none z-20 ${
            // Mobile positioning: fixed drawer
            'fixed md:static inset-y-0 left-0 top-[57px] sm:top-0 ' +
            (isSidebarOpen
              ? 'w-80 opacity-100 translate-x-0'
              : '-translate-x-full md:translate-x-0 md:w-0 md:opacity-0 md:p-0 md:border-none pointer-events-none overflow-hidden')
          }`}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[var(--border-hairline)] shrink-0 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Documents ({uniqueSyllabi.length})
            </span>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] md:hidden rounded-lg"
              aria-label="Dismiss sidebar drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Independently Scrollable Document List */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {uniqueSyllabi.length === 0 ? (
              <div className="p-4 text-center border border-dashed border-[var(--border-subtle)] rounded-xl space-y-2">
                <BookOpen className="w-6 h-6 text-[var(--text-muted)] mx-auto" />
                <p className="text-xs text-[var(--text-secondary)]">No syllabus loaded yet.</p>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  Upload your first syllabus
                </button>
              </div>
            ) : (
              uniqueSyllabi.map((s) => {
                const isSelected = activeSyllabus?.syllabus.id === s.id;
                const displayFileName = s.source_filename || s.title;

                return (
                  <div
                    key={s.id}
                    data-testid={`sidebar-item-${s.id}`}
                    onClick={() => selectSyllabus(s.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                        : 'border-[var(--border-hairline)] hover:border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)]/50 hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-sm font-medium text-[var(--text-primary)] truncate"
                          title={displayFileName}
                        >
                          {displayFileName}
                        </h4>
                        {s.title && s.title !== displayFileName && (
                          <p className="text-[11px] text-[var(--text-muted)] truncate mt-0.5" title={s.title}>
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
                        className="text-[var(--text-muted)] hover:text-red-500 p-1 rounded transition-colors shrink-0"
                        title={`Delete ${displayFileName}`}
                        aria-label={`Delete ${displayFileName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="mt-2.5 space-y-1">
                      <div className="flex justify-between text-[11px] text-[var(--text-secondary)]">
                        <span className="tabular-nums">
                          {s.progress.completed_leaves} / {s.progress.total_leaves} topics
                        </span>
                        <span className="tabular-nums font-medium">{s.progress.progress_percent}%</span>
                      </div>
                      <ProgressBar progress={s.progress} size="sm" showLabel={false} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-muted)] space-y-1 shrink-0">
            <p>Verifiable Local-First Architecture</p>
            <p>SQLite WAL &bull; Ollama Local LLM &bull; Radix UI</p>
          </div>
        </aside>

        {/* Content Area with Independent Scrolling */}
        <main className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-8 space-y-6 custom-scrollbar bg-[var(--bg-canvas)]">
          {error && <ErrorMessage message={error} onDismiss={clearError} />}

          {isLoading ? (
            <div className="h-64 flex items-center justify-center text-[var(--text-muted)] gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
              <span>Loading syllabus hierarchy...</span>
            </div>
          ) : activeSyllabus ? (
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Syllabus Header Card: Document Heading is Outside Academic Checkbox Hierarchy */}
              <div className="p-5 sm:p-6 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {isEditingTitle ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
                          className="px-3 py-1 text-base sm:text-lg font-bold bg-[var(--bg-surface-elevated)] border border-emerald-500 rounded-lg text-[var(--text-primary)] focus:outline-hidden w-full"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={saveRename}
                          className="px-3 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingTitle(false)}
                          className="px-3 py-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] truncate">
                          {activeSyllabus.syllabus.source_filename || activeSyllabus.syllabus.title}
                        </h2>
                        {activeSyllabus.syllabus.source_filename &&
                          activeSyllabus.syllabus.title &&
                          activeSyllabus.syllabus.title !==
                            activeSyllabus.syllabus.source_filename && (
                            <span className="text-xs px-2 py-0.5 rounded bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                              {activeSyllabus.syllabus.title}
                            </span>
                          )}
                        {activeSyllabus.syllabus.source_type === 'url' && (
                          <span
                            data-testid="web-source-badge"
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20 font-medium"
                          >
                            <Globe className="w-3 h-3 text-teal-500" />
                            <span>Web Source</span>
                            {activeSyllabus.syllabus.source_url && (
                              <a
                                href={activeSyllabus.syllabus.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-teal-500 hover:text-teal-600 ml-0.5 inline-flex items-center"
                                title="Open original syllabus web page"
                                aria-label="Open original syllabus web page"
                              >
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={startRename}
                          className="text-[var(--text-muted)] hover:text-emerald-500 p-1 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                          title="Rename syllabus"
                          aria-label="Rename syllabus"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      File: {activeSyllabus.syllabus.source_filename} &bull; Schema v
                      {activeSyllabus.syllabus.schema_version}
                    </p>
                  </div>

                  {/* Actions for Desktop and Mobile */}
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Desktop actions: inline */}
                    <div className="hidden sm:flex items-center gap-2">
                      <ExportMenu
                        syllabusId={activeSyllabus.syllabus.id}
                        syllabusTitle={activeSyllabus.syllabus.title}
                        onRestoreSuccess={(newId) => {
                          selectSyllabus(newId);
                          refreshList();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => openElectiveModal(activeSyllabus.syllabus.id)}
                        className="px-3 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/30 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Manage elective course enrollment"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                        <span>Configure Electives</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(activeSyllabus.syllabus.id)}
                        className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-500/10 border border-red-500/30 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Document</span>
                      </button>
                    </div>

                    {/* Mobile responsive: compact action buttons */}
                    <div className="flex sm:hidden items-center gap-2 w-full justify-between pt-1">
                      <ExportMenu
                        syllabusId={activeSyllabus.syllabus.id}
                        syllabusTitle={activeSyllabus.syllabus.title}
                        onRestoreSuccess={(newId) => {
                          selectSyllabus(newId);
                          refreshList();
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => openElectiveModal(activeSyllabus.syllabus.id)}
                        className="p-2 text-indigo-500 hover:bg-indigo-500/10 border border-indigo-500/30 rounded-xl transition-colors flex items-center gap-1 text-xs"
                        title="Configure Electives"
                        aria-label="Configure Electives"
                      >
                        <GraduationCap className="w-4 h-4" />
                        <span className="text-[11px]">Electives</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingId(activeSyllabus.syllabus.id)}
                        className="p-2 text-red-500 hover:bg-red-500/10 border border-red-500/30 rounded-xl transition-colors flex items-center gap-1 text-xs"
                        title="Delete Document"
                        aria-label="Delete Document"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span className="text-[11px]">Delete</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Global Progress Bar */}
                <div className="pt-2 border-t border-[var(--border-hairline)]">
                  <ProgressBar
                    progress={activeSyllabus.progress}
                    size="lg"
                    showLabel={true}
                    labelPrefix="Overall Curriculum Progress"
                  />
                </div>

                {/* Warnings */}
                {activeSyllabus.warnings && activeSyllabus.warnings.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-300 space-y-1">
                    <p className="font-semibold text-amber-600 dark:text-amber-400">Provenance & Extraction Notes:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-700/80 dark:text-amber-200/80">
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
                pacingData={pacingData}
                onSetDeadline={handleSetDeadline}
                onClearDeadline={handleClearDeadline}
                onToggleLeaf={handleToggleLeaf}
                onToggleBranch={handleToggleBranch}
                isMutating={isMutating}
                noteLeafIds={noteLeafIds}
                resourceCounts={resourceCounts}
                onOpenNote={openNoteDrawer}
                onOpenResource={openResourceModal}
                targetNodeId={targetNavNodeId}
                onTargetNodeNavigated={() => setTargetNavNodeId(null)}
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

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        syllabus={activeSyllabus?.syllabus || null}
        completedLeafIds={activeSyllabus?.completed_leaf_ids || []}
        pacingData={pacingData}
        notes={syllabusNotes}
        resources={syllabusResources}
        currentTheme={theme}
        onNavigateToNode={handleDeepNavigate}
        onOpenNote={openNoteDrawer}
        onOpenResource={openResourceModal}
        onOpenUpload={() => setShowUploadModal(true)}
        onOpenElectives={() => activeSyllabus && openElectiveModal(activeSyllabus.syllabus.id)}
        onExportMarkdown={handleQuickExportMarkdown}
        onSetTheme={setTheme}
      />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Import Syllabus Document</h3>
              <button
                type="button"
                onClick={() => !isUploading && setShowUploadModal(false)}
                disabled={isUploading}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg cursor-pointer"
              >
                &times;
              </button>
            </div>

            <FileUpload
              onUpload={async (file) => {
                await uploadFile(file);
                setShowUploadModal(false);
              }}
              onIngestUrl={async (payload) => {
                await ingestUrl(payload);
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
                className="px-4 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
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

      {/* Elective Enrollment Onboarding Modal */}
      {showElectiveModal && reviewData && (
        <ElectiveOnboardingModal
          isOpen={showElectiveModal}
          syllabusId={reviewData.syllabus_id}
          syllabusTitle={reviewData.title}
          detectedElectives={reviewData.detected_electives}
          electiveGroups={reviewData.elective_groups}
          warnings={reviewData.extraction_warnings}
          onConfirm={handleFinalizeEnrollment}
          onClose={closeElectiveModal}
          isSubmitting={isMutating}
        />
      )}

      {/* Option-B: Topic Notes Drawer */}
      <TopicNotesDrawer
        isOpen={Boolean(activeNoteLeaf)}
        onClose={closeNoteDrawer}
        syllabusId={activeSyllabus?.syllabus.id || ''}
        leafId={activeNoteLeaf?.id || null}
        leafTitle={activeNoteLeaf?.title || ''}
        onNoteChange={handleNoteChange}
      />

      {/* Option-B: Topic / Module Learning Resources Modal */}
      <TopicResourcesModal
        isOpen={Boolean(activeResourceNode)}
        onClose={closeResourceModal}
        syllabusId={activeSyllabus?.syllabus.id || ''}
        nodeId={activeResourceNode?.id || null}
        nodeType={activeResourceNode?.type || 'subtopic'}
        nodeTitle={activeResourceNode?.title || ''}
        onResourceCountChange={handleResourceCountChange}
      />
    </div>
  );
};

export default App;
