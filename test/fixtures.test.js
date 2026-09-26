// The parser against 43 real top-level comments (HN "Who is hiring?" September and August 2026,
// "Who wants to be hired?" September 2026, "Freelancer? Seeking freelancer?" October 2025),
// chosen for their odd formats. Expected values were checked by reading each post.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePost } from '../src/parse.js';

const comments = JSON.parse(readFileSync(new URL('./fixtures/comments.json', import.meta.url)));
const byId = Object.fromEntries(comments.map((c) => [c.id, c]));

// Only the fields listed are checked for each post. `roles` compares the full array.
const EXPECTED = {
    // Textbook "Company | Role | Location | Type | Salary | URL"
    49522903: { company: 'Modash.io', roles: ['Senior Product Engineer'], location: 'Remote (Europe)', remote: 'remote', employmentType: 'Full-time', salaryMin: 75000, salaryMax: 110000, salaryCurrency: 'EUR', salaryInterval: 'year' },
    // "$150 - 210K USD + equity": k applies to both ends
    49522912: { company: 'Quill', roles: ['Fullstack SWE'], remote: 'remote', salaryMin: 150000, salaryMax: 210000, salaryCurrency: 'USD', hasEquity: true, contactEmail: 'rishi@quill.co' },
    // Slash in the company, "&" inside one role, three roles
    49522929: { company: 'Open Education Applications / Neon', roles: ['Senior/Lead Platform & DevOps Engineer', 'Senior Frontend Engineer', 'Senior Full-Stack Engineer'], location: 'Utrecht, The Netherlands', remote: 'hybrid', contactEmail: 'jobs@openeducation.foundation' },
    // "Contract / Part-time (10–40 hrs/wk)" is not a salary
    49522930: { company: 'We The Flywheel', remote: 'remote', employmentType: 'Part-time, Contract', salaryMin: null },
    // "ONSITE/REMOTE" offers remote
    49522949: { company: 'ORIGAMICS', roles: ['Founding Researcher'], location: 'San Francisco', remote: 'remote' },
    // URL glued to the company name
    49522989: { company: 'Snout', companyUrl: 'https://snout.com/', location: 'Remote US or Ontario, Canada', employmentType: 'Full-time' },
    // "(https://...)" after the company, no role in the header
    49523018: { company: 'Smarkets', companyUrl: 'https://www.smarkets.com/', roles: [], remote: 'hybrid' },
    // No pipes: "Role at Company in City"
    49523176: { company: 'NLnet foundation', roles: ['Rust developer/software engineer'], location: 'Amsterdam' },
    // Monthly salary in euros, visa sponsorship offered
    49523228: { company: 'Attendi', salaryMin: 6000, salaryMax: 7000, salaryCurrency: 'EUR', salaryInterval: 'month', visaSponsorship: true, remote: 'hybrid' },
    // Hourly contract rate; one role with sub-areas stays one role
    49523604: { company: 'Noricum', roles: ['Senior Backend Engineer, Payments, Ledger & Provable Fairness'], salaryMin: 120, salaryMax: 160, salaryInterval: 'hour', contactEmail: 'michael@noricum.io' },
    // "NO VISA (EU work authorisation required)" is a visa note, not a location
    49523666: { company: 'motan', location: 'Isny im Allgäu, Germany', remote: 'onsite', visaSponsorship: false },
    // Checkmark bullets; salary only in the body ("Comp: 160-180K, equity, 401K"): 401K is a retirement plan
    49523675: { company: 'Sudowrite', remote: 'remote', salaryMin: 160000, salaryMax: 180000 },
    // "(YC W24)" dropped from the name; "• 0.50%–1.50%" is equity, not salary
    49523716: { company: 'Monumint', companyUrl: 'https://monumint.com/', roles: ['Full Stack Engineers'], remote: 'onsite', salaryMin: 125000, salaryMax: 225000, hasEquity: true },
    // "$109K–$136K CAD": the code beats the $ sign
    49523768: { company: 'Justworks', salaryCurrency: 'CAD', salaryMin: 109000, salaryMax: 136000, remote: 'hybrid' },
    // Several location segments
    49523808: { company: 'Stream', roles: ['Multiple Positions'], visaSponsorship: true },
    // Role first, shouting, "REMOTE WILL BE IGNORED" means onsite
    49523830: { company: null, roles: ['Lead SWE'], remote: 'onsite', salaryMin: 130000, salaryMax: 210000, salaryCurrency: 'CAD', hasEquity: true },
    // Markdown asterisks around the whole header
    49523835: { company: 'Fastly', roles: ['Software Engineers (Senior, Staff, Principal)'], remote: 'onsite' },
    // Salaries inside the role list
    49524060: { company: 'Mechanize', roles: ['Junior SWE', 'SWE', 'Research Engineer, Alignment'], location: 'San Francisco, CA (Onsite)', salaryMin: 300000, salaryMax: 400000, hasEquity: true },
    // "$90–$110/hour USD"
    49524080: { company: 'ODK', roles: ['Senior Product Manager'], employmentType: 'Contract', salaryMin: 90, salaryMax: 110, salaryInterval: 'hour' },
    // Abbreviated role ("Engr") joins the previous one
    49524167: { company: 'WorkHero', remote: 'remote' },
    // No header at all, company from the opening sentence
    49524180: { company: 'Beacon AI', roles: [] },
    // Department list before the roles
    49524781: { company: 'PostHog', roles: ['Technical CSMs', 'Technical Content Writers', 'AI Research Engineer'], remote: 'remote' },
    // "U.S. Citizens" means no sponsorship; comma list is roles, not a place
    49524943: { company: 'GovStar', visaSponsorship: false, remote: 'remote', location: 'Remote (U.S. — Eastern/Central Time)' },
    // "$200K USD+" is open-ended
    49524978: { company: 'Category Labs', salaryMin: 200000, salaryMax: null, salaryCurrency: 'USD' },
    // Two roles joined by "or", each with its own workplace note
    49525053: { company: 'Mingla', roles: ['CTO (ONSITE, Stockholm)', 'Part-time Engineer (REMOTE ok)'], remote: 'remote' },
    // Currency code after the range
    49525423: { company: 'Tufalabs', salaryMin: 100000, salaryMax: 200000, salaryCurrency: 'CHF', remote: 'onsite' },
    // Long city list
    49525548: { company: 'RINSE', remote: 'remote' },
    // A sentence where the roles would be: no roles invented
    49525549: { company: 'Solution Street', roles: [], remote: 'hybrid' },
    // "$250k+ base"
    49525600: { company: 'Balerion AI', salaryMin: 250000, salaryMax: null, remote: 'onsite', contactEmail: 'hiring@balerion.ai' },
    // "Company - sentence"
    49526803: { company: 'DuckDuckGo', roles: [], remote: 'remote' },
    // Garbled header: company not recoverable, roles still are
    49615973: { company: null, roles: ['Senior/Staff Backend Engineer, Backend Platform'] },
    // Role first, no company
    49157647: { company: null, roles: ['Software Engineer - Full Stack'], salaryMin: 160000, salaryMax: 210000, remote: 'onsite' },
    // "Company - more | Role"
    49158727: { company: '40GRID', roles: ['Senior QA Engineer'], remote: 'remote', employmentType: 'Full-time', contactEmail: 'jobs@40grid.com' },
    // Lowercase everything
    49173075: { company: 'forus', roles: ['founding security engineer'], remote: 'onsite', employmentType: 'Full-time' },
    // A chatty first line: little to parse, low confidence
    49157454: { company: null },
    // "Who wants to be hired?" template, with an email hidden behind Cyrillic lookalikes and "at ... dot"
    49522899: { postKind: 'seeking_work', location: 'Tbilisi, Georgia', remote: 'remote', willingToRelocate: true, resumeUrl: 'https://kol3x.com/', contactEmail: 'hn-september@kol3x.com' },
    49522906: { postKind: 'seeking_work', location: 'Porto, Portugal', remote: 'remote', willingToRelocate: false, resumeUrl: 'https://thaler.dev/thaler.cv.pdf', contactEmail: 'dmitry@thaler.dev' },
    49522909: { postKind: 'seeking_work', location: 'Pisa, Italy (CET)', willingToRelocate: false, resumeUrl: 'https://linkedin.com/in/vslovik' },
    49522910: { postKind: 'seeking_work', location: 'Rzeszów, Poland', resumeUrl: 'https://walat.eu/cv/', contactEmail: 'dariusz@walat.eu' },
    // Freelancer thread: SEEKING WORK posts
    45438507: { postKind: 'seeking_work', roles: ['On-Demand DevOps'], location: 'WORLDWIDE' },
    45438534: { postKind: 'seeking_work', contactEmail: 'sw@seanw.org' },
    45438583: { postKind: 'seeking_work', location: 'Prague, Czech Republic (EU)', remote: 'remote', willingToRelocate: false },
    45438614: { postKind: 'seeking_work', location: 'The Netherlands', remote: 'remote' },
};

