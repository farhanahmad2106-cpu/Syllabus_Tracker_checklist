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
  Clock,
  Layers,
} from 'lucide-react';
import type { TopicResource, ResourceType, ResourceNodeType } from '../types/syllabus';
import { fetchSyllabusResources, addTopicResource, deleteTopicResource } from '../lib/api';

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
      .catch((err) => {
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

    try {
      const created = await addTopicResource(syllabusId, {
        node_id: nodeId,
        node_type: nodeType,
        title: trimmedTitle,
        url: trimmedUrl,
        resource_type: resourceType,
      });

      const updated = [...resources, created];
      setResources(updated);
      onResourceCountChange?.(nodeId, updated.length);

      // Reset form
      setTitle('');
      setUrl('');
      setResourceType('link');
    } catch (err: unknown) {
      console.error('Failed to add resource:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to add resource');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (resourceId: number) => {
    if (!syllabusId || !nodeId) return;
    try {
      await deleteTopicResource(syllabusId, resourceId);
      const updated = resources.filter((r) => r.id !== resourceId);
      setResources(updated);
      onResourceCountChange?.(nodeId, updated.length);
    } catch (err: unknown) {
      console.error('Failed to delete resource:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete resource');
    }
  };

  const renderResourceIcon = (type: ResourceType) => {
    switch (type) {
      case 'youtube':
        return <Video className="w-4 h-4 text-red-600" />;
      case 'github':
        return <Code className="w-4 h-4 text-purple-700" />;
      case 'documentation':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'slides':
        return <Presentation className="w-4 h-4 text-amber-600" />;
      default:
        return <LinkIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-label="Learning Resources Modal"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-gray-900 truncate">
                {nodeType === 'module' ? 'Module Resources & Lecture Links' : 'Topic Learning Resources'}
              </h2>
              <p className="text-xs text-gray-500 truncate" title={nodeTitle}>
                {nodeTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-200 transition-colors shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col gap-6 max-h-[70vh] overflow-y-auto">
          {/* Add Resource Form */}
          <form onSubmit={handleAddResource} className="bg-gray-50/80 p-4 rounded-lg border border-gray-200 space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-indigo-600" /> Add New Material / Lecture Bookmark
            </h3>

            <div>
              <label htmlFor="resource-title" className="block text-xs font-medium text-gray-600 mb-1">
                Resource Title
              </label>
              <input
                id="resource-title"
                type="text"
                placeholder="e.g. MIT 6.006 Lecture Video, Coursera Notes"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={200}
                required
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <label htmlFor="resource-url" className="block text-xs font-medium text-gray-600 mb-1">
                  URL (HTTP / HTTPS)
                </label>
                <input
                  id="resource-url"
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  maxLength={2048}
                  required
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-xs"
                />
              </div>

              <div>
                <label htmlFor="resource-type" className="block text-xs font-medium text-gray-600 mb-1">
                  Category
                </label>
                <select
                  id="resource-type"
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value as ResourceType)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="link">Link</option>
                  <option value="youtube">YouTube</option>
                  <option value="documentation">Documentation</option>
                  <option value="slides">Slides</option>
                  <option value="github">GitHub</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={adding || !title.trim() || !url.trim()}
              className="w-full mt-2 py-1.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
            >
              {adding ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" /> Adding...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" /> Save Resource
                </>
              )}
            </button>
          </form>

          {errorMessage && (
            <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-md flex items-center gap-2 border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Existing Resources List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Saved Resources ({resources.length})
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 animate-spin" /> Loading bookmarks...
              </div>
            ) : resources.length === 0 ? (
              <div className="text-center py-6 px-4 bg-gray-50 border border-dashed border-gray-200 rounded-lg text-gray-400 text-xs">
                No resources saved yet. Add lecture links, repos, or reading documents above.
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
                {resources.map((res) => (
                  <li
                    key={res.id}
                    className="p-3 hover:bg-gray-50/80 flex items-center justify-between gap-3 transition-colors bg-white"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 shrink-0">{renderResourceIcon(res.resource_type)}</div>
                      <div className="min-w-0">
                        <a
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate flex items-center gap-1 group"
                        >
                          <span className="truncate">{res.title}</span>
                          <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-indigo-500 shrink-0" />
                        </a>
                        <p className="text-[11px] text-gray-400 truncate max-w-sm">{res.url}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {res.resource_type}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(res.id)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Delete resource"
                        aria-label={`Delete resource ${res.title}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-medium rounded-md transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
