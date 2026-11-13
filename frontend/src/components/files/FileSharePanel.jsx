import React, { useState, useRef } from 'react';
import {
  X,
  UploadCloud,
  File,
  FileText,
  Image as ImageIcon,
  Archive,
  Code,
  Music,
  Video as VideoIcon,
  Download,
  Eye,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatFileSize, formatTime } from '../../utils/formatters';
import FilePreviewModal from './FilePreviewModal';

const getFileIcon = (mimeType = '', originalName = '') => {
  const ext = originalName.split('.').pop()?.toLowerCase();

  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
    return <ImageIcon className="w-5 h-5 text-indigo-400" />;
  }
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return <FileText className="w-5 h-5 text-rose-400" />;
  }
  if (['zip', 'rar', 'tar', 'gz', '7z'].includes(ext)) {
    return <Archive className="w-5 h-5 text-amber-400" />;
  }
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'cpp', 'sql', 'md'].includes(ext)) {
    return <Code className="w-5 h-5 text-emerald-400" />;
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg'].includes(ext)) {
    return <Music className="w-5 h-5 text-purple-400" />;
  }
  if (mimeType.startsWith('video/') || ['mp4', 'webm', 'mov'].includes(ext)) {
    return <VideoIcon className="w-5 h-5 text-cyan-400" />;
  }
  return <File className="w-5 h-5 text-slate-400" />;
};

const isPreviewable = (mimeType = '', originalName = '') => {
  const ext = originalName.split('.').pop()?.toLowerCase();
  return (
    mimeType.startsWith('image/') ||
    mimeType === 'application/pdf' ||
    ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'pdf'].includes(ext)
  );
};

