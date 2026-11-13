import React, { useState } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Download,
  ExternalLink,
  Eye,
  File,
  Code,
  Music,
  Film,
  X,
  Check
} from 'lucide-react';

export const isImageFile = (file) => {
  if (!file) return false;
  if (file.type && file.type.startsWith('image/')) return true;
  const name = file.name || file.fileName || file.url || '';
  return /\.(jpe?g|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(name);
};

export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileUrl = (file) => {
  if (!file) return '';
  if (typeof file === 'string') return file;
  if (file.url) {
    if (
      file.url.startsWith('http://') ||
      file.url.startsWith('https://') ||
      file.url.startsWith('blob:') ||
      file.url.startsWith('data:')
    ) {
      return file.url;
    }
    const apiHost = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
    return `${apiHost}${file.url.startsWith('/') ? '' : '/'}${file.url}`;
  }
  if (file.dataUrl) return file.dataUrl;
  if (typeof window !== 'undefined' && file instanceof Blob) {
    try {
      return URL.createObjectURL(file);
    } catch {
      return '';
    }
  }
  return '';
};

// Fullscreen Image Lightbox Modal
export const ImageLightboxModal = ({ file, isOpen, onClose }) => {
  if (!isOpen || !file) return null;

  const url = getFileUrl(file);
  const fileName = file.name || file.fileName || 'Image';
  const sizeText = formatFileSize(file.size);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-5xl max-h-[90vh] w-full flex flex-col items-center select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar controls */}
        <div className="w-full flex items-center justify-between text-white/90 mb-3 px-2">
          <div className="truncate min-w-0 pr-4">
            <h4 className="text-sm font-semibold truncate">{fileName}</h4>
            {sizeText && <p className="text-xs text-white/60">{sizeText}</p>}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {url && (
              <>
                <a
                  href={url}
                  download={fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition flex items-center gap-1.5 text-xs"
                  title="Download Image"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Download</span>
                </a>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                  title="Open Original in New Tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition"
              title="Close Preview (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Full Image */}
        <div className="relative rounded-2xl overflow-hidden max-h-[80vh] flex items-center justify-center border border-white/10 shadow-2xl bg-black/40">
          <img
            src={url}
            alt={fileName}
            className="max-h-[80vh] max-w-full w-auto h-auto object-contain select-none"
          />
        </div>
      </div>
    </div>
  );
};

// Main Chat Attachment Renderer
const ChatAttachment = ({ file, isMe = false, onOpenLightbox }) => {
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!file) return null;

  const isImage = isImageFile(file);
  const url = getFileUrl(file);
  const fileName = file.name || file.fileName || 'Attachment';
  const sizeText = formatFileSize(file.size);
  const ext = fileName.split('.').pop()?.toUpperCase() || 'FILE';
  const isCloudinary = Boolean(
    file.storageProvider === 'cloudinary' || (url && url.includes('cloudinary.com'))
  );

  const handleDownloadClick = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2000);
  };

  // 1. Image Card Presentation
  if (isImage) {
    return (
      <div className="mb-2 max-w-sm sm:max-w-md">
        <div
          onClick={() => onOpenLightbox && onOpenLightbox(file)}
          className={`relative rounded-2xl overflow-hidden border cursor-pointer group transition-all duration-200 shadow-sm ${
            isMe
              ? 'border-white/20 bg-black/20 hover:border-white/40'
              : 'border-slate-200 dark:border-dark-750 bg-slate-100 dark:bg-dark-850 hover:border-brand-500/40'
          }`}
        >
          {/* Image Thumbnail */}
          <div className="relative flex items-center justify-center min-h-[140px] max-h-72 sm:max-h-80 overflow-hidden bg-slate-900/10 dark:bg-black/30">
            <img
              src={url}
              alt={fileName}
              loading="lazy"
              onLoad={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('nx-chat-attachment-loaded'));
                }
              }}
              className="w-full h-auto max-h-72 sm:max-h-80 object-cover group-hover:scale-102 transition duration-300"
            />

            {/* Hover overlay with action icons */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2.5">
              <div className="flex items-center justify-end gap-1.5 self-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenLightbox) onOpenLightbox(file);
                  }}
                  className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm transition"
                  title="View Full Size"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
                {url && (
                  <a
                    href={url}
                    download={fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadClick();
                    }}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white backdrop-blur-sm transition"
                    title="Download Image"
                  >
                    {downloadSuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                  </a>
                )}
              </div>

              {/* Bottom info pill */}
              <div className="flex items-center justify-between text-[11px] text-white/90 truncate">
                <span className="truncate font-medium">{fileName}</span>
                {sizeText && <span className="shrink-0 text-white/70 ml-2">{sizeText}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. Non-Image File Card Presentation (PDF, Document, Code, Archive, etc.)
  let IconComponent = FileText;
  let iconTheme = 'bg-blue-500/15 text-blue-600 dark:text-blue-400';

  if (/\.(pdf)$/i.test(fileName)) {
    IconComponent = FileText;
    iconTheme = 'bg-rose-500/15 text-rose-600 dark:text-rose-400';
  } else if (/\.(zip|tar|gz|7z|rar)$/i.test(fileName)) {
    IconComponent = File;
    iconTheme = 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  } else if (/\.(js|jsx|ts|tsx|json|html|css|py|sql|sh)$/i.test(fileName)) {
    IconComponent = Code;
    iconTheme = 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400';
  } else if (/\.(mp3|wav|ogg|m4a)$/i.test(fileName)) {
    IconComponent = Music;
    iconTheme = 'bg-purple-500/15 text-purple-600 dark:text-purple-400';
  } else if (/\.(mp4|webm|mov|mkv)$/i.test(fileName)) {
    IconComponent = Film;
    iconTheme = 'bg-violet-500/15 text-violet-600 dark:text-violet-400';
  }

  return (
    <div className="mb-2 max-w-sm sm:max-w-md">
      <div
        className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all shadow-subtle ${
          isMe
            ? 'bg-white/10 border-white/20 text-white'
            : 'bg-white dark:bg-dark-850 border-slate-200/90 dark:border-dark-750 text-slate-800 dark:text-slate-100'
        }`}
      >
        {/* Left File Icon */}
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isMe ? 'bg-white/20 text-white' : iconTheme
          }`}
        >
          <IconComponent className="w-5 h-5" />
        </div>

        {/* Middle File Info */}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate leading-tight">{fileName}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-[10px] opacity-75">
            <span className="font-mono font-medium px-1 rounded bg-black/10 dark:bg-white/10">
              {ext}
            </span>
            {sizeText && <span>• {sizeText}</span>}
            {isCloudinary && <span className="text-emerald-400 font-semibold">• Cloud</span>}
          </div>
        </div>

        {/* Right Action Buttons */}
        {url && (
          <div className="flex items-center gap-1 shrink-0">
            <a
              href={url}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDownloadClick}
              className={`p-2 rounded-xl transition ${
                isMe
                  ? 'hover:bg-white/20 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-dark-750 text-slate-600 dark:text-slate-300 hover:text-brand-600'
              }`}
              title="Download File"
            >
              {downloadSuccess ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </a>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-xl transition ${
                isMe
                  ? 'hover:bg-white/20 text-white'
                  : 'hover:bg-slate-100 dark:hover:bg-dark-750 text-slate-600 dark:text-slate-300 hover:text-brand-600'
              }`}
              title="Open File in New Tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatAttachment;
