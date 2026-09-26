import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSalary } from '../src/salary.js';
import { extractEmails, extractUrls } from '../src/contact.js';
import { extractTechStack, canonicalTech } from '../src/techstack.js';
import { splitHeader, splitRoles, visaOf, workplaceOf, postKind } from '../src/parse.js';
import { htmlToText } from '../src/text.js';
import { monthFromTitle, normalizeMonth, currentMonth } from '../src/hn.js';
import { makeFilter } from '../src/filter.js';

test('salary formats seen in real posts', () => {
    const cases = [
        ['€75k–110k', 75000, 110000, 'EUR', 'year'],
        ['$150 - 210K USD + equity', 150000, 210000, 'USD', 'year'],
        ['€6,000 - €7,000 per month', 6000, 7000, 'EUR', 'month'],
        ['$120-160/hr', 120, 160, 'USD', 'hour'],
        ['$109K–$136K CAD', 109000, 136000, 'CAD', 'year'],
        ['100-200k CHF', 100000, 200000, 'CHF', 'year'],
        ['$90–$110/hour USD', 90, 110, 'USD', 'hour'],
        ['$200K USD+', 200000, null, 'USD', 'year'],
        ['up to £90k', null, 90000, 'GBP', 'year'],
        ['€80.000 - €95.000', 80000, 95000, 'EUR', 'year'],
        ['145k-165k + equity', 145000, 165000, null, 'year'],
        ['$130,000 – $210,000 CAD', 130000, 210000, 'CAD', 'year'],
    ];
    for (const [text, min, max, cur, interval] of cases) {
        const s = parseSalary(text);
        assert.deepEqual([s.salaryMin, s.salaryMax, s.salaryCurrency, s.salaryInterval], [min, max, cur, interval], text);
    }
});

test('not salaries: hours, years, percentages, 401k, equity only', () => {
    for (const text of ['Contract / Part-time (10–40 hrs/wk)', 'Start by 2026', '0.50%–1.50%', 'equity, 401K, profit share', 'Significant equity and commission']) {
        const s = parseSalary(text);
        assert.equal(s.salaryMin, null, text);
        assert.equal(s.salaryMax, null, text);
    }
    assert.equal(parseSalary('Significant equity and commission').hasEquity, true);
});

test('emails, including spam-dodging spellings', () => {
    const cases = [
        ['Email: jobs@acme.com', ['jobs@acme.com']],
        ['email me at jobs at acme dot com', ['jobs@acme.com']],
        ['Send your CV to careers [at] foo [dot] io.', ['careers@foo.io']],
        ['reach out: hiring (at) bar.dev', ['hiring@bar.dev']],
        ['contact jane at acme.co.uk', ['jane@acme.co.uk']],
        ['hello at mycompany dot co dot uk', ['hello@mycompany.co.uk']],
        ['Е-mаil: hn-september at kol3x dot com', ['hn-september@kol3x.com']], // Cyrillic Е and а
        ['Apply at jobs.acme.com', []],
        ['take a look at acme.com/careers', []],
        ['Check us out at acme.io', []],
        ['Our office at 5th Ave dot com', []],
        ['you@example.com or firstname@company.com', []],
    ];
    for (const [text, want] of cases) assert.deepEqual(extractEmails(text), want, text);
    assert.deepEqual(extractEmails('see link', [{ href: 'mailto:Team@Acme.io?subject=HN', text: 'mail us' }]), ['team@acme.io']);
});

test('links: anchors keep the full URL HN truncates, bare domains are found', () => {
    const { text, links } = htmlToText('Apply: <a href="https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;acme&#x2F;1234-5678-long-id" rel="nofollow">https:&#x2F;&#x2F;jobs.ashbyhq.com&#x2F;acme&#x2F;1234-5...</a><p>More at posthog.com/handbook. Thread: <a href="https://news.ycombinator.com/item?id=1">x</a>');
    assert.deepEqual(extractUrls(text, links), ['https://jobs.ashbyhq.com/acme/1234-5678-long-id', 'https://posthog.com/handbook']);
});

test('tech stack: canonical names, no false friends', () => {
    assert.deepEqual(extractTechStack('We use Go, Rust and Postgres on AWS with k8s'), ['Go', 'Rust', 'PostgreSQL', 'AWS', 'Kubernetes']);
    assert.deepEqual(extractTechStack('Spring 2027 internship in Phoenix, AZ. Let us go! We react fast.'), []);
    assert.deepEqual(extractTechStack('Elixir/Phoenix LiveView, C#/.NET'), ['C#', '.NET', 'Elixir', 'Phoenix']);
    assert.deepEqual(extractTechStack('Java and Kotlin'), ['Java', 'Kotlin']);
    assert.deepEqual(extractTechStack('React Native app'), ['React Native']);
    assert.deepEqual(['postgres', 'golang', 'k8s', 'nextjs', 'Unknown Thing'].map(canonicalTech), ['PostgreSQL', 'Go', 'Kubernetes', 'Next.js', 'Unknown Thing']);
});

