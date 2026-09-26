// Salary ranges in the many ways HN posters write them:
// "$150k-$200k", "150-200K USD", "€6,000 - €7,000 per month", "$120-160/hr", "100-200k CHF", "$200K USD+".

const CODES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'INR', 'SGD', 'JPY', 'BRL', 'MXN', 'ILS', 'HKD', 'ZAR', 'AED'];
const CODE_RE = new RegExp(`\\b(${CODES.join('|')})\\b`, 'i');
// Longest prefixes first so "CA$" wins over "$".
const SYMBOLS = [['US$', 'USD'], ['CA$', 'CAD'], ['C$', 'CAD'], ['A$', 'AUD'], ['AU$', 'AUD'], ['NZ$', 'NZD'], ['€', 'EUR'], ['£', 'GBP'], ['₹', 'INR'], ['¥', 'JPY'], ['$', 'USD']];

const AMOUNT_RE = /(US\$|CA\$|C\$|AU?\$|NZ\$|[$€£₹¥])?\s?(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{1,3}(?:\.\d{3})+(?!\d)|\d+(?:\.\d+)?)\s?([kKmM](?![a-zA-Z]))?(?!\s?%)(?![\d.,]*%)/g;
const RANGE_SEP_RE = /^\s*(?:-|–|—|to|~|->)\s*$/i;

function toNumber(raw) {
    // "80.000" (European thousands) vs "1.5" (decimal)
    if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return Number(raw.replace(/\./g, ''));
    return Number(raw.replace(/,/g, ''));
}

export function detectCurrency(text) {
    const code = String(text ?? '').match(CODE_RE);
    if (code) return code[1].toUpperCase();
    for (const [sym, cur] of SYMBOLS) if (String(text ?? '').includes(sym)) return cur;
    return null;
}

export function detectInterval(text) {
    const s = String(text ?? '');
    if (/\/\s?h(ou)?r\b|per\s+hour|hourly|\/h\b|an hour|\bp\/h\b/i.test(s)) return 'hour';
    if (/per\s+day|\/\s?day\b|daily rate|\bday rate\b|\/d\b/i.test(s)) return 'day';
    if (/per\s+month|\/\s?mo(nth)?\b|monthly|\bpm\b/i.test(s)) return 'month';
    if (/per\s+(year|annum)|\/\s?y(ea)?r\b|annual|\bp\.?a\.?(?![a-z])|yearly|\bOTE\b|base salary/i.test(s)) return 'year';
    return null;
}

export const mentionsEquity = (text) => /equity|stock options?|\bESOP\b|\bRSUs?\b|\d\s?%/i.test(String(text ?? ''));

/**
 * Every money amount or range in `text`, with currency, as whole units.
 * Bare numbers without a currency or a k/M suffix are ignored (they are usually years, hours or headcounts).
 * @returns {{min: number, max: number|null}[]}
 */
export function findRanges(text) {
    // "401K" / "401(k)" is a US retirement plan, not a salary.
    const s = String(text ?? '').replace(/\b401\s?\(?k\)?/gi, 'retirement plan');
    const hits = [];
    for (const m of s.matchAll(AMOUNT_RE)) {
        const [whole, sym, num, mult] = m;
        const value = toNumber(num);
        if (!Number.isFinite(value)) continue;
        const after = s.slice(m.index + whole.length, m.index + whole.length + 5);
        const hasCode = /^\s?[A-Z]{3}\b/.test(after) && CODE_RE.test(after);
        // "$200k+" or "$200K USD+" is open-ended; "$300k + equity" is not.
        const plus = /^(?:\s?[A-Z]{3})?\+/.test(after);
        const upTo = /\bup\s+to\s*$/i.test(s.slice(Math.max(0, m.index - 8), m.index));
        const from = /\b(from|starting( at)?|at least)\s*$/i.test(s.slice(Math.max(0, m.index - 14), m.index));
        hits.push({ index: m.index, end: m.index + whole.length, sym: sym ?? null, value, mult: mult?.toLowerCase() ?? null, hasCode, plus, upTo, from });
    }
    const scale = (h, mult) => h.value * (mult === 'k' ? 1000 : mult === 'm' ? 1_000_000 : 1);
    const ranges = [];
    for (let i = 0; i < hits.length; i++) {
        const a = hits[i];
        const b = hits[i + 1];
        const between = b ? s.slice(a.end, b.index) : null;
        if (b && RANGE_SEP_RE.test(between.replace(/[$€£₹¥]|US|CA|AU|NZ/g, ''))) {
            // "150 - 210K" applies the k to both ends; "150k-200" likewise.
            const multA = a.mult ?? (b.mult && a.value < 1000 ? b.mult : null);
            const multB = b.mult ?? (a.mult && b.value < 1000 ? a.mult : null);
            const moneyish = a.sym || b.sym || multA || multB || a.hasCode || b.hasCode;
            if (moneyish) {
                const lo = scale(a, multA);
                const hi = scale(b, multB);
                ranges.push({ min: Math.min(lo, hi), max: Math.max(lo, hi) });
            }
            i++;
            continue;
        }
        if (a.sym || a.mult || a.hasCode) {
            if (!a.sym && !a.hasCode && a.value >= 1900 && a.value <= 2100) continue;
            const v = scale(a, a.mult);
            // A lone "$130,000" is an exact figure unless it says "up to", "from" or "+".
            ranges.push(a.upTo ? { min: null, max: v } : { min: v, max: a.plus || a.from ? null : v });
        }
    }
    return ranges;
}

/**
 * @returns {{salaryMin: number|null, salaryMax: number|null, salaryCurrency: string|null, salaryInterval: string|null, hasEquity: boolean}}
 */
export function parseSalary(text) {
    const ranges = findRanges(text);
    const mins = ranges.map((r) => r.min).filter(Number.isFinite);
    const maxs = ranges.map((r) => r.max).filter(Number.isFinite);
    const salaryMin = mins.length ? Math.min(...mins) : null;
    const salaryMax = maxs.length ? Math.max(...maxs) : null;
    const found = salaryMin !== null || salaryMax !== null;
    let salaryInterval = detectInterval(text);
    if (!salaryInterval && found && (salaryMax ?? salaryMin) >= 10_000) salaryInterval = 'year';
    return {
        salaryMin,
        salaryMax,
        salaryCurrency: found ? detectCurrency(text) : null,
        salaryInterval: found ? salaryInterval : null,
        hasEquity: mentionsEquity(text),
    };
}
