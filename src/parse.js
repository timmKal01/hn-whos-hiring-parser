// Turns one top-level "Who is hiring?" / "Who wants to be hired?" / freelancer comment into a row.
// The first line is usually "Company | Role | Location | REMOTE | Salary | URL", but the order,
// separators and wording vary a lot, so each header segment is classified by what it contains.
import { htmlToText } from './text.js';
import { parseSalary, findRanges } from './salary.js';
import { extractEmails, extractUrls, normalizeUrl, pickApplyUrl, unLookalike } from './contact.js';
import { extractTechStack } from './techstack.js';

// ---------- segment classifiers ----------

const REMOTE_RE = /\b(remote|remotely|wfh|work from home|distributed|anywhere)\b/i;
const ONSITE_RE = /\b(on[\s-]?site|in[\s-]person|in[\s-]office|office[\s-]based|onsite)\b/i;
const HYBRID_RE = /\bhybrid\b|\d\s?(?:x|days?)\s?(?:\/|a|per)?\s?week in (?:the )?office|\bdays? in (?:the )?office/i;
const NO_REMOTE_RE = /\b(no|not|non)[\s-]+remote\b|\bremote\s+(?:will be ignored|not (?:possible|available|allowed|an option))|\bno remote\b/i;

const EMPLOYMENT = [
    [/\bfull[\s-]?time\b|\bfte\b|\bpermanent\b/i, 'Full-time'],
    [/\bpart[\s-]?time\b/i, 'Part-time'],
    [/\bcontract(?:or|ors)?\b|\bb2b\b|\bfreelance\b|\bconsult(?:ing|ant)\b(?=.*\b(?:basis|role|contract)\b)/i, 'Contract'],
    [/\bintern(?:s|ship|ships)?\b|\bco-?op\b/i, 'Internship'],
    [/\btemporary\b|\bfixed[\s-]term\b/i, 'Temporary'],
];
const EMPLOYMENT_ONLY_RE = /^[\s(]*(?:full[\s-]?time|part[\s-]?time|contract(?:or)?|contract[\s-]to[\s-](?:hire|perm(?:anent)?)|permanent|intern(?:ship)?s?|freelance|b2b(?:\s+contract)?|fte|temporary|full[\s-]?time\s+contract|full time\s*\/\s*contract)[\s):.]*$/i;

