import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onDismiss }) => {
  return (
    <div
      role="alert"
      className="flex items-start justify-between p-4 my-3 text-sm text-red-200 bg-red-950/70 border border-red-800 rounded-xl backdrop-blur shadow-lg transition-all"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
        <div className="leading-relaxed">
          <p className="font-semibold text-red-300">Action Failed</p>
          <p className="text-red-200/90 text-xs mt-0.5">{message}</p>
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-red-400 hover:text-red-200 p-1 rounded-lg hover:bg-red-900/50 transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
