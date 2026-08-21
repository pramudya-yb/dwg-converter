import { NextResponse } from 'next/server';
import { findODAConverter, AUTOCAD_VERSIONS, resetODAConverterCache } from '@/lib/oda-converter';

export async function GET() {
  try {
    const externalUrl = process.env.EXTERNAL_CONVERTER_URL;
    if (externalUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(`${externalUrl}/api/check-oda`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data);
        }
      } catch {}
      return NextResponse.json({ installed: false, error: 'External converter unavailable' });
    }

    // Always re-detect so freshly-installed ODA is picked up.
    resetODAConverterCache();
    const odaPath = await findODAConverter();

    return NextResponse.json({
      installed: !!odaPath,
      path: odaPath,
      versions: AUTOCAD_VERSIONS,
    });
  } catch {
    return NextResponse.json(
      { installed: false, error: 'Failed to check ODA installation' },
      { status: 500 }
    );
  }
}
