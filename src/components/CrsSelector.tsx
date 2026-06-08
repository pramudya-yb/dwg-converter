'use client';

import React from 'react';

interface CrsSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

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
    <div className="custom-select-wrapper">
      <select
        className="custom-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
      <div className="custom-select-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
