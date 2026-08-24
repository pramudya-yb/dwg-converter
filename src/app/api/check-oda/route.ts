import { NextResponse } from 'next/server';
import { findODAConverter, AUTOCAD_VERSIONS, resetODAConverterCache } from '@/lib/oda-converter';

export async function GET() {
  try {
    resetODAConverterCache();
    const odaPath = await findODAConverter();
    const externalUrl = process.env.EXTERNAL_CONVERTER_URL;

    let externalAvailable = false;
    if (externalUrl) {
      try {
        const cleanUrl = externalUrl.replace(/\/+$/, '');
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${cleanUrl}/api/check-oda`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
          const data = await response.json();
          externalAvailable = !!data.installed;
        }
      } catch {}
    }

    return NextResponse.json({
      installed: !!odaPath || externalAvailable,
      localOda: !!odaPath,
      externalAvailable,
      path: odaPath,
      versions: AUTOCAD_VERSIONS,
    });
  } catch {
    return NextResponse.json(
      { installed: false, localOda: false, externalAvailable: false, error: 'Failed to check ODA installation' },
      { status: 500 }
    );
  }
}
