// HN comment HTML to plain text, keeping every link's full href (HN shortens long URLs in the
// visible link text, so the href is the only complete copy).

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
    return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
        if (code[0] === '#') {
            const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
            return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
        }
        return ENTITIES[code.toLowerCase()] ?? m;
    });
}

/** @returns {{text: string, links: {href: string, text: string}[]}} */
export function htmlToText(html) {
    const links = [];
    const withLinks = String(html ?? '').replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
        const text = decodeEntities(inner.replace(/<[^>]+>/g, ''));
        links.push({ href: decodeEntities(href), text });
        return text;
    });
    const text = decodeEntities(
        withLinks
            .replace(/<p>/gi, '\n')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/?(pre|code)>/gi, '\n')
            .replace(/<[^>]+>/g, ''),
    )
        .replace(/\r/g, '')
        .replace(/[ \t ]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    return { text, links };
}
