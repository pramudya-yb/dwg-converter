'use client';

import React from 'react';

type OutputFormat = 'DWG' | 'DXF' | 'SHP';

interface FormatToggleProps {
  value: OutputFormat;
  onChange: (format: OutputFormat) => void;
}

export default function FormatToggle({ value, onChange }: FormatToggleProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-title-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          </span>
          Format Output
        </h2>
      </div>
      <div className="format-toggle" role="radiogroup" aria-label="Output format selection">
        <button
          className={`format-toggle-btn ${value === 'DWG' ? 'active' : ''}`}
          onClick={() => onChange('DWG')}
          role="radio"
          aria-checked={value === 'DWG'}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            .DWG
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7, marginTop: '2px' }}>Binary Drawing</span>
        </button>
        <button
          className={`format-toggle-btn ${value === 'DXF' ? 'active' : ''}`}
          onClick={() => onChange('DXF')}
          role="radio"
          aria-checked={value === 'DXF'}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            .DXF
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7, marginTop: '2px' }}>Drawing Exchange</span>
        </button>
        <button
          className={`format-toggle-btn ${value === 'SHP' ? 'active' : ''}`}
          onClick={() => onChange('SHP')}
          role="radio"
          aria-checked={value === 'SHP'}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            .SHP
          </span>
          <span style={{ display: 'block', fontSize: '0.7rem', opacity: 0.7, marginTop: '2px' }}>ESRI Shapefile</span>
        </button>
      </div>
    </div>
  );
}
