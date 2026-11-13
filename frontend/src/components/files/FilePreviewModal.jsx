import React, { useEffect } from 'react';
import { X, Download, FileText, ExternalLink } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

const FilePreviewModal = ({ file, isOpen, onClose, onDownload }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const isImage = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.originalName);
  const isPdf = file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.originalName);

  const previewUrl = `/api/meetings/${file.meetingId}/files/${file.fileId || file.id}/preview`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-dark-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-dark-950/50">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="p-2 bg-brand-500/10 text-brand-400 rounded-lg shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="truncate">
              <h3 className="text-sm font-semibold text-white truncate" title={file.originalName}>
                {file.originalName}
              </h3>
              <p className="text-xs text-slate-400">
                Shared by <span className="text-slate-200">{file.uploaderName}</span> • {formatFileSize(file.size)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onDownload(file)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-brand-600 hover:bg-brand-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Download File"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/60 min-h-[300px]">
          {isImage ? (
            <div className="relative max-w-full max-h-[70vh] flex items-center justify-center">
              <img
                src={previewUrl}
                alt={file.originalName}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg border border-slate-800"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full h-[70vh] rounded-lg overflow-hidden border border-slate-800 bg-white">
              <iframe
                src={`${previewUrl}#toolbar=1`}
                title={file.originalName}
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="text-center p-8 space-y-3">
              <FileText className="w-16 h-16 text-slate-600 mx-auto" />
              <h4 className="text-sm font-medium text-slate-300">Inline preview not supported for this file format</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                You can download the file directly to view it on your device.
              </p>
              <button
                onClick={() => onDownload(file)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 text-white hover:bg-brand-500 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download {file.originalName}</span>
              </button>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 border-t border-slate-800/80 bg-dark-950/40 text-[11px] text-slate-500 flex items-center justify-between">
          <span>Format: {file.mimeType || file.extension || 'Binary'}</span>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-400 flex items-center gap-1 transition"
          >
            <span>Open in new tab</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;

