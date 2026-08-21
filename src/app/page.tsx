'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import FileUploader, { type UploadedFile } from '@/components/FileUploader';
import VersionGrid from '@/components/VersionGrid';
import FormatToggle from '@/components/FormatToggle';
import FilePreview from '@/components/FilePreview';
import SetupGuide from '@/components/SetupGuide';
import CrsSelector from '@/components/CrsSelector';

type OutputFormat = 'DWG' | 'DXF' | 'SHP';

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('DWG');
  const [odaInstalled, setOdaInstalled] = useState<boolean | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionDone, setConversionDone] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [targetCRS, setTargetCRS] = useState<string>('');
  const [lastConvertedCount, setLastConvertedCount] = useState<number>(0);

  // Check ODA installation on mount
  useEffect(() => {
    let cancelled = false;
    fetch('/api/check-oda')
      .then(res => res.json())
      .then(data => {
        if (cancelled) return;
        setOdaInstalled(data.installed);
      })
      .catch(() => {
        if (cancelled) return;
        setOdaInstalled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFilesAdded = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      if (prev.length > 0 && downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
      return [...prev, ...newFiles.map(f => ({
        id: generateId(),
        file: f,
        name: f.name,
        size: f.size,
        format: f.name.toLowerCase().endsWith('.dwg') ? 'DWG' as const : 'DXF' as const,
        status: 'pending' as const,
        progress: 0,
      }))];
    });
    setConversionDone(false);
    setDownloadUrl(null);
    setErrorMsg(null);

    // Set preview to first DXF file
    const firstDxf = newFiles.find(f => f.name.toLowerCase().endsWith('.dxf'));
    if (firstDxf && !previewFile) {
      setPreviewFile(firstDxf);
    }
  }, [previewFile, downloadUrl]);

  const handleFileRemove = useCallback((id: string) => {
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setFiles(prev => {
      const updated = prev.filter(f => f.id !== id);
      const removedFile = prev.find(f => f.id === id);
      if (removedFile && previewFile && removedFile.file === previewFile) {
        const nextDxf = updated.find(f => f.name.toLowerCase().endsWith('.dxf'));
        setPreviewFile(nextDxf?.file || null);
      }
      return updated;
    });
    setConversionDone(false);
    setDownloadUrl(null);
  }, [previewFile, downloadUrl]);

  const handleConvert = async () => {
    if (files.length === 0 || (!selectedVersion && outputFormat !== 'SHP')) return;

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }

    setIsConverting(true);
    setConversionDone(false);
    setDownloadUrl(null);
    setErrorMsg(null);
    setLastConvertedCount(files.length);

    // Update all files to converting status
    setFiles(prev => prev.map(f => ({ ...f, status: 'converting' as const, progress: 10 })));

    // Simulate incremental progress
    const progressInterval = setInterval(() => {
      setFiles(prev => prev.map(f => {
        if (f.status === 'converting' && f.progress < 85) {
          return { ...f, progress: f.progress + Math.random() * 8 };
        }
        return f;
      }));
    }, 500);

    const controller = new AbortController();

    try {
      const formData = new FormData();
      for (const f of files) {
        formData.append('files', f.file);
      }
      formData.append('targetVersion', selectedVersion || 'ACAD2010');
      formData.append('outputFormat', outputFormat);
      if (outputFormat === 'SHP' && targetCRS) {
        formData.append('targetCRS', targetCRS);
      }

      const response = await fetch('/api/convert', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        let errMessage = 'Konversi gagal';
        try {
          const errData = await response.json();
          errMessage = errData.error || errMessage;
        } catch {}
        throw new Error(errMessage);
      }

      // Get conversion results from header
      const resultsHeader = response.headers.get('X-Conversion-Results');
      let results: Array<{ name: string; success: boolean; error?: string }> = [];
      if (resultsHeader) {
        try { results = JSON.parse(resultsHeader); } catch {}
      }

      // Create download URL from response blob
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      // Determine filename
      const contentDisposition = response.headers.get('Content-Disposition');
      const defaultExt = outputFormat === 'SHP' ? 'zip' : outputFormat.toLowerCase();
      let filename = `converted_${selectedVersion || 'output'}.${defaultExt}`;
      if (contentDisposition) {
        // Prefer RFC 5987 filename* (UTF-8) for non-ASCII safety; fall back to ASCII filename=
        const starMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (starMatch) {
          try { filename = decodeURIComponent(starMatch[1]); } catch { filename = starMatch[1]; }
        } else {
          const match = contentDisposition.match(/filename="([^"]+)"/);
          if (match) filename = match[1];
        }
      }
      setDownloadName(filename);

      // Update file statuses
      setFiles(prev => prev.map(f => {
        const result = results.find(r => r.name === f.name);
        if (result) {
          return {
            ...f,
            status: result.success ? 'done' as const : 'error' as const,
            progress: 100,
            error: result.error,
          };
        }
        return { ...f, status: 'done' as const, progress: 100 };
      }));

      setConversionDone(true);

    } catch (err) {
      clearInterval(progressInterval);
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan';
      setErrorMsg(message);
      setFiles(prev => prev.map(f => ({
        ...f,
        status: 'error' as const,
        progress: 0,
        error: message,
      })));
    } finally {
      setIsConverting(false);
      controller.abort();
    }
  };

  const handleClearAll = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFiles([]);
    setConversionDone(false);
    setDownloadUrl(null);
    setDownloadName('');
    setErrorMsg(null);
    setPreviewFile(null);
  };

  const handleDownload = () => {
    if (downloadUrl && downloadName) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleReset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setFiles([]);
    setSelectedVersion(null);
    setOutputFormat('DWG');
    setConversionDone(false);
    setDownloadUrl(null);
    setDownloadName('');
    setErrorMsg(null);
    setPreviewFile(null);
  };

  const canConvert = files.length > 0 && (selectedVersion || outputFormat === 'SHP') && !isConverting && odaInstalled;

  return (
    <div className="page-wrapper">
      <Header />
      <main className="container" style={{ paddingTop: '24px', paddingBottom: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* ODA Setup Guide */}
        {odaInstalled === false && <SetupGuide />}

        {/* Loading ODA check */}
        {odaInstalled === null && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div className="spinner-large" style={{ margin: '0 auto' }} />
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>
              Mengecek instalasi ODA File Converter...
            </p>
          </div>
        )}

        {/* Main converter UI */}
        {odaInstalled !== null && (
          <>
            <div className="converter-layout">
              {/* Left Column: Upload & Preview */}
              <div className="converter-left">
                {/* File Upload */}
                <section className="section" style={{ marginTop: 0, animationDelay: '0.1s' }}>
                  <div className="section-header">
                    <h2 className="section-title">
                      <span className="section-title-icon">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </span>
                      Upload Files
                    </h2>
                    {files.length > 0 && (
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {files.length} file{files.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <FileUploader
                    files={files}
                    onFilesAdded={handleFilesAdded}
                    onFileRemove={handleFileRemove}
                    onClearAll={handleClearAll}
                  />
                </section>

                {/* Preview (for DXF files) */}
                {previewFile && (
                  <div style={{ marginTop: '32px' }}>
                    <FilePreview file={previewFile} />
                  </div>
                )}
              </div>

              {/* Right Column: Settings & Conversion */}
              <div className="converter-right">
                {/* Format Toggle */}
                <div>
                  <div className="settings-group-title">Output Format</div>
                  <FormatToggle
                    value={outputFormat}
                    onChange={setOutputFormat}
                  />
                </div>

                {/* Version Selection (Hidden for SHP because it's irrelevant) */}
                {outputFormat !== 'SHP' && (
                  <div>
                    <div className="settings-group-title">Target Version</div>
                    <VersionGrid
                      selectedVersion={selectedVersion}
                      onSelectVersion={setSelectedVersion}
                    />
                    <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Tentukan kompatibilitas versi AutoCAD untuk file hasil konversi.
                    </p>
                  </div>
                )}

                {/* CRS Selector (Only for SHP) */}
                {outputFormat === 'SHP' && (
                  <div>
                    <div className="settings-group-title">Sistem Proyeksi (CRS)</div>
                    <CrsSelector
                      value={targetCRS}
                      onChange={setTargetCRS}
                    />
                    <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      Membuat file .prj agar Shapefile berada di koordinat yang tepat.
                    </p>
                  </div>
                )}

                {/* Convert Button */}
                {!conversionDone && (
                  <div className="convert-section" style={{ marginTop: 0 }}>
                    <button
                      className="convert-btn"
                      disabled={!canConvert}
                      onClick={handleConvert}
                    >
                      {isConverting ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                          <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                          Converting...
                        </span>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 16 12 12 8 16" />
                            <line x1="12" y1="12" x2="12" y2="21" />
                            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                          </svg>
                          Convert
                        </span>
                      )}
                    </button>

                    {!odaInstalled && files.length > 0 && (
                      <p style={{ marginTop: '12px', color: 'var(--warning)', fontSize: '0.85rem' }}>
                        ⚠️ ODA File Converter belum terinstall. Install terlebih dahulu untuk mengkonversi file.
                      </p>
                    )}

                    {!selectedVersion && files.length > 0 && outputFormat !== 'SHP' && (
                      <p style={{ marginTop: '12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Pilih versi target di atas untuk melanjutkan
                      </p>
                    )}
                  </div>
                )}

                {/* Error Message */}
                {errorMsg && (
                  <div className="download-section" style={{ marginTop: 0 }}>
                    <div className="download-card" style={{ borderLeftColor: 'var(--error)' }}>
                      <div className="download-card-header">
                        <div className="download-card-icon" style={{ background: 'rgba(255, 68, 102, 0.15)' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--error)" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="15" y1="9" x2="9" y2="15" />
                            <line x1="9" y1="9" x2="15" y2="15" />
                          </svg>
                        </div>
                        <div>
                          <div className="download-card-title" style={{ color: 'var(--error)' }}>Konversi Gagal</div>
                          <div className="download-card-size" style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', marginTop: '8px' }}>{errorMsg}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Download Section */}
                {conversionDone && downloadUrl && (
                  <div className="download-section" style={{ marginTop: 0 }}>
                    <div className="download-card">
                      <div className="download-card-header">
                        <div className="download-card-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        </div>
                        <div>
                          <div className="download-card-title">Konversi Berhasil!</div>
                          <div className="download-card-size">
                            {files.filter(f => f.status === 'done').length} dari {lastConvertedCount} file berhasil dikonversi
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                        <button className="download-btn" onClick={handleDownload}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            Download {downloadName}
                          </span>
                        </button>
                        <button
                          className="download-btn"
                          onClick={handleReset}
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                        >
                          Konversi Baru
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '32px 0',
        marginTop: 'auto',
        borderTop: '1px solid var(--border-glass)',
        color: 'var(--text-muted)',
        fontSize: '0.8rem',
      }}>
        <p>CAD Converter {new Date().getFullYear()} — Open source by Pram</p>
        <p style={{ marginTop: '4px' }}>
          Mendukung semua versi AutoCAD dari R9 (1987) hingga 2018+
        </p>
      </footer>
    </div>
  );
}
