// Finding the monthly threads (posted by the `whoishiring` account) and reading their comments,
// through the public Algolia Hacker News API.
import { request } from './fetch.js';

const API = 'https://hn.algolia.com/api/v1';

export const THREAD_TYPES = {
    hiring: { title: /^Ask HN: Who is hiring\?/i, label: 'Who is hiring?' },
    seeking_work: { title: /^Ask HN: Who wants to be hired\?/i, label: 'Who wants to be hired?' },
    freelancer: { title: /^Ask HN: Freelancer\? Seeking freelancer\?/i, label: 'Freelancer? Seeking freelancer?' },
};

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "Ask HN: Who is hiring? (September 2026)" -> "2026-09" */
export function monthFromTitle(title) {
    const m = String(title ?? '').match(/\((\w+)\s+(\d{4})\)/);
    const idx = m ? MONTHS.indexOf(m[1].toLowerCase()) : -1;
    return idx >= 0 ? `${m[2]}-${String(idx + 1).padStart(2, '0')}` : null;
}

/** Accepts "2026-09", "2026-9", "September 2026", "latest". */
export function normalizeMonth(raw) {
    const s = String(raw ?? '').trim().toLowerCase();
    if (!s || s === 'latest' || s === 'current') return 'latest';
    let m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[1]}-${m[2].padStart(2, '0')}`;
    m = s.match(/^([a-z]+)\s+(\d{4})$/);
    if (m && MONTHS.includes(m[1])) return `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, '0')}`;
    return null;
}

export const currentMonth = (now = new Date()) => `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

/**
 * The thread of `type` for `month` ("YYYY-MM" or "latest").
 * Threads are posted on the first weekday of the month, so the search window is the month's first 10 days.
 * @returns {Promise<{id: string, title: string, month: string, createdAt: string} | null>}
 */
export async function findThread(type, month) {
    const { title } = THREAD_TYPES[type];
    let url = `${API}/search_by_date?tags=story,author_whoishiring&hitsPerPage=50`;
    if (month !== 'latest') {
        const [y, mo] = month.split('-').map(Number);
        const start = Date.UTC(y, mo - 1, 1) / 1000;
        url += `&numericFilters=created_at_i>=${start},created_at_i<${start + 10 * 86400}`;
    }
    const res = await request(url);
    if (!res.ok) throw new Error(`Thread search failed (${res.status || res.category})`);
    const hit = (res.body.hits ?? []).find((h) => title.test(h.title ?? '') && (month === 'latest' || monthFromTitle(h.title) === month));
    return hit ? { id: String(hit.objectID), title: hit.title, month: monthFromTitle(hit.title), createdAt: hit.created_at } : null;
}

/** Top-level comments of a thread; each is one post. Deleted and flagged comments are dropped. */
export async function fetchPosts(threadId) {
    const res = await request(`${API}/items/${threadId}`, { maxBytes: 60_000_000 });
    if (res.category === 'not_found') return [];
    if (!res.ok) throw new Error(`Could not load thread ${threadId} (${res.status || res.category})`);
    return (res.body.children ?? []).filter((c) => c && c.type === 'comment' && c.text && !/^\s*\[(flagged|dead|deleted)\]\s*$/i.test(c.text));
}
