'use client';

import React from 'react';

interface CrsSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

const TM3_ZONES = [
  { label: 'Zona 46.1', epsg: 'EPSG:23830' },
  { label: 'Zona 46.2', epsg: 'EPSG:23831' }, // Wait, checking EPSG list: 46.2 is 23830? Let me use exact names.
];

// Re-defining exactly based on DGN95 EPSG lookup:
const CRS_OPTIONS = [
  { group: 'Global', options: [
    { label: 'Tidak Ada (Bawaan File)', value: '' },
    { label: 'WGS 84 (EPSG:4326)', value: 'EPSG:4326' },
    { label: 'WGS 84 / Pseudo-Mercator (EPSG:3857)', value: 'EPSG:3857' },
  ]},
  { group: 'Indonesia TM-3 (DGN95)', options: [
    { label: 'TM-3 Zona 46.2 (EPSG:23830)', value: 'EPSG:23830' },
    { label: 'TM-3 Zona 47.1 (EPSG:23831)', value: 'EPSG:23831' },
    { label: 'TM-3 Zona 47.2 (EPSG:23832)', value: 'EPSG:23832' },
    { label: 'TM-3 Zona 48.1 (EPSG:23833)', value: 'EPSG:23833' },
    { label: 'TM-3 Zona 48.2 (EPSG:23834)', value: 'EPSG:23834' },
    { label: 'TM-3 Zona 49.1 (EPSG:23835)', value: 'EPSG:23835' },
    { label: 'TM-3 Zona 49.2 (EPSG:23836)', value: 'EPSG:23836' },
    { label: 'TM-3 Zona 50.1 (EPSG:23837)', value: 'EPSG:23837' },
    { label: 'TM-3 Zona 50.2 (EPSG:23838)', value: 'EPSG:23838' },
    { label: 'TM-3 Zona 51.1 (EPSG:23839)', value: 'EPSG:23839' },
    { label: 'TM-3 Zona 51.2 (EPSG:23840)', value: 'EPSG:23840' },
    { label: 'TM-3 Zona 52.1 (EPSG:23841)', value: 'EPSG:23841' },
    { label: 'TM-3 Zona 52.2 (EPSG:23842)', value: 'EPSG:23842' },
    { label: 'TM-3 Zona 53.1 (EPSG:23843)', value: 'EPSG:23843' },
    { label: 'TM-3 Zona 53.2 (EPSG:23844)', value: 'EPSG:23844' },
    { label: 'TM-3 Zona 54.1 (EPSG:23845)', value: 'EPSG:23845' },
  ]}
];

export default function CrsSelector({ value, onChange }: CrsSelectorProps) {
  return (
    <div className="section" style={{ marginTop: '24px' }}>
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <h2 className="section-title">
          <span className="section-title-icon" style={{ background: 'rgba(0, 245, 212, 0.15)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-tertiary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </span>
          Sistem Proyeksi (CRS)
        </h2>
      </div>
      
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 16px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-glass)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            outline: 'none',
            cursor: 'pointer',
            appearance: 'none'
          }}
        >
          {CRS_OPTIONS.map((group, idx) => (
            <optgroup key={idx} label={group.group}>
              {group.options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
      <p style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Membuat file .prj agar Shapefile berada di koordinat yang tepat.
      </p>
    </div>
  );
}
