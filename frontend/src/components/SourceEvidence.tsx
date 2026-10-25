import React, { useState } from 'react';
import { BookOpen, FileText, MapPin, X } from 'lucide-react';
import type { Subtopic } from '../types/syllabus';

interface SourceEvidenceProps {
  subtopic: Subtopic;
}

export const SourceEvidence: React.FC<SourceEvidenceProps> = ({ subtopic }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 hover:text-emerald-300 hover:bg-emerald-950/40 rounded border border-gray-700/60 hover:border-emerald-700/60 transition-colors"
        title="Inspect verifiable source evidence"
        aria-label={`Inspect source evidence for ${subtopic.title}`}
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span className="font-mono text-[11px]">
          {subtopic.source_page ? `p.${subtopic.source_page}` : 'Evidence'}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-11/12 max-w-lg p-5 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold tracking-wider uppercase text-emerald-400">
                  Source Evidence & Grounding
                </span>
                <h3 className="text-base font-medium text-gray-100 mt-0.5">
                  {subtopic.title}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-100 hover:bg-gray-800 rounded-lg transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-400 flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-400" />
                  Verbatim Document Snippet
                </span>
                <div className="p-3 text-xs text-gray-200 bg-gray-950/90 border border-gray-800 rounded-xl font-mono leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto selection:bg-emerald-500/30">
                  {subtopic.source_text}
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-gray-300">
                <div className="px-2.5 py-1 bg-gray-800/80 border border-gray-700/80 rounded-lg flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-gray-400" />
                  <span>
                    {subtopic.source_page
                      ? `Page: ${subtopic.source_page}`
                      : 'Page: Not explicitly numbered in source'}
                  </span>
                </div>
                {(subtopic.grounding_status || subtopic.evidence_status) && (
                  <div
                    className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 border ${
                      (subtopic.grounding_status || subtopic.evidence_status) === 'verified'
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
                        : (subtopic.grounding_status || subtopic.evidence_status) === 'needs_review'
                        ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                        : 'bg-rose-950/60 border-rose-700/60 text-rose-300'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                    <span className="capitalize">
                      {(subtopic.grounding_status || subtopic.evidence_status)?.replace('_', ' ')}
                    </span>
                  </div>
                )}
                {subtopic.source_location && (
                  <div className="px-2.5 py-1 bg-gray-800/80 border border-gray-700/80 rounded-lg flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span>
                      Location:{' '}
                      {typeof subtopic.source_location === 'object'
                        ? JSON.stringify(subtopic.source_location)
                        : subtopic.source_location}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 text-xs font-medium text-gray-200 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
