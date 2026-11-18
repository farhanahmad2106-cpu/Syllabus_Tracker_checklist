import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ExternalLink,
  Video,
  FileText,
  Presentation,
  Code,
  Link as LinkIcon,
  AlertCircle,
  Layers,
} from 'lucide-react';
import type { TopicResource, ResourceType, ResourceNodeType } from '../types/syllabus';
import { fetchSyllabusResources, addTopicResource, deleteTopicResource } from '../lib/api';
import { enqueueMutation, getCachedSyllabus } from '../lib/offlineStore';

interface TopicResourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  syllabusId: string;
  nodeId: string | null;
  nodeType: ResourceNodeType;
  nodeTitle: string;
  onResourceCountChange?: (nodeId: string, count: number) => void;
}

export const TopicResourcesModal: React.FC<TopicResourcesModalProps> = ({
  isOpen,
  onClose,
  syllabusId,
  nodeId,
  nodeType,
  nodeTitle,
  onResourceCountChange,
}) => {
  const [resources, setResources] = useState<TopicResource[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [adding, setAdding] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [resourceType, setResourceType] = useState<ResourceType>('link');

  // Load resources when modal opens
  useEffect(() => {
    if (!isOpen || !nodeId || !syllabusId) return;

    let isMounted = true;
    setLoading(true);
    setErrorMessage(null);

    fetchSyllabusResources(syllabusId, nodeId, nodeType)
      .then((data) => {
        if (isMounted) {
          setResources(data);
          setLoading(false);
        }
      })
      .catch(async (err) => {
        // Offline fallback: check cached snapshot
        try {
          const cached = await getCachedSyllabus(syllabusId);
          const cachedResources = (cached?.resources || []).filter(
            (r) => r.node_id === nodeId && (!nodeType || r.node_type === nodeType)
          );
          if (isMounted && cachedResources.length > 0) {
            setResources(cachedResources);
            setLoading(false);
            return;
          }
        } catch {
          // ignore cache error
        }

        if (isMounted) {
          console.error('Failed to load resources:', err);
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load resources');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, syllabusId, nodeId, nodeType]);

  // URL input handler with auto-detection for YouTube and GitHub
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl);
    const lower = newUrl.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) {
      setResourceType('youtube');
    } else if (lower.includes('github.com')) {
      setResourceType('github');
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeId || !syllabusId) return;

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setErrorMessage('Please provide a resource title');
      return;
    }

    if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setErrorMessage('URL must begin with http:// or https://');
      return;
    }

    setAdding(true);
    setErrorMessage(null);

    const payload = {
      node_id: nodeId,
      node_type: nodeType,
      title: trimmedTitle,
      url: trimmedUrl,
      resource_type: resourceType,
    };

    try {
      const created = await addTopicResource(syllabusId, payload);
      const updated = [...resources, created];
      setResources(updated);
      onResourceCountChange?.(nodeId, updated.length);

      setTitle('');
      setUrl('');
      setResourceType('link');
    } catch (err: unknown) {
      // Offline fallback: enqueue to local outbox
      try {
        await enqueueMutation({
          syllabusId,
          type: 'ADD_RESOURCE',
          payload,
        });

        // Optimistic local resource item
        const optimisticResource: TopicResource = {
          id: -Date.now(),
          node_id: nodeId,
          node_type: nodeType,
          title: trimmedTitle,
          url: trimmedUrl,
          resource_type: resourceType,
          created_at: new Date().toISOString(),
        };

        const updated = [...resources, optimisticResource];
        setResources(updated);
        onResourceCountChange?.(nodeId, updated.length);

        setTitle('');
        setUrl('');
        setResourceType('link');
      } catch (storageErr) {
        console.error('Failed to add resource:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to add resource');
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (resourceId: number) => {
    if (!syllabusId || !nodeId) return;
    try {
      if (resourceId > 0) {
        await deleteTopicResource(syllabusId, resourceId);
      }
      const updated = resources.filter((r) => r.id !== resourceId);
      setResources(updated);
      onResourceCountChange?.(nodeId, updated.length);
    } catch (err: unknown) {
      try {
        await enqueueMutation({
          syllabusId,
          type: 'DELETE_RESOURCE',
          payload: { resourceId },
        });
        const updated = resources.filter((r) => r.id !== resourceId);
        setResources(updated);
        onResourceCountChange?.(nodeId, updated.length);
      } catch {
        console.error('Failed to delete resource:', err);
        setErrorMessage(err instanceof Error ? err.message : 'Failed to delete resource');
      }
    }
  };

  const renderResourceIcon = (type: ResourceType) => {
    switch (type) {
      case 'youtube':
        return <Video className="w-4 h-4 text-red-500" />;
      case 'github':
        return <Code className="w-4 h-4 text-purple-500" />;
      case 'documentation':
        return <FileText className="w-4 h-4 text-blue-500" />;
      case 'slides':
        return <Presentation className="w-4 h-4 text-amber-500" />;
      default:
        return <LinkIcon className="w-4 h-4 text-[var(--text-muted)]" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 pb-safe"
      data-testid="topic-resources-modal-backdrop"
    >
      <div
        className="w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden flex flex-col max-h-[90dvh]"
        role="dialog"
        aria-modal="true"
        aria-label="Learning Resources Modal"
      >
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface-elevated)]">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-2 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 rounded-lg shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--text-primary)] truncate">
                {nodeType === 'module' ? 'Module Resources & Lecture Links' : 'Topic Learning Resources'}
              </h2>
              <p className="text-xs text-[var(--text-muted)] truncate" title={nodeTitle}>
                {nodeTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto">
          {/* Add Resource Form */}
          <form
            onSubmit={handleAddResource}
            className="bg-[var(--bg-surface-elevated)] p-4 rounded-xl border border-[var(--border-subtle)] space-y-3"
          >
            <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-500" /> Add New Material / Lecture Bookmark
            </h3>

            <div>
              <label
                htmlFor="res-title-input"
                className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
              >
                Title / Description
              </label>
              <input
                id="res-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. MIT 6.006 Lecture 4 — Dynamic Programming"
                className="w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="sm:col-span-2">
                <label
                  htmlFor="res-url-input"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Resource URL
                </label>
                <input
                  id="res-url-input"
                  type="url"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>

              <div>
                <label
                  htmlFor="res-type-select"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Type
                </label>
                <select
                  id="res-type-select"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value as ResourceType)}
                  className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="link">Web Link</option>
                  <option value="youtube">YouTube Video</option>
                  <option value="documentation">Documentation</option>
                  <option value="github">GitHub Repo</option>
                  <option value="slides">Slides / PDF</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={adding || !title.trim() || !url.trim()}
                className="px-4 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{adding ? 'Saving...' : 'Add Resource'}</span>
              </button>
            </div>
          </form>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Resources List */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Attached Learning Materials ({resources.length})
            </h3>

            {loading ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs">
                Loading resources...
              </div>
            ) : resources.length === 0 ? (
              <div className="p-6 text-center text-[var(--text-muted)] text-xs border border-dashed border-[var(--border-subtle)] rounded-xl">
                No external resources attached yet. Add lecture bookmarks, video links, or papers above.
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-hairline)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
                {resources.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 bg-[var(--bg-surface-elevated)] rounded-lg shrink-0 border border-[var(--border-subtle)]">
                        {renderResourceIcon(item.resource_type)}
                      </div>
                      <div className="min-w-0">
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-[var(--text-primary)] hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1 truncate"
                        >
                          <span className="truncate">{item.title}</span>
                          <ExternalLink className="w-3 h-3 shrink-0 opacity-60" />
                        </a>
                        <p className="text-[11px] text-[var(--text-muted)] truncate max-w-xs sm:max-w-md font-mono">
                          {item.url}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
                        {item.resource_type}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                        title="Delete resource"
                        aria-label={`Delete resource ${item.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[var(--bg-surface-hover)] hover:bg-[var(--bg-surface-active)] text-[var(--text-primary)] text-xs font-medium rounded-lg transition-colors border border-[var(--border-subtle)] cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
