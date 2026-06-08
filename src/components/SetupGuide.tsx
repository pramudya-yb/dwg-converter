'use client';

import React from 'react';

export default function SetupGuide() {
  return (
    <div className="setup-guide">
      <div className="setup-guide-header">
        <div className="setup-guide-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ffd000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <div>
          <h3 className="setup-guide-title">ODA File Converter Diperlukan</h3>
          <p className="setup-guide-desc">
            Untuk mengkonversi file DWG/DXF, Anda perlu menginstall ODA File Converter terlebih dahulu. 
            Ini adalah tool gratis dari Open Design Alliance.
          </p>
        </div>
      </div>

      <div className="setup-steps">
        <div className="setup-step">
          <h4 className="setup-step-title">Download ODA File Converter</h4>
          <p className="setup-step-desc">
            Kunjungi halaman download resmi dan pilih versi untuk sistem operasi Anda:
            <br />
            <a href="https://www.opendesign.com/guestfiles/oda_file_converter" target="_blank" rel="noopener noreferrer">
              www.opendesign.com/guestfiles/oda_file_converter
            </a>
          </p>
        </div>

        <div className="setup-step">
          <h4 className="setup-step-title">Install Aplikasi</h4>
          <p className="setup-step-desc">
            Jalankan installer yang sudah di-download. Ikuti instruksi instalasi default.
            Biasanya terinstall di <code>C:\Program Files\ODA\ODAFileConverter\</code>
          </p>
        </div>

        <div className="setup-step">
          <h4 className="setup-step-title">Restart Aplikasi Ini</h4>
          <p className="setup-step-desc">
            Setelah ODA File Converter terinstall, klik tombol di bawah untuk mengecek ulang.
            Aplikasi akan otomatis mendeteksi instalasi ODA.
          </p>
        </div>
      </div>

      <div className="setup-guide-alt">
        <h4 className="setup-step-title" style={{ marginBottom: '8px' }}>💡 Alternatif: Set Environment Variable</h4>
        <p className="setup-step-desc">
          Jika ODA terinstall di lokasi non-standar, set environment variable:
        </p>
        <code className="setup-code-block">
          ODA_CONVERTER_PATH=&quot;C:\path\to\ODAFileConverter.exe&quot;
        </code>
      </div>

      <button
        className="setup-guide-btn"
        onClick={() => window.location.reload()}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Cek Ulang Instalasi
        </span>
      </button>
    </div>
  );
}
