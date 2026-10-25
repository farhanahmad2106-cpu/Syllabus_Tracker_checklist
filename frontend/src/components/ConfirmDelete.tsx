import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface ConfirmDeleteProps {
  isOpen: boolean;
  syllabusTitle: string;
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export const ConfirmDelete: React.FC<ConfirmDeleteProps> = ({
  isOpen,
  syllabusTitle,
  isDeleting = false,
  onConfirm,
  onCancel,
}) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-delete-title"
      aria-describedby="confirm-delete-desc"
    >
      <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-950/60 border border-red-800/80 rounded-xl text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="confirm-delete-title" className="text-base font-bold text-gray-100">
              Delete Syllabus?
            </h3>
            <p className="text-xs text-gray-400 truncate max-w-[220px]" title={syllabusTitle}>
              {syllabusTitle}
            </p>
          </div>
        </div>

        <p id="confirm-delete-desc" className="text-xs text-gray-300 leading-relaxed">
          Are you sure you want to permanently delete this syllabus? All associated completion
          records, progress metrics, and checklist items will be removed.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-3.5 py-1.5 text-xs text-gray-300 hover:text-white rounded-xl hover:bg-gray-800 border border-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-colors shadow-lg shadow-red-950/50 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
