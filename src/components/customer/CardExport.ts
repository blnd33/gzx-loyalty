'use client';
import { toPng } from 'html-to-image';

/** Renders a card node to a high-resolution PNG and downloads it. */
export async function downloadNodeAsPng(node: HTMLElement, filename: string) {
  const dataUrl = await toPng(node, {
    pixelRatio: Math.max(2, 2022 / node.offsetWidth), // ≥ 600 dpi at 85.6 mm
    cacheBust: true,
    backgroundColor: 'transparent',
  });
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