test('header splitting respects parentheses and alternative separators', () => {
    assert.deepEqual(splitHeader('Acme (Remote | US) | Engineer | $100k').segments, ['Acme (Remote | US)', 'Engineer', '$100k']);
    assert.deepEqual(splitHeader('*Fastly | Engineers | Full-time*').segments, ['Fastly', 'Engineers', 'Full-time']);
    assert.deepEqual(splitHeader('Acme • Backend Engineer • Berlin').segments, ['Acme', 'Backend Engineer', 'Berlin']);
    assert.equal(splitHeader('Just a sentence about us').delimiter, null);
});

test('roles split on commas and "and", but qualifiers stay attached', () => {
    assert.deepEqual(splitRoles('Senior AI Engineer and Senior Product Engineer'), ['Senior AI Engineer', 'Senior Product Engineer']);
    assert.deepEqual(splitRoles('Data Engineer + Software Engineer'), ['Data Engineer', 'Software Engineer']);
    assert.deepEqual(splitRoles('Research Engineer, Alignment'), ['Research Engineer, Alignment']);
    assert.deepEqual(splitRoles('Senior Engineers (Agentic Engineer and Forward Deployed Engineer)'), ['Senior Engineers (Agentic Engineer and Forward Deployed Engineer)']);
});

test('workplace and visa wording', () => {
    assert.equal(workplaceOf('ONSITE (hybrid)').remote, 'hybrid');
    assert.equal(workplaceOf('NYC or Remote').remote, 'remote');
    assert.equal(workplaceOf('ON SITE TORONTO. REMOTE WILL BE IGNORED').remote, 'onsite');
    assert.equal(workplaceOf('3x/week in office').remote, 'hybrid');
    assert.equal(workplaceOf('London').remote, null);
    assert.equal(visaOf('Visa sponsorship available', ''), true);
    assert.equal(visaOf('NO VISA (EU work authorisation required)', ''), false);
    assert.equal(visaOf('', 'Unfortunately we cannot sponsor visas.'), false);
    assert.equal(visaOf('Remote (US)', 'Must be a U.S. Citizen'), false);
    assert.equal(visaOf('Remote', 'Great team.'), null);
});

test('freelancer thread posts are told apart', () => {
    assert.equal(postKind('freelancer', 'SEEKING WORK | React dev'), 'seeking_work');
    assert.equal(postKind('freelancer', 'SEEKING FREELANCER | Acme | Designer'), 'seeking_freelancer');
    assert.equal(postKind('freelancer', 'Looking for a designer'), 'unknown');
    assert.equal(postKind('hiring', 'SEEKING WORK'), 'hiring');
});

test('months and thread titles', () => {
    assert.equal(monthFromTitle('Ask HN: Who is hiring? (September 2026)'), '2026-09');
    assert.equal(monthFromTitle('Ask HN: Freelancer? Seeking freelancer? (October 2025)'), '2025-10');
    assert.equal(normalizeMonth('2026-9'), '2026-09');
    assert.equal(normalizeMonth('September 2026'), '2026-09');
    assert.equal(normalizeMonth('latest'), 'latest');
    assert.equal(normalizeMonth('2026-13'), null);
    assert.equal(currentMonth(new Date('2026-09-26T00:00:00Z')), '2026-09');
});

test('row filters', () => {
    const rows = [
        { rawText: 'Acme | Rust Engineer | Berlin', headline: 'Acme | Rust Engineer | Berlin', location: 'Berlin, Germany', remote: 'onsite', techStack: ['Rust', 'PostgreSQL'], parseConfidence: 1 },
        { rawText: 'Beta | Frontend | Remote (US)', headline: 'Beta | Frontend | Remote (US)', location: 'Remote (US)', remote: 'remote', techStack: ['React'], parseConfidence: 0.9 },
        { rawText: 'hello there', headline: 'hello there', location: null, remote: null, techStack: [], parseConfidence: 0.1 },
    ];
    const run = (f) => rows.filter(makeFilter(f)).map((r) => r.rawText.split(' ')[0]);
    assert.deepEqual(run({ keywords: ['RUST'] }), ['Acme']);
    assert.deepEqual(run({ remoteOnly: true }), ['Beta']);
    assert.deepEqual(run({ locations: ['berlin'] }), ['Acme']);
    assert.deepEqual(run({ locations: ['remote'] }), ['Beta']);
    assert.deepEqual(run({ techStack: ['postgres'] }), ['Acme']);
    assert.deepEqual(run({ minParseConfidence: 0.5 }), ['Acme', 'Beta']);
});