test('fixture set covers 30+ real posts', () => {
    assert.ok(comments.length >= 30);
    assert.deepEqual(Object.keys(EXPECTED).sort(), comments.map((c) => String(c.id)).sort());
});

for (const [id, want] of Object.entries(EXPECTED)) {
    const c = byId[id];
    test(`post ${id}: ${(c.text.replace(/<[^>]+>/g, ' ').slice(0, 50)).trim()}`, () => {
        const got = parsePost(c.text, c.threadType);
        for (const [k, v] of Object.entries(want)) assert.deepEqual(got[k], v, `${k}`);
    });
}

test('confidence separates clean headers from chatty posts', () => {
    const conf = (id) => parsePost(byId[id].text, byId[id].threadType).parseConfidence;
    assert.ok(conf(49522903) >= 0.9, 'textbook header');
    assert.ok(conf(49157454) < 0.5, 'chatty opener');
    assert.ok(conf(49524180) < 0.5, 'sentence opener');
    for (const c of comments) {
        const p = parsePost(c.text, c.threadType);
        assert.ok(p.parseConfidence >= 0 && p.parseConfidence <= 1);
    }
});

test('every post yields the full field set', () => {
    for (const c of comments) {
        const p = parsePost(c.text, c.threadType);
        for (const k of ['company', 'roles', 'location', 'remote', 'salaryMin', 'salaryMax', 'salaryCurrency', 'visaSponsorship', 'techStack', 'applyUrl', 'contactEmail', 'parseConfidence', 'text']) assert.ok(k in p, `${c.id} missing ${k}`);
        assert.ok(Array.isArray(p.roles) && Array.isArray(p.techStack));
        assert.ok(p.remote === null || ['remote', 'onsite', 'hybrid'].includes(p.remote));
    }
});
