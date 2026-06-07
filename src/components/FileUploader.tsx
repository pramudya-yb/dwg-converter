'use client';

import React, { useCallback, useRef, useState } from 'react';

export interface UploadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  format: 'DWG' | 'DXF';
  status: 'pending' | 'converting' | 'done' | 'error';
  progress: number;
  error?: string;
  downloadUrl?: string;
}

interface FileUploaderProps {
  files: UploadedFile[];
  onFilesAdded: (files: File[]) => void;
  onFileRemove: (id: string) => void;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export default function FileUploader({ files, onFilesAdded, onFileRemove }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const filterValidFiles = (fileList: FileList | File[]): File[] => {
    const valid: File[] = [];
    const arr = Array.from(fileList);
    for (const file of arr) {
      const ext = file.name.toLowerCase();
      if (ext.endsWith('.dwg') || ext.endsWith('.dxf')) {
        valid.push(file);
      }
    }
    return valid;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    dragCounter.current = 0;

    const validFiles = filterValidFiles(e.dataTransfer.files);
    if (validFiles.length > 0) {
      onFilesAdded(validFiles);
    }
  }, [onFilesAdded]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const validFiles = filterValidFiles(e.target.files);
      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onFilesAdded]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    converting: '⚙️',
    done: '✅',
    error: '❌',
  };

  const statusTexts: Record<string, string> = {
    pending: 'Siap dikonversi',
    converting: 'Mengkonversi...',
    done: 'Selesai',
    error: 'Gagal',
  };

  return (
    <div>
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${files.length > 0 ? 'has-files' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="Upload area - click or drag files here"
      >
        <div className="upload-zone-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="upload-zone-text">
          {isDragOver ? 'Lepaskan file di sini...' : 'Klik atau seret file DWG/DXF ke sini'}
        </p>
        <p className="upload-zone-hint">Mendukung batch upload — pilih banyak file sekaligus</p>
        <div className="upload-zone-formats">
          <span className="format-badge">.DWG</span>
          <span className="format-badge">.DXF</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".dwg,.dxf"
          multiple
          onChange={handleFileInput}
          style={{ display: 'none' }}
          aria-hidden="true"
        />
      </div>

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f) => (
            <div key={f.id} className="file-item">
              <div className="file-item-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
              </div>
              <div className="file-item-info">
                <div className="file-item-name">{f.name}</div>
                <div className="file-item-meta">
                  {formatFileSize(f.size)} • {f.format}
                </div>
                {f.status === 'converting' && f.progress > 0 && (
                  <div className="file-item-progress">
                    <div
                      className="file-item-progress-bar"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <div className={`file-item-status ${f.status}`}>
                <span>{statusIcons[f.status]}</span>
                <span>{f.error || statusTexts[f.status]}</span>
              </div>
              {(f.status === 'pending' || f.status === 'error') && (
                <button
                  className="file-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    onFileRemove(f.id);
                  }}
                  title="Hapus file"
                  aria-label={`Remove ${f.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
