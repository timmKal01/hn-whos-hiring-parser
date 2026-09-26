# HN Who's Hiring Scraper: Hacker News Jobs Parsed

Every month, hundreds of startups and tech companies post jobs in the Hacker News **"Ask HN: Who is hiring?"** thread. The posts are free text, written however each poster likes. This actor reads the thread and turns every post into a clean row: **company, roles, location, remote / onsite / hybrid, salary range with currency, visa sponsorship, employment type, tech stack, apply link and contact email**, with a confidence score for each parse.

It also reads the **"Who wants to be hired?"** thread (people looking for work: location, remote preference, relocation, technologies, résumé link) and the older **"Freelancer? Seeking freelancer?"** threads.

## Who it's for

- **Job seekers** filtering 300+ posts a month down to "remote, Rust, visa sponsorship" in seconds.
- **Job boards and newsletters** republishing HN jobs in a structured feed.
- **Recruiters and sales teams**: a company posting on HN is hiring engineers right now.
- **Analysts** tracking salaries, remote share and tech-stack trends month over month.

## Input examples

This month's posts (the default; returns the first 100 when left empty):

```json
{ "months": ["latest"] }
```

Remote Rust or Go jobs from the last two months, cleanly parsed only:

```json
{
  "months": ["2026-09", "2026-08"],
  "techStack": ["Rust", "Go"],
  "remoteOnly": true,
  "minParseConfidence": "0.8"
}
```

New posts as they arrive (schedule daily; each run returns only posts added since the last one):

```json
{
  "months": ["latest"],
  "keywords": ["founding engineer", "staff"],
  "locations": ["London", "Remote"],
  "mode": "monitor",
  "monitorStoreName": "hn-founding-roles"
}
```

## Input fields

| Field | What it does |
|---|---|
| `months` | `YYYY-MM` or `latest`. Empty means the current month, falling back to the latest thread early on the 1st before it's posted. |
| `threadType` | `hiring` (default), `seeking_work` ("Who wants to be hired?"), or `freelancer` (monthly until October 2025, when HN stopped it). |
| `keywords` | Keep posts that mention any of these anywhere. |
| `remoteOnly` | Keep posts that offer remote work. |
| `locations` | Keep posts whose location or first line mentions any of these. `Remote` also matches remote posts. |
| `techStack` | Keep posts mentioning any of these technologies. Spelling is forgiving: `postgres`, `k8s`, `golang` work. |
| `minParseConfidence` | `0`, `0.5` or `0.8`. See below. |
| `maxItems` | Stop after this many rows. |
| `mode` | `snapshot` (every matching post) or `monitor` (only posts added since the last run). |
| `monitorStoreName` | Where monitor mode remembers what it has seen. One name per monitor. |

## Output

A real row from the September 2026 thread (text shortened):

```json
{
  "threadMonth": "2026-09",
  "threadType": "hiring",
  "threadId": "49522897",
  "commentId": "49523228",
  "postKind": "hiring",
  "company": "Attendi",
  "companyUrl": null,
  "roles": ["Machine Learning Engineer"],
  "location": "Amsterdam, Netherlands",
  "remote": "hybrid",
  "isRemote": false,
  "employmentType": "Full-time",
  "salaryMin": 6000,
  "salaryMax": 7000,
  "salaryCurrency": "EUR",
  "salaryInterval": "month",
  "hasEquity": false,
  "visaSponsorship": true,
  "willingToRelocate": null,
  "techStack": [],
  "applyUrl": "https://attendi.recruitee.com/o/machine-learning-engineer",
  "resumeUrl": null,
  "websiteUrl": null,
  "contactEmail": null,
  "links": ["https://attendi.recruitee.com/o/machine-learning-engineer"],
  "headline": "Attendi | Machine Learning Engineer | Amsterdam, Netherlands | ONSITE (hybrid) | €6,000 - €7,000 per month | Full-time (80–100%, ~4–5 days/week) | Visa sponsorship + 30% ruling possible",
  "postedAt": "2026-09-01T15:25:03.000Z",
  "author": "edwardfsoler",
  "rawText": "Attendi | Machine Learning Engineer | Amsterdam, Netherlands | ...",
  "parseConfidence": 1,
  "sourceUrl": "https://news.ycombinator.com/item?id=49523228",
  "scrapedAt": "2026-09-26T00:21:49.969Z"
}
```

### Field notes

- **`remote`**: `remote` when remote work is offered at all ("NYC or Remote", "ONSITE/REMOTE"), `hybrid` for hybrid-only, `onsite` when only in-office is offered or remote is ruled out ("REMOTE WILL BE IGNORED"). `null` when the post doesn't say.
- **Salary**: understands `$150k-$200k`, `150-200K USD`, `€6,000 - €7,000 per month`, `$120-160/hr`, `100-200k CHF`, `$200K+` (no maximum), `up to £90k` (no minimum). An explicit currency code beats the `$` sign (`$109K–$136K CAD` is CAD). When a post lists several roles with different pay, the range spans all of them. Percentages are equity, and "401K" is a retirement plan, not a salary. A post with no currency gets `salaryCurrency: null`, never a guess.
- **`visaSponsorship`**: `true` when offered, `false` when ruled out (including "US citizens only" or "work authorisation required"), `null` when not mentioned.
- **`contactEmail`**: the first email in the post, including the usual spellings meant to dodge spam bots (`jobs [at] acme [dot] com`, `hiring at acme dot com`). Only addresses the poster actually wrote are returned; none are guessed.
- **`techStack`**: matched against a maintained list of about 80 languages, frameworks, databases and cloud tools, with care for words that are also English: "Go" and "Spring" only count when they're clearly the technology, and Phoenix, AZ isn't the Elixir framework.
- **`postKind`**: `hiring`, `seeking_work`, or for the freelancer thread `seeking_freelancer` / `seeking_work`.

### Parse confidence

`parseConfidence` (0 to 1) says how much of the post could be read as structured data: a named company, roles, a location or remote policy, a pipe-separated first line, a way to apply, and pay or employment type. In September and August 2026, 84 to 88% of posts scored 0.8 or higher. The rest are posts that open with a paragraph instead of a header, or aren't job posts at all (meta comments, people posting in the wrong thread). Set `minParseConfidence` to `0.5` to drop most of those.

## Monitor mode

Each run remembers which posts it has seen per thread and returns only new ones. The first run saves a baseline and returns everything that matches (up to `maxItems`). Posts beyond `maxItems` on a run are marked as seen, not held over.

## FAQ

**Is this allowed?** It reads the public Hacker News Search API run by Algolia (hn.algolia.com/api). No scraping of news.ycombinator.com pages, no login, no proxy. Posts are fetched once per thread per run.

**How current is it?** Live: every run reads the thread as it is now, so new posts show up on the next run.

**Why is `company` sometimes empty?** Some posts start with the role ("Lead SWE | Toronto | ...") or with a paragraph. The actor only fills `company` when the post actually names it; `rawText` always has the full post.

**What about personal data in "Who wants to be hired?"** Those posts are written by people who want employers to contact them, and include what each person chose to share. Use it for that purpose, respect their stated preferences, and handle it under your own data-protection obligations (GDPR and similar).

**Can I get older months?** Yes, back to 2011 (tested with June 2011 and March 2014), e.g. `["2024-01", "2024-02"]`.

## Pricing

Pay per parsed post returned. Filters are applied before charging, so you only pay for posts that match.

## Disclaimer

This actor is unofficial and is not affiliated with, endorsed by, or connected to Hacker News, Y Combinator or Algolia. Post content belongs to its authors; each row links back to the original comment.
