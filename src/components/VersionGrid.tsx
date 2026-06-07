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
    <div className="custom-select-wrapper">
      <select
        className="custom-select"
        value={selectedVersion || ''}
        onChange={(e) => onSelectVersion(e.target.value)}
        aria-label="Pilih Versi Target"
      >
        <option value="" disabled>-- Pilih Versi AutoCAD --</option>
        {VERSIONS.map((version) => (
          <option key={version.code} value={version.code}>
            {version.name} ({version.year}) - {version.acadver}
          </option>
        ))}
      </select>
      <div className="custom-select-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}

export { VERSIONS };