const VISA_NO_RE = /\bno\s+visas?\b|\b(?:not|unable to|cannot|can't|can not|won't|do not|don't)\s+(?:able to\s+)?sponsor|\bwithout\s+(?:visa\s+)?sponsorship|\bno\s+(?:visa\s+)?sponsorship\b|\bsponsorship\s+(?:is\s+)?not\s+(?:available|offered|possible)|\bmust\s+(?:already\s+)?(?:be\s+authori[sz]ed|have\s+(?:the\s+)?right\s+to\s+work)|\b(?:us|u\.s\.)\s+citizens?(?:\s+(?:only|required))?\b|\bcitizens?\s+only\b|\bwork\s+authori[sz]ation\s+required\b|\bno\s+relocation\s+or\s+visa/i;
const VISA_YES_RE = /\bvisa\s+(?:sponsorship|support|assistance|available|provided|sponsored)|\b(?:will|can|do|we|happy to|able to)\s+sponsor|\bsponsor(?:s|ing)?\s+(?:visas?|h-?1b|work permits?)|\bh-?1b\s+(?:transfers?|sponsorship)|\bvisa:\s*yes\b|\bVISA\b(?!\s*\()/i;

const ROLE_RE = /\b(engineers?|engineering|developers?|devs?|swes?|sres?|devops|designers?|scientists?|researchers?|research|managers?|leads?|head of|directors?|vps?|cto|ceo|coo|cfo|cpo|ciso|founding|co-?founder|architects?|analysts?|product|sales|marketing|recruiters?|writers?|operators?|operations|staff|principal|senior|sr\.?|junior|jr\.?|interns?|roles?|positions?|openings?|member of technical staff|mts|ml|frontend|front-end|backend|back-end|full[\s-]?stack|fullstack|mobile|ios|android|qa|sdets?|security|support|success|account executives?|bdrs?|sdrs?|gtm|consultants?|specialists?|associates?|administrators?|technicians?|hardware|firmware|embedded|mechanical|electrical|csms?|pms?|tpms?|economists?|accountants?|counsel|attorneys?|nurses?|physicians?|clinicians?|teachers?|tutors?|editors?|illustrators?|animators?|producers?)\b/i;
const STRONG_ROLE_START_RE = /^(senior|sr\.?|staff|principal|lead|junior|jr\.?|founding|head of|vp|director|chief|multiple|several|various)\b|^(software|backend|frontend|full[\s-]?stack|platform|ml|ai|data|devops|site reliability|product|mobile|ios|android|security|infrastructure|research)\s+(engineers?|developers?|scientists?|designers?|managers?)\b|\b(engineers?|developers?|swes?|designers?|scientists?|managers?|architects?|researchers?)$/i;

const REGIONS = String.raw`worldwide|global(?:ly)?|anywhere|europe|european union|\beu\b|emea|apac|latam|americas|north america|south america|\bna\b|asia|africa|middle east|oceania|nordics?|scandinavia|dach|benelux|\buk\b|\bus\b|\bu\.s\.?\b|\busa\b|\bu\.s\.a\.?\b|bay area|silicon valley|east coast|west coast|midwest|\best\b|\bpst\b|\bcet\b|\butc\b|\bgmt\b|time ?zones?|timezone`;
const COUNTRIES = 'united states|canada|mexico|brazil|argentina|chile|colombia|peru|uruguay|united kingdom|england|scotland|ireland|france|germany|netherlands|the netherlands|belgium|luxembourg|switzerland|austria|italy|spain|portugal|poland|czech republic|czechia|slovakia|hungary|romania|bulgaria|greece|croatia|serbia|slovenia|north macedonia|bosnia|estonia|latvia|lithuania|finland|sweden|norway|denmark|iceland|ukraine|georgia|armenia|turkey|israel|uae|united arab emirates|saudi arabia|qatar|egypt|nigeria|kenya|south africa|ghana|morocco|india|pakistan|bangladesh|sri lanka|nepal|singapore|malaysia|indonesia|philippines|vietnam|thailand|japan|south korea|korea|taiwan|hong kong|china|australia|new zealand';
const CITIES = 'new york|nyc|san francisco|\\bsf\\b|los angeles|\\bla\\b|seattle|boston|austin|chicago|denver|boulder|miami|atlanta|washington|\\bdc\\b|arlington|philadelphia|pittsburgh|portland|san diego|san jose|palo alto|mountain view|menlo park|sunnyvale|santa clara|oakland|berkeley|irvine|salt lake city|minneapolis|detroit|dallas|houston|nashville|raleigh|durham|charlotte|toronto|vancouver|montreal|ottawa|waterloo|calgary|london|cambridge|oxford|manchester|edinburgh|dublin|paris|berlin|munich|hamburg|frankfurt|cologne|amsterdam|rotterdam|utrecht|brussels|zurich|geneva|lausanne|vienna|copenhagen|stockholm|oslo|helsinki|tallinn|riga|vilnius|warsaw|krakow|wroclaw|prague|budapest|bucharest|sofia|athens|lisbon|porto|madrid|barcelona|valencia|milan|rome|tel aviv|dubai|bangalore|bengaluru|mumbai|delhi|noida|gurgaon|gurugram|hyderabad|pune|chennai|singapore|tokyo|seoul|taipei|sydney|melbourne|auckland|sao paulo|buenos aires|mexico city|bogota|santiago|lagos|nairobi|cape town|skopje|isny|tbilisi|kyiv|belgrade|zagreb|mcLean';
const PLACE_RE = new RegExp(String.raw`(${REGIONS})|\b(${COUNTRIES})\b|(${CITIES})`, 'i');
// "Austin, TX", "Palo Alto, CA" (countries and big cities are in PLACE_RE). Not "Full Stack, Frontend".
const PLACE_CS_RE = /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2}\b(?![a-z])/;

const URLISH_RE = /^(?:https?:\/\/\S+|www\.\S+|[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.[a-z]{2,24}(?:\/\S*)?)$/i;

const hasPlace = (s) => PLACE_RE.test(s) || PLACE_CS_RE.test(s);
// A header "segment" that is really a sentence of the description.
const isProse = (s) => /[.!?]\s+[A-Z]/.test(s) || s.length > 160 || (/[.!]$/.test(s) && s.split(/\s+/).length >= 8);
const hasMoney = (s) => findRanges(s).length > 0;

/** Split on "|" (or • / " - " when there are no pipes), keeping parenthesised text together. */
export function splitHeader(line) {
    const s = String(line ?? '').replace(/^[\s*_√✓•-]+|[\s*_:]+$/g, '');
    const splitOn = (re) => {
        const parts = [];
        let depth = 0;
        let cur = '';
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '(' || ch === '[') depth++;
            if ((ch === ')' || ch === ']') && depth > 0) depth--;
            re.lastIndex = i;
            const m = depth === 0 ? re.exec(s) : null;
            if (m && m.index === i) {
                parts.push(cur);
                cur = '';
                i += m[0].length - 1;
                continue;
            }
            cur += ch;
        }
        parts.push(cur);
        return parts.map((p) => p.replace(/^[\s*_√✓•]+|[\s*_]+$/g, '').trim()).filter((p) => p && !/^[-–—:,.]+$/.test(p));
    };
    if (s.includes('|')) return { segments: splitOn(/\s*\|\s*/y), delimiter: '|' };
    for (const re of [/\s+[•·]\s+/y, /\s+[-–—]\s+/y, /\s*;\s+/y]) {
        const parts = splitOn(re);
        if (parts.length >= 3) return { segments: parts, delimiter: re.source.trim() };
    }
    return { segments: s ? [s.trim()] : [], delimiter: null };
}

