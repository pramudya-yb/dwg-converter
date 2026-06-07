'use client';

import React from 'react';

export interface VersionInfo {
  code: string;
  name: string;
  year: string;
  acadver: string;
}

const VERSIONS: VersionInfo[] = [
  { code: 'ACAD9', name: 'AutoCAD R9', year: '1987', acadver: 'AC1004' },
  { code: 'ACAD10', name: 'AutoCAD R10', year: '1988', acadver: 'AC1006' },
  { code: 'ACAD12', name: 'AutoCAD R12', year: '1992', acadver: 'AC1009' },
  { code: 'ACAD13', name: 'AutoCAD R13', year: '1994', acadver: 'AC1012' },
  { code: 'ACAD14', name: 'AutoCAD R14', year: '1997', acadver: 'AC1014' },
  { code: 'ACAD2000', name: 'AutoCAD 2000', year: '1999', acadver: 'AC1015' },
  { code: 'ACAD2004', name: 'AutoCAD 2004', year: '2003', acadver: 'AC1018' },
  { code: 'ACAD2007', name: 'AutoCAD 2007', year: '2006', acadver: 'AC1021' },
  { code: 'ACAD2010', name: 'AutoCAD 2010', year: '2009', acadver: 'AC1024' },
  { code: 'ACAD2013', name: 'AutoCAD 2013', year: '2012', acadver: 'AC1027' },
  { code: 'ACAD2018', name: 'AutoCAD 2018', year: '2017', acadver: 'AC1032' },
];

interface VersionGridProps {
  selectedVersion: string | null;
  onSelectVersion: (code: string) => void;
}

export default function VersionGrid({ selectedVersion, onSelectVersion }: VersionGridProps) {
  return (
    <div className="section">
      <div className="section-header">
        <h2 className="section-title">
          <span className="section-title-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
          </span>
          Pilih Versi Target
        </h2>
      </div>
      <div className="version-grid">
        {VERSIONS.map((version) => (
          <button
            key={version.code}
            className={`version-card ${selectedVersion === version.code ? 'selected' : ''}`}
            onClick={() => onSelectVersion(version.code)}
            aria-pressed={selectedVersion === version.code}
            aria-label={`${version.name} (${version.year})`}
          >
            <div className="version-card-name">{version.name}</div>
            <div className="version-card-code">{version.acadver}</div>
            <div className="version-card-year">{version.year}</div>
            <div className="version-card-check">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export { VERSIONS };
