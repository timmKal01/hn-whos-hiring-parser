# Pricing proposal: hn-whos-hiring-parser

Not set on Apify yet. For review.

## Proposal

| Event | Price | Charged when |
|---|---|---|
| `parsed-post` | **$0.003** ($3 per 1,000 posts) | Once per post returned, after filters |

No start fee.

## Reasoning

**What a full month costs a user:** a "Who is hiring?" thread has 230 to 600 top-level posts, so a complete month is $0.70 to $1.80. A filtered run (remote + one language) is typically 10 to 30 posts, a few cents.

**Competitors** (Apify Store search on 2026-09-26 for "who is hiring", "hacker news jobs", "hn hiring"; Free-tier price per item):

| Actor | Users | Per post |
|---|---|---|
| logiover/hacker-news-who-is-hiring-scraper | 59 | $0.0035 |
| seemuapps/hn-who-is-hiring-scraper | 8 | $0.002 |
| nexgendata/hn-whos-hiring-scraper | 6 | $0.05 |
| getascraper/hn-hiring-scraper | 4 | $0.00089 |
| tqm/hackernews-job-scraper | 2 | $0.0015 |

The niche is small (the leader has 59 users) and prices cluster at $0.0015 to $0.0035. $0.003 sits just under the leader, and the parse quality is the differentiator: normalized salary with currency and interval, visa and remote classification, a confidence score, and 57 unit tests against real posts. Monitor mode also makes a daily schedule cheap (a few new posts a day after the first week).

**Why not the portfolio's $0.007:** twice the leader's price for the same thread would be hard to justify on the Store page, and buyers here compare prices directly.

**Cost to run:** negligible. Two or three JSON requests per month read, no proxy. The default run takes about 5 seconds.

**Empty-input run:** returns 100 posts, $0.30 at this price.