/** Labels for one header segment. A segment can carry several (e.g. "Remote (US), Full-time"). */
export function classify(seg) {
    const labels = new Set();
    const bare = seg.replace(/[()]/g, '').trim();
    if (URLISH_RE.test(bare)) labels.add('url');
    if (hasMoney(seg)) labels.add('salary');
    if (/\b(equity|stock options?)\b/i.test(seg) && !/\b(engineer|developer|investment)\b/i.test(seg)) labels.add('equity');
    if (REMOTE_RE.test(seg) || ONSITE_RE.test(seg) || HYBRID_RE.test(seg)) labels.add('workplace');
    if (EMPLOYMENT.some(([re]) => re.test(seg))) labels.add('employment');
    if (EMPLOYMENT_ONLY_RE.test(seg)) labels.add('employmentOnly');
    if (/\bvisas?\b|\bsponsor/i.test(seg)) labels.add('visa');
    if (ROLE_RE.test(seg)) labels.add('role');
    if (hasPlace(seg)) labels.add('place');
    return labels;
}

// ---------- header field extraction ----------

const cleanCompany = (seg) => {
    const urls = [];
    let name = seg.replace(/\(?\s*(https?:\/\/[^\s)]+|www\.[^\s)]+)\s*\)?/gi, (_, u) => { urls.push(u); return ' '; });
    // Funding / batch notes: "(YC W24)", "(Series B)", "(acquired by X)"
    name = name.replace(/\((?:yc|y combinator|series|seed|pre-seed|backed|funded|acquired|formerly|previously|a16z|sequoia|w\d\d|s\d\d|f\d\d)[^)]*\)/gi, ' ');
    name = name.replace(/\s*[-–—:,]\s*$/, '').replace(/\s{2,}/g, ' ').trim();
    const bare = name.replace(/[()]/g, '').trim();
    if (!urls.length && URLISH_RE.test(bare) && !/\s/.test(bare)) urls.push(bare);
    return { name: name || null, url: urls[0] ? normalizeUrl(urls[0]) : null };
};