const FileSharePanel = ({
  isOpen,
  onClose,
  files = [],
  onUploadFiles,
  onDeleteFile,
  currentUserId,
  isHost = false,
  meetingId
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // null | { percentage, fileName, totalFiles }
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'images' | 'documents'
  const [previewFile, setPreviewFile] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      processUpload(droppedFiles);
    }
  };

  const handleFileInputChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length > 0) {
      processUpload(selectedFiles);
    }
    // Reset file input value so re-selecting same files triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processUpload = async (fileList) => {
    setUploadError('');
    setUploadSuccess('');

    // Check file count
    if (fileList.length > 10) {
      setUploadError('You can upload a maximum of 10 files at a time.');
      return;
    }

    // Check individual file size (25MB)
    const MAX_SIZE = 25 * 1024 * 1024;
    const oversized = fileList.find((f) => f.size > MAX_SIZE);
    if (oversized) {
      setUploadError(`File "${oversized.name}" exceeds the 25MB limit.`);
      return;
    }

    const formData = new FormData();
    fileList.forEach((file) => {
      formData.append('files', file);
    });

    try {
      setUploadProgress({
        percentage: 0,
        fileName: fileList.length === 1 ? fileList[0].name : `${fileList.length} files`,
        totalFiles: fileList.length
      });

      await onUploadFiles(formData, (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        setUploadProgress((prev) => ({
          ...prev,
          percentage: percentCompleted
        }));
      });

      setUploadSuccess(`Successfully shared ${fileList.length > 1 ? `${fileList.length} files` : fileList[0].name}!`);
      setTimeout(() => setUploadSuccess(''), 4000);
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'File upload failed');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDownload = (file) => {
    const fileId = file.fileId || file.id;
    const url = `/api/meetings/${meetingId}/files/${fileId}/download`;
    // Create temporary link to trigger native browser download
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', file.originalName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter files by tab and search
  const filteredFiles = files.filter((file) => {
    // Search query match
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = file.originalName?.toLowerCase().includes(q);
      const senderMatch = file.uploaderName?.toLowerCase().includes(q);
      if (!nameMatch && !senderMatch) return false;
    }

    // Tab filter
    if (activeTab === 'images') {
      const isImg = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.originalName);
      if (!isImg) return false;
    } else if (activeTab === 'documents') {
      const isDoc =
        file.mimeType === 'application/pdf' ||
        /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|rtf)$/i.test(file.originalName);
      if (!isDoc) return false;
    }

    return true;
  });

  return (
    <>
      <div className="fixed right-0 top-16 bottom-24 w-full sm:w-85 md:w-96 bg-dark-900/95 backdrop-blur-xl border-l border-slate-800 z-30 flex flex-col shadow-2xl transition-all duration-300">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Meeting Files</h3>
              <span className="text-[10px] text-slate-400">{files.length} shared items</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            title="Close File Drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drag-and-Drop Upload Dropzone */}
        <div className="p-3 border-b border-slate-800/80 bg-dark-950/40">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-3.5 flex flex-col items-center justify-center text-center transition cursor-pointer ${
              isDragging
                ? 'border-brand-500 bg-brand-500/10'
                : 'border-slate-750 hover:border-brand-500/60 hover:bg-slate-850/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
            <UploadCloud className={`w-6 h-6 mb-1 ${isDragging ? 'text-brand-400 animate-bounce' : 'text-slate-400'}`} />
            <p className="text-xs font-semibold text-slate-200">
              Drag & drop files or <span className="text-brand-400 underline">browse</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Supports documents, images, code & archives (Max 25MB)
            </p>
          </div>

          {/* Upload Progress Bar */}
          {uploadProgress && (
            <div className="mt-2.5 p-2.5 bg-slate-850 border border-slate-750 rounded-xl space-y-1.5 animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300 truncate max-w-[200px]">
                  Uploading {uploadProgress.fileName}...
                </span>
                <span className="font-mono text-brand-400 font-bold">{uploadProgress.percentage}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-750 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-indigo-500 transition-all duration-200 rounded-full"
                  style={{ width: `${uploadProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Alerts */}
          {uploadError && (
            <div className="mt-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-center gap-2 text-rose-300 text-xs animate-fade-in">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{uploadError}</span>
            </div>
          )}
          {uploadSuccess && (
            <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2 text-emerald-300 text-xs animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{uploadSuccess}</span>
            </div>
          )}
        </div>

        {/* Filter Tabs and Search Bar */}
        <div className="px-3 py-2 border-b border-slate-800/80 bg-dark-950/60 space-y-2">
          {/* Search */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shared files..."
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 p-0.5 rounded text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                activeTab === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({files.length})
            </button>
            <button
              onClick={() => setActiveTab('images')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                activeTab === 'images'
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                activeTab === 'documents'
                  ? 'bg-brand-600/30 text-brand-300 border border-brand-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Docs
            </button>
          </div>
        </div>

        {/* Files Stream List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredFiles.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <File className="w-10 h-10 mb-2 opacity-30 text-brand-400" />
              <p className="text-xs font-medium">
                {searchQuery ? 'No files match your search' : 'No files shared yet'}
              </p>
              <p className="text-[11px] text-slate-600 mt-1">
                Drop your assets above to share them with the room!
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const fileId = file.fileId || file.id;
              const isUploader = file.uploaderId === currentUserId;
              const canDelete = isUploader || isHost;
              const canPreview = isPreviewable(file.mimeType, file.originalName);

              return (
                <div
                  key={fileId}
                  className="group relative p-2.5 bg-slate-850/80 hover:bg-slate-800 border border-slate-750/70 hover:border-slate-700 rounded-xl transition shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    {/* Icon & File Info */}
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-slate-900 border border-slate-750 shrink-0">
                        {getFileIcon(file.mimeType, file.originalName)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-xs font-semibold text-slate-100 truncate group-hover:text-brand-300 transition"
                          title={file.originalName}
                        >
                          {file.originalName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                          <span className="font-medium text-slate-300">{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span className="truncate">by {isUploader ? 'You' : file.uploaderName}</span>
                          <span>•</span>
                          <span>{formatTime(file.createdAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {canPreview && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer"
                          title="Preview File"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(file)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-brand-300 hover:bg-slate-700 transition cursor-pointer"
                        title="Download File"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${file.originalName}" from meeting files?`)) {
                              onDeleteFile(fileId);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          title="Delete File"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Inline Preview Lightbox / Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          isOpen={Boolean(previewFile)}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />
      )}
    </>
  );
};

export default FileSharePanel;

