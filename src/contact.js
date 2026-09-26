// Emails and links as posters write them, including the usual spam-dodging spellings:
// "jobs [at] acme [dot] com", "email me at hiring at acme dot com", "x (at) y.io", "x@y DOT com".

// Cyrillic and Greek letters that look Latin, used to dodge scrapers ("Е-mаil").
const LOOKALIKES = { 'А': 'A', 'а': 'a', 'В': 'B', 'Е': 'E', 'е': 'e', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O', 'о': 'o', 'Р': 'P', 'р': 'p', 'С': 'C', 'с': 'c', 'Т': 'T', 'Х': 'X', 'х': 'x', 'у': 'y', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'ο': 'o', 'α': 'a', 'ε': 'e' };
export const unLookalike = (s) => String(s ?? '').replace(/[А-яІіЈјЅѕοαε]/g, (c) => LOOKALIKES[c] ?? c);

const AT = String.raw`\s*(?:\[\s*at\s*\]|\(\s*at\s*\)|\{\s*at\s*\}|<\s*at\s*>|\s+at\s+|@)\s*`;
const DOT = String.raw`\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\)|\{\s*dot\s*\}|<\s*dot\s*>|\s+dot\s+|\.)\s*`;
const LOCAL = String.raw`[a-z0-9][a-z0-9._%+-]{0,63}`;
const LABEL = String.raw`[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?`;
const TLD = String.raw`[a-z]{2,24}`;
const EMAIL_RE = new RegExp(String.raw`(?<![a-z0-9._%+-])(${LOCAL})${AT}(${LABEL}(?:${DOT}${LABEL})*)${DOT}(${TLD})(?![a-z0-9])`, 'gi');
const PLAIN_EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,24}$/i;

// Prose words that end up in the mailbox slot of "X at Y": "take a look at acme.com", "email me at ...".
const NOT_LOCAL = new Set(['me', 'us', 'him', 'her', 'them', 'look', 'email', 'mail', 'contact', 'apply', 'reach', 'available', 'based', 'work', 'join', 'here', 'out', 'more', 'found', 'listed', 'hosted', 'roles', 'located', 'office', 'offices', 'directly', 'live', 'built', 'engineer', 'developer']);
const EMAIL_CONTEXT = /(e-?mail|contact|send|reach|write|ping|cv|resume|résumé|apply|questions?)\b[^.\n]{0,30}$/i;
const PLACEHOLDER = /^(you|your|name|firstname|first\.last|lastname|example|user|someone|username|x+|your\.?name)@|@(example|domain|email|company|yourcompany|test)\.(com|org|net)$/i;

/**
 * @returns {string[]} unique lowercase emails, in order of appearance (mailto links first)
 */
export function extractEmails(text, links = []) {
    const out = [];
    const add = (e) => {
        const email = e.toLowerCase().replace(/\.+$/, '');
        if (PLAIN_EMAIL_RE.test(email) && !PLACEHOLDER.test(email) && !out.includes(email)) out.push(email);
    };
    for (const l of links) if (/^mailto:/i.test(l.href)) add(decodeURIComponent(l.href.slice(7).split('?')[0]));
    const s = unLookalike(text);
    for (const m of s.matchAll(EMAIL_RE)) {
        const [whole, local, domain, tld] = m;
        const spelledOut = !whole.includes('@');
        if (spelledOut && /\sat\s/i.test(whole)) {
            // Plain " at ": skip prose words as the mailbox, and unless the dots are spelled out too
            // ("x at y dot com"), require email-ish wording just before it ("email x at y.com").
            if (NOT_LOCAL.has(local.toLowerCase())) continue;
            if (!/\bdot\b/i.test(whole) && !EMAIL_CONTEXT.test(s.slice(Math.max(0, m.index - 40), m.index))) continue;
        }
        const cleanDomain = domain.split(new RegExp(DOT, 'i')).join('.');
        add(`${local}@${cleanDomain}.${tld}`);
    }
    return out;
}

const URL_IN_TEXT_RE = /\b((?:https?:\/\/|www\.)[^\s<>()"']+|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|io|ai|co|dev|app|xyz|org|net|tech|so|sh|us|uk|de|eu|fm|pro|health|space|studio|systems|care|cloud|energy|bio|build|run|tools|finance|jobs|careers)(?:\/[^\s<>()"']*)?)/gi;

export function normalizeUrl(u) {
    const s = String(u ?? '').trim().replace(/[.,;:!?)\]]+$/, '');
    if (!s) return null;
    try {
        return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).href;
    } catch {
        return null;
    }
}

/** Links from anchors plus bare URLs typed in the text, de-duplicated, HN self-links dropped. */
export function extractUrls(text, links = []) {
    const out = [];
    const add = (u) => {
        const url = normalizeUrl(u);
        if (!url || /news\.ycombinator\.com|^mailto:/i.test(url) || out.includes(url)) return;
        out.push(url);
    };
    for (const l of links) if (!/^mailto:/i.test(l.href)) add(l.href);
    for (const m of String(text ?? '').matchAll(URL_IN_TEXT_RE)) {
        if (/@/.test(text.slice(Math.max(0, m.index - 1), m.index))) continue; // domain part of an email
        const u = normalizeUrl(m[1]);
        // HN truncates long link text ("https://example.com/very/lo..."); the anchor already gave the full URL.
        if (u && !out.some((o) => o.startsWith(u.replace(/\.{2,}.*$/, '').replace(/\/$/, '')))) add(m[1]);
    }
    return out;
}

const APPLY_HINT = /apply|\/jobs?\b|careers?|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|recruitee|breezy|bamboohr|smartrecruiters|teamtailor|personio|workatastartup|wellfound|join|hiring|positions|openings|work-with-us|typeform|forms\.gle|airtable/i;

export function pickApplyUrl(urls, companyUrl) {
    return urls.find((u) => APPLY_HINT.test(u)) ?? companyUrl ?? urls[0] ?? null;
}