/** Split outside parentheses; each part remembers the separator that preceded it. */
function splitTopLevel(s, re) {
    const out = [];
    let depth = 0;
    let cur = '';
    let sep = '';
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === '(') depth++;
        if (ch === ')' && depth > 0) depth--;
        re.lastIndex = i;
        const m = depth === 0 ? re.exec(s) : null;
        if (m && m.index === i) { out.push({ text: cur.trim(), sep }); cur = ''; sep = m[0]; i += m[0].length - 1; continue; }
        cur += ch;
    }
    out.push({ text: cur.trim(), sep });
    return out.filter((p) => p.text);
}

// A part only stands alone as a role if it names one ("Engineer", "Roles"), not just a
// qualifier ("Senior/Lead Platform", "Payments").
const ROLE_NOUN_RE = /\b(engineers?|engineering|developers?|devs?|swes?|sres?|devops|designers?|scientists?|researchers?|managers?|leads?|heads?|directors?|vps?|cto|ceo|coo|cfo|cpo|ciso|founders?|co-?founders?|architects?|analysts?|recruiters?|writers?|operators?|staff|interns?|internships?|roles?|positions?|openings?|consultants?|specialists?|associates?|administrators?|technicians?|csms?|pms?|tpms?|economists?|accountants?|counsel|attorneys?|executives?|reps?|representatives?|strategists?|marketers?|editors?|producers?|qa|sdets?|mts|president|officer|hires?)\b/i;

/** "Senior Frontend Engineer, Senior Full-Stack Engineer" -> two roles; "Research Engineer, Alignment" stays one. */
export function splitRoles(seg) {
    const parts = splitTopLevel(seg, /\s*(?:,|;|\s\+\s|\s(?:and|or)\s)\s*/y).map((p) => ({
        // Salary notes attached to a role: "Junior SWE ($300k + equity + bonus)"
        text: p.text.replace(/\s*\([^)]*[$€£]\s?\d[^)]*\)/g, '').replace(/^(?:and|or)\s+/i, '').trim(),
        sep: p.sep,
    })).filter((p) => p.text);
    const roles = [];
    let pending = '';
    for (const p of parts) {
        const text = pending ? `${pending}${p.sep.trim() === ',' ? ', ' : ` ${p.sep.trim()} `}${p.text}` : p.text;
        pending = '';
        if (ROLE_NOUN_RE.test(p.text)) roles.push(text);
        else if (roles.length) roles[roles.length - 1] += `${p.sep.trim() === ',' ? ', ' : ` ${p.sep.trim()} `}${p.text}`;
        else pending = text; // a leading qualifier joins the next part
    }
    return roles;
}

export function workplaceOf(text) {
    const s = String(text ?? '');
    const options = [];
    const negated = NO_REMOTE_RE.test(s);
    if (HYBRID_RE.test(s)) options.push('hybrid');
    if (REMOTE_RE.test(s.replace(NO_REMOTE_RE, ' ')) && !negated) options.push('remote');
    if (ONSITE_RE.test(s) || negated) options.push('onsite');
    // "ONSITE or REMOTE" offers remote, so it is reported as remote; hybrid only when that's the model.
    const remote = options.includes('remote') ? 'remote' : options.includes('hybrid') ? 'hybrid' : options.includes('onsite') ? 'onsite' : null;
    return { remote, workplaceOptions: options };
}

export function visaOf(header, body) {
    for (const s of [header, body]) {
        if (!s) continue;
        if (VISA_NO_RE.test(s)) return false;
        if (VISA_YES_RE.test(s)) return true;
    }
    return null;
}

export function employmentOf(text) {
    const s = String(text ?? '').replace(/\bcontract[\s-]to[\s-](?:hire|perm(?:anent)?)\b/gi, 'contract full-time');
    return EMPLOYMENT.filter(([re]) => re.test(s)).map(([, label]) => label);
}

