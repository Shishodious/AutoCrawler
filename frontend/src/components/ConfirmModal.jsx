import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !isLoading) onConfirm();
  };

  React.useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, isLoading]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-md rounded-2xl p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center w-11 h-11 rounded-xl bg-danger/15 text-danger">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <p className="mb-6 leading-relaxed text-gray-300">{message}</p>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl border border-hairline bg-dark/60 px-4 py-2 font-medium text-gray-200 transition-colors hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-danger px-4 py-2 font-semibold text-white shadow-lg shadow-danger/25 transition-all hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
