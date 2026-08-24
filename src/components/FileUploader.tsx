'use client';

import React, { useCallback, useRef, useState } from 'react';
import { formatFileSize } from '@/lib/format';

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
  onClearAll?: () => void;
}

export default function FileUploader({ files, onFilesAdded, onFileRemove, onClearAll }: FileUploaderProps) {
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

  const statusIcons: Record<UploadedFile['status'], string> = {
    pending: '⏳',
    converting: '⚙️',
    done: '✅',
    error: '❌',
  };

  const statusTexts: Record<UploadedFile['status'], string> = {
    pending: 'Siap dikonversi',
    converting: 'Mengkonversi...',
    done: 'Selesai',
    error: 'Gagal',
  };

  return (
    <div>
      <div
        className={`upload-zone ${isDragOver ? 'drag-over' : ''} ${files.length > 0 ? 'compact' : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Upload area - click or drag files here"
        style={files.length > 0 ? { minHeight: '80px', padding: '16px', flexDirection: 'row', gap: '16px', borderStyle: 'dashed' } : {}}
      >
        <div className="upload-zone-icon" style={files.length > 0 ? { width: '40px', height: '40px', margin: '0' } : {}}>
          <svg width={files.length > 0 ? "20" : "40"} height={files.length > 0 ? "20" : "40"} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <div style={files.length > 0 ? { textAlign: 'left', flex: 1 } : {}}>
          <p className="upload-zone-text" style={files.length > 0 ? { fontSize: '1rem', margin: 0 } : {}}>
            {isDragOver ? 'Lepaskan file di sini...' : (files.length > 0 ? 'Tambah file lagi (+)' : 'Klik atau seret file DWG/DXF ke sini')}
          </p>
          {files.length === 0 && (
            <>
              <p className="upload-zone-hint">Mendukung batch upload — pilih banyak file sekaligus</p>
              <div className="upload-zone-formats">
                <span className="format-badge">.DWG</span>
                <span className="format-badge">.DXF</span>
              </div>
            </>
          )}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px 0' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Daftar Antrean ({files.length})</span>
          {onClearAll && (
            <button 
              onClick={(e) => { e.stopPropagation(); onClearAll(); }}
              style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.85rem', cursor: 'pointer', padding: '4px 8px', opacity: 0.8 }}
              onMouseOver={e => e.currentTarget.style.opacity = '1'}
              onMouseOut={e => e.currentTarget.style.opacity = '0.8'}
            >
              Hapus Semua
            </button>
          )}
        </div>
      )}

      {files.length > 0 && (
        <div className="file-list">
          {files.map((f) => (
            <div key={f.id} className="file-item">
              <div className="file-item-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
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
