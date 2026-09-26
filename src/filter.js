import { canonicalTech } from './techstack.js';

const lower = (arr) => (arr ?? []).map((s) => String(s).trim().toLowerCase()).filter(Boolean);

/**
 * Row filters. Text filters are case-insensitive "contains any".
 * - keywords: anywhere in the post (company, roles, description)
 * - locations: in the parsed location or the post's first line; "remote" also matches remote posts
 * - techStack: any of these technologies ("postgres" and "PostgreSQL" are the same)
 */
export function makeFilter({ keywords, remoteOnly, locations, techStack, minParseConfidence } = {}) {
    const kw = lower(keywords);
    const locs = lower(locations);
    const tech = new Set((techStack ?? []).map(canonicalTech).map((t) => t.toLowerCase()).filter(Boolean));
    return (row) => {
        if (remoteOnly && row.remote !== 'remote') return false;
        if (minParseConfidence > 0 && row.parseConfidence < minParseConfidence) return false;
        if (kw.length) {
            const hay = row.rawText.toLowerCase();
            if (!kw.some((k) => hay.includes(k))) return false;
        }
        if (locs.length) {
            const hay = `${row.location ?? ''} ${row.headline ?? ''}`.toLowerCase();
            if (!locs.some((l) => hay.includes(l) || (l === 'remote' && row.remote === 'remote'))) return false;
        }
        if (tech.size && !row.techStack.some((t) => tech.has(t.toLowerCase()))) return false;
        return true;
    };
}
