import type {DevNoteContext} from '../hooks/useDevNotes';

/** Marks the widget's own DOM so it is never picked or captured. */
export const DEV_NOTES_ATTR = 'data-devnotes-ui';
const MAX_SCREENSHOT_CHARS = 880_000;

const clip = (value: string | null | undefined, max: number) => {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};

/** CSS-module names lose their hash (`_sheet_1oqgq_31` → `sheet`) so they can be grepped in the source. */
const readableClass = (el: Element) => el.classList[0]?.replace(/^_(.+)_[a-z0-9]{5}_\d+$/i, '$1');

function selectorPath(el: Element): string {
  const parts: string[] = [];
  for (let node: Element | null = el; node && node !== document.body && parts.length < 6; node = node.parentElement) {
    const cls = readableClass(node);
    parts.unshift(`${node.tagName.toLowerCase()}${cls ? `.${cls}` : ''}`);
  }
  return parts.join(' > ');
}

/** Nearest section titles, innermost first: usually card → modal → page. */
function nearbyHeadings(el: Element): string[] {
  const found: string[] = [];
  for (let node: Element | null = el; node && found.length < 4; node = node.parentElement) {
    const heading = node.matches('h1, h2, h3') ? node : node.querySelector(':scope h1, :scope h2, :scope h3');
    const text = clip(heading?.textContent, 120);
    if (text && !found.includes(text)) found.push(text);
  }
  return found;
}

function modalTitle(el: Element): string | undefined {
  const dialog = el.closest('[role="dialog"], [class*="sheet"], [class*="modal"], [class*="Modal"]');
  return clip(dialog?.querySelector('h2, h3')?.textContent, 120) || undefined;
}

export function describeTarget(el: Element | null, extra: {tab: string; language: string}): DevNoteContext {
  const base: DevNoteContext = {
    tab: extra.tab,
    url: clip(`${location.pathname}${location.search}`, 500),
    viewport: {width: innerWidth, height: innerHeight, dpr: devicePixelRatio || 1},
    theme: document.documentElement.getAttribute('data-theme') ?? undefined,
    language: extra.language,
    userAgent: clip(navigator.userAgent, 400),
  };
  if (!el) return base;
  const rect = el.getBoundingClientRect();
  return {
    ...base,
    modal: modalTitle(el),
    headings: nearbyHeadings(el),
    selector: selectorPath(el),
    elementTag: el.tagName.toLowerCase(),
    elementText: clip((el as HTMLElement).innerText ?? el.textContent, 300) || undefined,
    elementLabel: clip(el.getAttribute('aria-label') ?? el.getAttribute('title') ?? el.getAttribute('placeholder'), 200) || undefined,
    rect: {x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height)},
  };
}

/** Topmost app element under a point, skipping the widget's own layers. */
export function elementAt(x: number, y: number): Element | null {
  return document.elementsFromPoint(x, y).find(el => !el.closest(`[${DEV_NOTES_ATTR}]`) && el !== document.documentElement && el !== document.body) ?? null;
}

/**
 * Viewport screenshot with the picked element outlined. Returns undefined when
 * capture fails (e.g. a cross-origin image) so the note still goes out.
 */
export async function captureScreenshot(rect?: DevNoteContext['rect']): Promise<string | undefined> {
  try {
    const {domToCanvas} = await import('modern-screenshot');
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    const background = getComputedStyle(document.body).backgroundColor;
    const canvas = await domToCanvas(document.body, {
      width: innerWidth,
      height: innerHeight,
      scale,
      backgroundColor: background,
      timeout: 8_000,
      style: scrollX || scrollY ? {transform: `translate(${-scrollX}px, ${-scrollY}px)`} : undefined,
      filter: node => !(node instanceof Element && node.hasAttribute(DEV_NOTES_ATTR)),
    });
    if (rect) {
      const context = canvas.getContext('2d');
      if (context) {
        context.lineWidth = 3 * scale;
        context.strokeStyle = '#FF2D55';
        context.strokeRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
      }
    }
    for (const [target, quality] of [[canvas, 0.72], [canvas, 0.5], [shrink(canvas, 1 / scale), 0.5]] as const) {
      const dataUrl = target.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= MAX_SCREENSHOT_CHARS) return dataUrl;
    }
  } catch (error) {
    console.warn('[devNotes] screenshot failed:', error);
  }
  return undefined;
}

function shrink(source: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(source.width * factor);
  canvas.height = Math.round(source.height * factor);
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
