import React, { useState, useRef, useEffect } from 'react';
import {
  Download,
  FileCode,
  Printer,
  Upload,
  ChevronDown,
  Check,
  AlertTriangle,
  Clock,
  Settings2,
  X,
  FileJson,
  Share2,
  Calendar,
  CalendarPlus,
  Copy,
  RotateCw,
  Trash2,
  ShieldAlert,
} from 'lucide-react';
import type { ExportOptions, BackupRestoreResult } from '../types/syllabus';
import {
  exportSyllabusIcs,
  generateCalendarFeedUrl,
  getExportMarkdownUrl,
  getExportJsonUrl,
  getExportHtmlUrl,
  openPrintableHtml,
  restoreSyllabusBackupFile,
  revokeCalendarFeed,
} from '../lib/api';
import {
  exportAndShareFile,
  isNativePlatform,
  shareSummary,
} from '../lib/nativeBridge';

interface ExportMenuProps {
  syllabusId: string;
  syllabusTitle: string;
  onRestoreSuccess: (newSyllabusId: string) => void;
}

export const ExportMenu: React.FC<ExportMenuProps> = ({
  syllabusId,
  syllabusTitle,
  onRestoreSuccess,
}) => {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [optionsModalOpen, setOptionsModalOpen] = useState<boolean>(false);
  const [restoreModalOpen, setRestoreModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);
  const [feedModalOpen, setFeedModalOpen] = useState<boolean>(false);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [isGeneratingFeed, setIsGeneratingFeed] = useState<boolean>(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedCopied, setFeedCopied] = useState<boolean>(false);
  const [confirmRotate, setConfirmRotate] = useState<boolean>(false);
  const [confirmRevoke, setConfirmRevoke] = useState<boolean>(false);

  const isNative = isNativePlatform();

  // Export options state
  const [options, setOptions] = useState<ExportOptions>({
    include_notes: true,
    include_resources: true,
    include_pacing: true,
    enrolled_only: true,
  });

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'clone' | 'replace'>('clone');
  const [confirmReplace, setConfirmReplace] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [restoreResult, setRestoreResult] = useState<BackupRestoreResult | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportMarkdown = async () => {
    setMenuOpen(false);
    setIsExporting(true);
    try {
      const url = getExportMarkdownUrl(syllabusId, options);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      const text = await res.text();
      const outcome = await exportAndShareFile({
        filename: `${syllabusTitle || syllabusId}.md`,
        mimeType: 'text/markdown',
        content: text,
        dialogTitle: 'Share Markdown Checklist',
      });
      setExportFeedback(outcome === 'shared' ? 'Shared successfully' : 'Downloaded Markdown');
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to export markdown:', err);
      setExportFeedback('Export failed');
      setTimeout(() => setExportFeedback(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    setMenuOpen(false);
    setIsExporting(true);
    try {
      const url = getExportJsonUrl(syllabusId, options);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      const text = await res.text();
      const outcome = await exportAndShareFile({
        filename: `${syllabusTitle || syllabusId}_backup.json`,
        mimeType: 'application/json',
        content: text,
        dialogTitle: 'Share Syllabus Backup',
      });
      setExportFeedback(outcome === 'shared' ? 'Shared successfully' : 'Downloaded Backup');
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to export JSON backup:', err);
      setExportFeedback('Export failed');
      setTimeout(() => setExportFeedback(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportHtml = async () => {
    setMenuOpen(false);
    if (!isNative) {
      openPrintableHtml(syllabusId, options);
      return;
    }
    setIsExporting(true);
    try {
      const url = getExportHtmlUrl(syllabusId, options);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Export failed: ${res.statusText}`);
      const text = await res.text();
      const outcome = await exportAndShareFile({
        filename: `${syllabusTitle || syllabusId}_report.html`,
        mimeType: 'text/html',
        content: text,
        dialogTitle: 'Share Printable HTML Report',
      });
      setExportFeedback(outcome === 'shared' ? 'Shared successfully' : 'Downloaded Report');
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to export HTML report:', err);
      setExportFeedback('Export failed');
      setTimeout(() => setExportFeedback(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCalendar = async () => {
    setMenuOpen(false);
    setIsExporting(true);
    try {
      const icsText = await exportSyllabusIcs(syllabusId, {
        includeDeadlines: true,
        includeRevisions: true,
        includeCompleted: false,
      });
      const outcome = await exportAndShareFile({
        filename: `${syllabusTitle || syllabusId}_schedule.ics`,
        mimeType: 'text/calendar',
        content: icsText,
        dialogTitle: 'Share Calendar Schedule',
      });
      setExportFeedback(outcome === 'shared' ? 'Shared successfully' : 'Downloaded Calendar (.ics)');
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err: unknown) {
      console.error('Failed to export calendar schedule:', err);
      setExportFeedback('Export failed');
      setTimeout(() => setExportFeedback(null), 3000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateOrRotateFeed = async () => {
    setIsGeneratingFeed(true);
    setFeedError(null);
    setFeedCopied(false);
    try {
      const url = await generateCalendarFeedUrl(syllabusId);
      setFeedUrl(url);
      setConfirmRotate(false);
    } catch (err: unknown) {
      console.error('Failed to generate calendar feed URL:', err);
      setFeedError(err instanceof Error ? err.message : 'Failed to generate feed URL');
    } finally {
      setIsGeneratingFeed(false);
    }
  };

  const handleCopyFeedUrl = async () => {
    if (!feedUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(feedUrl);
      } else {
        const input = document.getElementById('calendar-feed-url-input') as HTMLInputElement | null;
        if (input) {
          input.select();
          document.execCommand('copy');
        }
      }
      setFeedCopied(true);
      setTimeout(() => setFeedCopied(false), 3000);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
      const input = document.getElementById('calendar-feed-url-input') as HTMLInputElement | null;
      if (input) {
        input.select();
      }
      setFeedError('Unable to access clipboard automatically. Please copy the URL manually.');
    }
  };

  const handleRevokeFeed = async () => {
    setIsGeneratingFeed(true);
    setFeedError(null);
    try {
      await revokeCalendarFeed(syllabusId);
      setFeedUrl(null);
      setConfirmRevoke(false);
      setFeedCopied(false);
    } catch (err: unknown) {
      console.error('Failed to revoke calendar feed:', err);
      setFeedError(err instanceof Error ? err.message : 'Failed to revoke feed');
    } finally {
      setIsGeneratingFeed(false);
    }
  };

  const handleShareSummary = async () => {
    setMenuOpen(false);
    try {
      const outcome = await shareSummary({
        title: syllabusTitle || 'Syllabus Tracker',
        text: `Checklist, progress tracking, and study planner for ${syllabusTitle || 'Syllabus'}.`,
        url: window.location.href,
        dialogTitle: 'Share Syllabus Summary',
      });
      setExportFeedback(outcome === 'shared' ? 'Shared summary' : 'Copied summary');
      setTimeout(() => setExportFeedback(null), 3000);
    } catch (err) {
      console.warn('Share summary error:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setRestoreFile(e.target.files[0]);
      setRestoreError(null);
    }
  };

  const executeRestore = async () => {
    if (!restoreFile) {
      setRestoreError('Please select a JSON backup file to restore.');
      return;
    }

    if (restoreMode === 'replace' && !confirmReplace) {
      setRestoreError('Please confirm that you want to overwrite the current syllabus.');
      return;
    }

    setRestoring(true);
    setRestoreError(null);
    setRestoreResult(null);

    try {
      const result = await restoreSyllabusBackupFile(
        restoreFile,
        restoreMode,
        restoreMode === 'replace' ? syllabusId : undefined
      );

      setRestoreResult(result);
      if (result.success) {
        setTimeout(() => {
          setRestoreModalOpen(false);
          setRestoreFile(null);
          setRestoreResult(null);
          onRestoreSuccess(result.syllabus_id);
        }, 1500);
      }
    } catch (err: unknown) {
      console.error('Restore failed:', err);
      setRestoreError(err instanceof Error ? err.message : 'Restore failed.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      {/* Trigger Button */}
      <div className="flex items-center rounded-lg shadow-xs border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-700 focus:outline-none cursor-pointer"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          aria-label="Export & Backup options"
        >
          {isExporting ? (
            <Clock className="w-3.5 h-3.5 text-blue-500 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5 text-gray-500" />
          )}
          <span>{isExporting ? 'Exporting...' : 'Export & Backup'}</span>
          <ChevronDown className="w-3 h-3 text-gray-400" />
        </button>

        <button
          type="button"
          onClick={() => setOptionsModalOpen(true)}
          className="p-1.5 text-gray-400 hover:text-gray-700 border-l border-gray-200 transition-colors cursor-pointer"
          title="Configure export contents"
          aria-label="Configure export options"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {exportFeedback && (
        <div className="absolute right-0 top-full mt-1 px-2.5 py-1 text-[11px] font-medium bg-zinc-900 text-white rounded shadow-md z-50 animate-in fade-in">
          {exportFeedback}
        </div>
      )}

      {/* Dropdown Menu */}
      {menuOpen && (
        <div
          className="absolute right-0 mt-2 w-60 rounded-lg shadow-lg bg-white ring-1 ring-black/5 divide-y divide-gray-100 z-50 focus:outline-none animate-in fade-in-50 zoom-in-95 duration-100"
          role="menu"
        >
          <div className="py-1">
            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              role="menuitem"
            >
              <FileCode className="w-4 h-4 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">
                  {isNative ? 'Share Markdown (.md)' : 'Export Markdown (.md)'}
                </div>
                <div className="text-[10px] text-gray-400">Hierarchical checklist with notes</div>
              </div>
            </button>

            <button
              onClick={handleExportJson}
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              role="menuitem"
            >
              <FileJson className="w-4 h-4 text-emerald-600" />
              <div>
                <div className="font-medium text-gray-900">
                  {isNative ? 'Share JSON Backup (.json)' : 'Download Backup (.json)'}
                </div>
                <div className="text-[10px] text-gray-400">Schema 2.1 portable snapshot</div>
              </div>
            </button>

            <button
              onClick={handleExportHtml}
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              role="menuitem"
            >
              <Printer className="w-4 h-4 text-purple-600" />
              <div>
                <div className="font-medium text-gray-900">
                  {isNative ? 'Share HTML Report (.html)' : 'Print / Save PDF (HTML)'}
                </div>
                <div className="text-[10px] text-gray-400">Printable offline study summary</div>
              </div>
            </button>

            <button
              onClick={handleExportCalendar}
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-gray-100"
              role="menuitem"
            >
              <Calendar className="w-4 h-4 text-amber-600" />
              <div>
                <div className="font-medium text-gray-900">
                  {isNative ? 'Share Calendar (.ics)' : 'Calendar Schedule (.ics)'}
                </div>
                <div className="text-[10px] text-gray-400">Deadlines &amp; SM-2 spaced repetition</div>
              </div>
            </button>

            <button
              onClick={() => {
                setMenuOpen(false);
                setFeedModalOpen(true);
                if (!feedUrl) {
                  handleGenerateOrRotateFeed();
                }
              }}
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              role="menuitem"
            >
              <CalendarPlus className="w-4 h-4 text-cyan-600" />
              <div>
                <div className="font-medium text-gray-900">Subscribe to Calendar Feed...</div>
                <div className="text-[10px] text-gray-400">Live sync with Google, Apple &amp; Outlook</div>
              </div>
            </button>

            <button
              onClick={handleShareSummary}
              disabled={isExporting}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors cursor-pointer border-t border-gray-100"
              role="menuitem"
            >
              <Share2 className="w-4 h-4 text-teal-600" />
              <div>
                <div className="font-medium text-gray-900">Share Summary</div>
                <div className="text-[10px] text-gray-400">Share or copy curriculum progress</div>
              </div>
            </button>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setMenuOpen(false);
                setRestoreModalOpen(true);
              }}
              className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 transition-colors"
              role="menuitem"
            >
              <Upload className="w-4 h-4 text-indigo-600" />
              <div>
                <div className="font-medium text-gray-900">Restore from Backup...</div>
                <div className="text-[10px] text-gray-400">Import saved JSON backup</div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Export Options Modal */}
      {optionsModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-gray-600" /> Export Options
              </h3>
              <button
                onClick={() => setOptionsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs text-gray-700">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.include_notes}
                  onChange={(e) => setOptions({ ...options, include_notes: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Include Topic Study Notes</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.include_resources}
                  onChange={(e) => setOptions({ ...options, include_resources: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Include Learning Resources &amp; Bookmarks</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.include_pacing}
                  onChange={(e) => setOptions({ ...options, include_pacing: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Include Exam Deadlines &amp; Pacing Velocities</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={options.enrolled_only}
                  onChange={(e) => setOptions({ ...options, enrolled_only: e.target.checked })}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Enrolled Courses Only (Exclude unenrolled electives)</span>
              </label>
            </div>

            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setOptionsModalOpen(false)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Backup Modal */}
      {restoreModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" /> Restore Syllabus Backup
              </h3>
              <button
                onClick={() => setRestoreModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs text-gray-700">
              {/* File Selector */}
              <div>
                <label className="block font-semibold text-gray-800 mb-1.5">
                  Select Backup JSON File
                </label>
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-gray-300 rounded-lg p-2"
                />
                {restoreFile && (
                  <p className="mt-1 text-[11px] text-gray-500">
                    Selected: <strong>{restoreFile.name}</strong> ({(restoreFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="block font-semibold text-gray-800">Restoration Mode</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="restore_mode"
                      value="clone"
                      checked={restoreMode === 'clone'}
                      onChange={() => setRestoreMode('clone')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Clone as New Syllabus (Safe)</div>
                      <div className="text-[11px] text-gray-500">
                        Imports as an independent syllabus with a fresh ID without modifying your current syllabus.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="radio"
                      name="restore_mode"
                      value="replace"
                      checked={restoreMode === 'replace'}
                      onChange={() => setRestoreMode('replace')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <div className="font-semibold text-gray-900">Replace Current Syllabus</div>
                      <div className="text-[11px] text-gray-500">
                        Overwrites current syllabus "{syllabusTitle}". Replaces completions, notes, and deadlines.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Confirmation Checkbox for Replace */}
              {restoreMode === 'replace' && (
                <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-amber-900 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" /> Overwrite Warning
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer text-[11px]">
                    <input
                      type="checkbox"
                      checked={confirmReplace}
                      onChange={(e) => setConfirmReplace(e.target.checked)}
                      className="mt-0.5 text-amber-600 rounded focus:ring-0"
                    />
                    <span>
                      I understand this action will completely overwrite the existing syllabus checklist, completions, notes, and deadlines.
                    </span>
                  </label>
                </div>
              )}

              {/* Messages */}
              {restoreError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                  {restoreError}
                </div>
              )}

              {restoreResult && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Check className="w-4 h-4 text-emerald-600" /> Restoration Successful!
                  </div>
                  <p>Restored {restoreResult.restored_completed_leaves} completed subtopics.</p>
                  <p>Restored {restoreResult.restored_notes} notes and {restoreResult.restored_resources} resources.</p>
                  <p>Switching syllabus now...</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRestoreModalOpen(false)}
                disabled={restoring}
                className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeRestore}
                disabled={restoring || !restoreFile || (restoreMode === 'replace' && !confirmReplace)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                {restoring ? (
                  <>
                    <Clock className="w-3.5 h-3.5 animate-spin" /> Restoring...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Execute Restore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Subscription Feed Modal */}
      {feedModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-cyan-600" /> Calendar Feed Subscription
              </h3>
              <button
                onClick={() => {
                  setFeedModalOpen(false);
                  setConfirmRotate(false);
                  setConfirmRevoke(false);
                  setFeedError(null);
                }}
                className="text-gray-400 hover:text-gray-700 p-1 rounded cursor-pointer"
                aria-label="Close calendar feed modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs text-gray-700">
              <p className="text-gray-600">
                Subscribe in Google Calendar, Apple Calendar, or Microsoft Outlook to synchronize academic exam deadlines and SM-2 spaced repetition reviews automatically.
              </p>

              {feedUrl ? (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="calendar-feed-url-input" className="block font-semibold text-gray-800 mb-1">
                      Subscription Feed URL
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="calendar-feed-url-input"
                        type="text"
                        readOnly
                        value={feedUrl}
                        className="w-full px-3 py-2 text-xs font-mono bg-gray-50 border border-gray-300 rounded-lg text-gray-800 select-all focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      />
                      <button
                        type="button"
                        onClick={handleCopyFeedUrl}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                          feedCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-cyan-600 hover:bg-cyan-700 text-white'
                        }`}
                        title="Copy subscription URL"
                      >
                        {feedCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{feedCopied ? 'Copied!' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Private Bearer Credential:</strong> Anyone with this link can view your academic deadlines and revision schedule. Do not publish it publicly.
                    </div>
                  </div>

                  {/* App Subscription Instructions */}
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-[11px] space-y-1.5">
                    <div className="font-semibold text-gray-800">How to subscribe:</div>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Google Calendar:</strong> Other calendars (+) &gt; From URL &gt; Paste link.</li>
                      <li><strong>Apple Calendar:</strong> File &gt; New Calendar Subscription &gt; Paste link.</li>
                      <li><strong>Microsoft Outlook:</strong> Add calendar &gt; Subscribe from web &gt; Paste link.</li>
                    </ul>
                    <div className="text-[10px] text-gray-500 italic mt-1">
                      Note: External calendar providers refresh subscribed feeds periodically (every few hours).
                    </div>
                  </div>

                  {/* Rotation and Revocation Controls */}
                  <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
                    {confirmRotate ? (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
                        <div className="text-rose-800 font-semibold text-[11px]">
                          Rotate Subscription URL? Previous calendar subscriptions will stop updating.
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleGenerateOrRotateFeed}
                            disabled={isGeneratingFeed}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            {isGeneratingFeed ? 'Rotating...' : 'Yes, Rotate Token'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRotate(false)}
                            className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 rounded text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : confirmRevoke ? (
                      <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 space-y-2">
                        <div className="text-rose-800 font-semibold text-[11px]">
                          Revoke and disable this calendar feed immediately?
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRevokeFeed}
                            disabled={isGeneratingFeed}
                            className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-semibold cursor-pointer"
                          >
                            {isGeneratingFeed ? 'Revoking...' : 'Yes, Revoke Feed'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmRevoke(false)}
                            className="px-2.5 py-1 text-gray-600 hover:bg-gray-100 rounded text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setConfirmRotate(true)}
                          disabled={isGeneratingFeed}
                          className="inline-flex items-center gap-1.5 text-gray-500 hover:text-gray-800 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <RotateCw className="w-3.5 h-3.5" /> Rotate URL
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmRevoke(true)}
                          disabled={isGeneratingFeed}
                          className="inline-flex items-center gap-1.5 text-rose-600 hover:text-rose-700 text-[11px] font-medium transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Revoke Feed
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <p className="text-gray-500 text-xs">
                    No active calendar feed token found for this syllabus.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateOrRotateFeed}
                    disabled={isGeneratingFeed}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    {isGeneratingFeed ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" /> Generating Secure Feed...
                      </>
                    ) : (
                      <>
                        <CalendarPlus className="w-4 h-4" /> Generate Subscription Feed
                      </>
                    )}
                  </button>
                </div>
              )}

              {feedError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{feedError}</span>
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setFeedModalOpen(false);
                  setConfirmRotate(false);
                  setConfirmRevoke(false);
                  setFeedError(null);
                }}
                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
