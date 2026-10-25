import React from 'react';
import { BookOpen, UploadCloud } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No Syllabus Selected',
  description = 'Select an existing syllabus from the sidebar or import a new PDF, DOCX, DOC, or TXT syllabus to start tracking your curriculum progress.',
  onAction,
  actionLabel = 'Import Syllabus',
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center max-w-md mx-auto space-y-4">
      <div className="p-4 bg-gray-900 border border-gray-800 rounded-3xl text-emerald-400 shadow-xl shadow-black/40">
        <BookOpen className="w-10 h-10 stroke-[1.5]" />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-lg font-bold text-gray-100">{title}</h2>
        <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
      </div>

      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02]"
        >
          <UploadCloud className="w-4 h-4" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
