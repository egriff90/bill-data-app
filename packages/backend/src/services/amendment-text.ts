import { parliamentApi } from '../parliament-api';

/**
 * The full text of an amendment, fetched live from the Parliament Bills API (the database only holds
 * the summary fields). Everything here is plain text: Parliament sends some fields as HTML, which is
 * reduced to paragraphs so the frontend never has to inject markup.
 */
export interface AmendmentText {
  location: string | null; // e.g. "Clause 8 · Page 4, line 16"
  lines: { label: string | null; text: string; indentation: number; isImage: boolean }[];
  explanatoryTextPrefix: string | null; // e.g. "Member's explanatory statement"
  explanatoryText: string[];
  note: string[];
}

// Amendment text rarely changes once tabled, and caching keeps repeat views off Parliament's API.
const CACHE_TTL_MS = 60 * 60_000;
const CACHE_MAX_ENTRIES = 500;
const cache = new Map<number, { text: AmendmentText; expiresAt: number }>();

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  ndash: '–', mdash: '—', hellip: '…', pound: '£',
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function htmlToParagraphs(html: string | null): string[] {
  if (!html) return [];
  return html
    .split(/<\/p>|<br\s*\/?>/i)
    .map(htmlToText)
    .filter(p => p.length > 0);
}

/** Returns null if Parliament's API can't be reached, so the caller can still show the stored details. */
export async function getAmendmentText(billId: number, stageId: number, amendmentId: number): Promise<AmendmentText | null> {
  const hit = cache.get(amendmentId);
  if (hit && hit.expiresAt > Date.now()) return hit.text;

  let detail;
  try {
    detail = await parliamentApi.getAmendmentDetail(billId, stageId, amendmentId);
  } catch (error) {
    console.warn(`Failed to fetch text for amendment ${amendmentId}:`, error);
    return null;
  }

  const text: AmendmentText = {
    location: [detail.mainHeader, detail.amendmentLocation].filter(Boolean).join(' · ') || null,
    lines: (detail.amendmentLines ?? []).map(line => ({
      label: line.hangingIndentation ? htmlToText(line.hangingIndentation) || null : null,
      text: line.isImage ? '' : htmlToText(line.text ?? ''),
      indentation: Math.max(0, Math.min(line.indentation ?? 0, 6)),
      isImage: !!line.isImage,
    })),
    explanatoryTextPrefix: detail.explanatoryTextPrefix ? htmlToText(detail.explanatoryTextPrefix) : null,
    explanatoryText: htmlToParagraphs(detail.explanatoryText),
    note: htmlToParagraphs(detail.amendmentNote),
  };

  cache.delete(amendmentId);
  cache.set(amendmentId, { text, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return text;
}