/** Header without pipes: "Senior Rust developer at Acme in Amsterdam", "Acme is hiring ...". */
function parseFreeformHeader(line) {
    const at = line.match(/^(.{3,120}?)\s+(?:at|@)\s+([A-Z0-9][\w&.'’-]*(?:\s+[\w&.'’-]+){0,4}?)(?:(?:\s+in\s+|\s*[,(]\s*|\s+[-–]\s+)(.+))?[.!]?$/);
    if (at && ROLE_RE.test(at[1])) return { company: at[2].trim(), roles: splitRoles(at[1]), location: at[3]?.replace(/[()]/g, '').trim() || null, method: 'at' };
    const hiring = line.match(/^([A-Z0-9][\w&.'’ -]{1,60}?)\s+(?:is|are)\s+(?:hiring|looking for)\b\s*(.*)$/);
    if (hiring && !PRONOUN_START_RE.test(hiring[1])) return { company: hiring[1].trim(), roles: splitRoles(hiring[2] ?? ''), location: null, method: 'hiring' };
    // Posts that open with a sentence: "At Tether (https://tether.io/) we're hiring!", "We're hiring at Langfuse",
    // "Beacon AI builds intelligent systems...", "Tonic AI (https://tonic.ai) builds...".
    const NAME = String.raw`([A-Z0-9][\w.&'’-]*(?:\s+[A-Z0-9][\w.&'’-]*){0,3})`;
    const atCo = line.match(new RegExp(String.raw`^At\s+${NAME}(?:\s*\(([^)]*)\))?[\s,]+(?:we|we're|we’re|our)\b`)) ?? line.match(new RegExp(String.raw`\b(?:hiring|join us|work)\s+at\s+${NAME}`));
    if (atCo && !PRONOUN_START_RE.test(atCo[1])) return { company: atCo[1].trim(), roles: [], location: null, method: 'sentence' };
    const dash = line.match(new RegExp(String.raw`^${NAME}\s+[-–—]\s+(.+)$`));
    if (dash && !PRONOUN_START_RE.test(dash[1]) && !ROLE_RE.test(dash[1]) && (ROLE_RE.test(dash[2]) || REMOTE_RE.test(dash[2]) || hasPlace(dash[2]))) {
        // "DuckDuckGo - all roles fully remote, but some US-only as noted." names no role.
        const roles = isProse(dash[2]) || /\ball (?:roles|positions)\b/i.test(dash[2]) ? [] : splitRoles(dash[2]);
        return { company: dash[1].trim(), roles, location: null, method: 'dash' };
    }
    const subject = line.match(new RegExp(String.raw`^${NAME}(?:\s*\(([^)]*)\))?\s+(?:builds|is building|is|are|makes|provides|helps|develops|creates|offers|powers|was|has|runs|operates)\s`));
    if (subject && !PRONOUN_START_RE.test(subject[1]) && !ROLE_RE.test(subject[1])) return { company: subject[1].trim(), roles: [], location: null, method: 'sentence' };
    return null;
}

const PRONOUN_START_RE = /^(we|we're|we’re|our|i|i'm|i’m|hi|hey|hello|the|this|there|looking|hiring|role|location|my|you|if|it|a|an|join)\b/i;

// ---------- posts ----------

function firstLine(text) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    return { header: lines[0] ?? '', body: lines.slice(1).join('\n') };
}

function bodySalary(body) {
    // Only lines that talk about pay, so "raised $11M" or "100k users" don't read as salary.
    const lines = body.split('\n').filter((l) => /\b(salary|salaries|compensation|comp\b|pay\b|paying|base\b|OTE|per hour|\/hr|hourly rate|rate:|range)/i.test(l) && hasMoney(l));
    return lines.length ? parseSalary(lines.slice(0, 2).join(' ')) : null;
}

/**
 * @param html comment HTML from the Algolia API
 * @returns parsed fields; see README for meanings
 */
export function parseHiringPost(html, { stripPrefix } = {}) {
    const { text, links } = htmlToText(html);
    let { header, body } = firstLine(text);
    if (stripPrefix) header = header.replace(stripPrefix, '').replace(/^\s*[|:–—-]\s*/, '');
    const { segments, delimiter } = splitHeader(header);
    // "40GRID - Full-time Remote | Senior QA Engineer": the first segment holds the company and more.
    const lead = delimiter === '|' ? segments[0]?.match(/^(.{2,40}?)\s+[-–—]\s+(.+)$/) : null;
    if (lead && !STRONG_ROLE_START_RE.test(lead[1]) && !ROLE_RE.test(lead[1]) && lead[1].split(/\s+/).length <= 4) segments.splice(0, 1, lead[1], lead[2]);
    const labeled = segments.map((s) => ({ s, labels: classify(s) }));

    let company = null;
    let companyUrl = null;
    let roles = [];
    const locations = [];
    let companyFrom = null;

    if (delimiter && segments.length >= 2) {
        const first = labeled[0];
        const onlyMeta = ['salary', 'workplace', 'employmentOnly'].some((l) => first.labels.has(l)) && !first.labels.has('url') && first.s.split(/\s+/).length <= 4;
        const looksLikeRole = STRONG_ROLE_START_RE.test(first.s.replace(/\(.*?\)/g, '').trim());
        if (!onlyMeta && !looksLikeRole) {
            ({ name: company, url: companyUrl } = cleanCompany(first.s));
            companyFrom = 'header';
            first.used = true;
        }
        for (const seg of labeled) {
            if (seg.used) continue;
            const { s, labels } = seg;
            if (isProse(s)) continue;
            if (labels.has('url')) {
                companyUrl ??= normalizeUrl(s.replace(/[()]/g, ''));
                seg.used = true;
                continue;
            }
            if (labels.has('salary') && !labels.has('role')) { seg.used = true; continue; }
            if (labels.has('employmentOnly')) { seg.used = true; continue; }
            if (labels.has('role') && !labels.has('employmentOnly') && !(labels.has('place') && !STRONG_ROLE_START_RE.test(s) && !/\b(engineer|developer|designer|scientist|manager|roles?|positions?)\b/i.test(s))) {
                // A role segment that also names a place/workplace ("CTO (ONSITE, Stockholm)") still counts as roles.
                const found = splitRoles(s);
                if (found.length) { roles.push(...found); seg.used = true; continue; }
            }
            // Places, but not visa notes ("NO VISA (EU work authorisation required)") or prose that happens to name one.
            if (labels.has('place') && !labels.has('visa')) {
                locations.push({ text: s.replace(/\s+/g, ' ').trim(), pure: !labels.has('workplace') });
                seg.used = true;
            }
        }
        // "Berlin, Germany | ONSITE (Germany)": the plain location wins over the workplace note.
        if (locations.some((l) => l.pure)) locations.splice(0, locations.length, ...locations.filter((l) => l.pure));
    } else if (header) {
        const free = parseFreeformHeader(header);
        if (free) {
            company = free.company;
            roles = free.roles;
            if (free.location) locations.push({ text: free.location, pure: true });
            companyFrom = `freeform_${free.method}`;
        }
    }

    const headerAndBody = `${header}\n${body}`;
    const urls = extractUrls(headerAndBody, links);
    if (!companyUrl && company) {
        const slug = company.toLowerCase().replace(/[^a-z0-9]/g, '');
        // The company's own site, not its job board ("attendi.recruitee.com" is where to apply, not the homepage).
        const ATS_HOST = /greenhouse|lever\.co|ashbyhq|workable|recruitee|breezy|bamboohr|smartrecruiters|teamtailor|personio|workday|gem\.com|rippling|jobvite|trinethire|wellfound|ycombinator/i;
        companyUrl = urls.find((u) => {
            const host = new URL(u).hostname;
            return slug.length >= 3 && !ATS_HOST.test(host) && host.replace(/[^a-z0-9]/g, '').includes(slug);
        }) ?? null;
    }
    const emails = extractEmails(headerAndBody, links);

    const headerSalary = parseSalary(labeled.filter((l) => l.labels.has('salary')).map((l) => l.s).join(' | '));
    const salary = headerSalary.salaryMin !== null || headerSalary.salaryMax !== null ? headerSalary : bodySalary(body) ?? headerSalary;
    const hasEquity = headerSalary.hasEquity || labeled.some((l) => l.labels.has('equity'));

    let { remote, workplaceOptions } = workplaceOf(header);
    if (!remote) ({ remote, workplaceOptions } = workplaceOf(body.split('\n').slice(0, 3).join(' ')));
    const employment = employmentOf(header);

    return {
        company,
        companyUrl,
        roles,
        location: locations.length ? locations.map((l) => l.text).join('; ') : null,
        remote,
        workplaceOptions,
        employmentType: employment.length ? employment.join(', ') : null,
        salaryMin: salary.salaryMin,
        salaryMax: salary.salaryMax,
        salaryCurrency: salary.salaryCurrency,
        salaryInterval: salary.salaryInterval,
        hasEquity,
        visaSponsorship: visaOf(header, body),
        techStack: extractTechStack(headerAndBody),
        applyUrl: pickApplyUrl(urls, companyUrl),
        contactEmail: emails[0] ?? null,
        emails,
        urls,
        headerLine: header,
        parseConfidence: confidence({ company, companyFrom, roles, locations, remote, delimiter, segments, urls, emails, salary, employment }),
        text,
    };
}

export function confidence({ company, companyFrom, roles, locations, remote, delimiter, segments, urls, emails, salary, employment }) {
    let score = 0;
    if (company) score += companyFrom === 'header' ? 0.3 : 0.2;
    if (roles?.length) score += 0.2;
    if (locations?.length || remote) score += 0.15;
    if (delimiter && segments.length >= 3) score += 0.1;
    if (urls?.length || emails?.length) score += 0.15;
    if (salary?.salaryMin !== null || salary?.salaryMax !== null || employment?.length) score += 0.1;
    return Math.round(Math.min(1, score) * 100) / 100;
}

// ---------- "Who wants to be hired?" and SEEKING WORK posts ----------

const LABELS = [
    ['location', /^(location|based in|based|city)$/],
    ['remote', /^(remote|remote ok|remote work|work model)$/],
    ['relocate', /^(willing to relocate|relocate|relocation|open to relocation)$/],
    ['technologies', /^(technologies|tech|tech stack|stack|skills|languages|tools)$/],
    ['resume', /^(résumé\/cv|resume\/cv|résumé|resume|cv|cv\/resume)$/],
    ['email', /^(e-?mail|contact|reach me|mail)$/],
    ['website', /^(website|portfolio|site|web|github|linkedin|blog|homepage|code)$/],
    ['rate', /^(rate|rates|hourly rate|pricing|price)$/],
];

export function parseLabelledFields(text) {
    const fields = {};
    for (const line of text.split('\n')) {
        const m = unLookalike(line).match(/^\s*[-*•]?\s*([A-Za-zÀ-ÿ/ -]{2,30}?)\s*:\s*(.+)$/);
        if (!m) continue;
        const key = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
        const hit = LABELS.find(([, re]) => re.test(key));
        if (hit && !(hit[0] in fields)) fields[hit[0]] = m[2].trim();
    }
    return fields;
}

const yesNo = (v) => (v === undefined ? null : /^\s*(yes|y|sure|open|possibly|maybe|depends)/i.test(v) ? true : /^\s*(no|n|not)\b/i.test(v) ? false : null);

export function parseSeekingPost(html, { stripPrefix } = {}) {
    const { text, links } = htmlToText(html);
    const f = parseLabelledFields(text);
    let { header } = firstLine(text);
    const isHeaderLabel = /^\s*[A-Za-zÀ-ÿА-я/ -]{2,30}:\s/.test(header);
    if (stripPrefix) header = header.replace(stripPrefix, '').replace(/^\s*[|:–—-]\s*/, '');
    let { segments } = splitHeader(isHeaderLabel ? '' : header);
    // Seekers often write "On-Demand DevOps - WORLDWIDE": two parts is enough here.
    if (segments.length === 1 && /\s[-–—]\s/.test(segments[0])) segments = segments[0].split(/\s+[-–—]\s+/).map((s) => s.trim()).filter(Boolean);

    const remoteField = f.remote;
    let remote = null;
    if (remoteField !== undefined) {
        if (/hybrid/i.test(remoteField)) remote = 'hybrid';
        else if (/^\s*(yes|y|only|remote|preferred|sure|ok)/i.test(remoteField)) remote = 'remote';
        else if (/^\s*(no|n)\b/i.test(remoteField)) remote = 'onsite';
    } else {
        remote = workplaceOf(header).remote;
    }

    const urls = extractUrls(text, links);
    const emails = extractEmails(text, links);
    const pick = (field) => (field ? extractUrls(field, links.filter((l) => field.includes(l.text)))[0] ?? normalizeUrl(field.split(/\s|\|/)[0]) : null);
    const roles = segments.flatMap((s) => (ROLE_RE.test(s) && !hasPlace(s) ? splitRoles(s) : []));
    const location = f.location ?? segments.find((s) => hasPlace(s) && !ROLE_RE.test(s))?.replace(/^location\s*:\s*/i, '') ?? null;
    const rate = f.rate ? parseSalary(f.rate) : parseSalary(segments.filter(hasMoney).join(' '));
    const techStack = extractTechStack(f.technologies ? `${f.technologies}\n${text}` : text);
    const resumeUrl = pick(f.resume);
    const websiteUrl = pick(f.website);

    // Seekers post a labelled template (Location / Remote / Technologies / Résumé / Email);
    // confidence reflects how much of it we could fill.
    let score = 0;
    if (location) score += 0.25;
    if (remote) score += 0.2;
    if (techStack.length) score += 0.2;
    if (emails.length || resumeUrl || websiteUrl || urls.length) score += 0.2;
    if (Object.keys(f).length >= 3) score += 0.15;
    return {
        company: null,
        companyUrl: null,
        roles,
        location,
        remote,
        workplaceOptions: remote ? [remote] : [],
        employmentType: employmentOf(header).join(', ') || null,
        salaryMin: rate.salaryMin,
        salaryMax: rate.salaryMax,
        salaryCurrency: rate.salaryCurrency,
        salaryInterval: rate.salaryInterval,
        hasEquity: false,
        visaSponsorship: null,
        willingToRelocate: yesNo(f.relocate),
        techStack,
        resumeUrl,
        websiteUrl,
        applyUrl: null,
        contactEmail: emails[0] ?? null,
        emails,
        urls,
        headerLine: isHeaderLabel ? null : header,
        parseConfidence: Math.round(Math.min(1, score) * 100) / 100,
        text,
    };
}

// ---------- dispatch ----------

/** Freelancer threads mix both kinds of post, told apart by their first words. */
export function postKind(threadType, text) {
    if (threadType === 'hiring') return 'hiring';
    if (threadType === 'seeking_work') return 'seeking_work';
    const head = String(text ?? '').trim().slice(0, 40);
    if (/^seeking\s+(?:a\s+)?freelancers?/i.test(head)) return 'seeking_freelancer';
    if (/^seeking\s+work/i.test(head)) return 'seeking_work';
    return 'unknown';
}

export function parsePost(html, threadType) {
    const kind = postKind(threadType, htmlToText(html).text);
    const prefix = /^\s*seeking\s+(?:a\s+)?(?:freelancers?|work)\b\s*/i;
    const parsed = kind === 'seeking_work'
        ? parseSeekingPost(html, { stripPrefix: prefix })
        : parseHiringPost(html, { stripPrefix: kind === 'seeking_freelancer' ? prefix : null });
    return { postKind: kind, ...parsed };
}
