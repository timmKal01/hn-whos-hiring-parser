import { Actor, log } from 'apify';
import { THREAD_TYPES, currentMonth, fetchPosts, findThread, normalizeMonth } from './hn.js';
import { parsePost } from './parse.js';
import { makeFilter } from './filter.js';

await Actor.init();

/** Must match the event name in this Actor's pay-per-event pricing. */
const POST_EVENT = 'parsed-post';

const input = (await Actor.getInput()) ?? {};
const {
    threadType = 'hiring',
    keywords,
    remoteOnly = false,
    locations,
    techStack,
    minParseConfidence: minConfidenceRaw = 0,
    maxItems,
    mode = 'snapshot',
    monitorStoreName = 'hn-whos-hiring-monitor',
} = input;

if (!THREAD_TYPES[threadType]) throw new Error(`threadType must be one of: ${Object.keys(THREAD_TYPES).join(', ')}`);
const monthsGiven = Array.isArray(input.months) && input.months.some((m) => String(m).trim());
const months = monthsGiven ? [...new Set(input.months.map(normalizeMonth))] : [currentMonth()];
if (months.includes(null)) throw new Error('Each month must look like "2026-09" (or "latest").');
// An empty form (first click, Apify's daily health check) gets a sample, not the whole thread.
const limit = maxItems > 0 ? maxItems : !monthsGiven && !keywords?.length ? 100 : Infinity;

const scrapedAt = new Date().toISOString();
const minParseConfidence = Number(minConfidenceRaw) || 0;
const keep = makeFilter({ keywords, remoteOnly, locations, techStack, minParseConfidence });
const monitor = mode === 'monitor' ? await Actor.openKeyValueStore(monitorStoreName) : null;

let pushed = 0;
let skippedMalformed = 0;
for (const wanted of months) {
    if (pushed >= limit) break;
    let thread = await findThread(threadType, wanted);
    if (!thread && !monthsGiven) {
        // Early on the 1st, this month's thread may not be posted yet.
        log.info(`No ${THREAD_TYPES[threadType].label} thread for ${wanted} yet; using the latest one.`);
        thread = await findThread(threadType, 'latest');
    }
    if (!thread) {
        const note = threadType === 'freelancer' ? ' HN stopped the monthly freelancer thread after October 2025.' : '';
        log.warning(`No ${THREAD_TYPES[threadType].label} thread found for ${wanted}.${note}`);
        continue;
    }

    const posts = await fetchPosts(thread.id);
    log.info(`${thread.title}: ${posts.length} posts`);

    let fresh = posts;
    let isFirstRun = false;
    if (monitor) {
        const key = `thread-${thread.id}`;
        const seen = new Set((await monitor.getValue(key))?.commentIds ?? []);
        isFirstRun = seen.size === 0;
        fresh = posts.filter((p) => !seen.has(String(p.id)));
        await monitor.setValue(key, { savedAt: scrapedAt, title: thread.title, commentIds: posts.map((p) => String(p.id)) });
        log.info(isFirstRun
            ? `Monitor: first run for this thread, saved ${posts.length} posts as the baseline; all are returned this time.`
            : `Monitor: ${fresh.length} new post(s) since the last run.`);
    }

    const rows = [];
    for (const post of fresh) {
        try {
            const p = parsePost(post.text, threadType);
            const row = {
                threadMonth: thread.month,
                threadType,
                threadId: thread.id,
                commentId: String(post.id),
                postKind: p.postKind,
                company: p.company,
                companyUrl: p.companyUrl,
                roles: p.roles,
                location: p.location,
                remote: p.remote,
                isRemote: p.remote === 'remote',
                employmentType: p.employmentType,
                salaryMin: p.salaryMin,
                salaryMax: p.salaryMax,
                salaryCurrency: p.salaryCurrency,
                salaryInterval: p.salaryInterval,
                hasEquity: p.hasEquity,
                visaSponsorship: p.visaSponsorship,
                willingToRelocate: p.willingToRelocate ?? null,
                techStack: p.techStack,
                applyUrl: p.applyUrl,
                resumeUrl: p.resumeUrl ?? null,
                websiteUrl: p.websiteUrl ?? null,
                contactEmail: p.contactEmail,
                links: p.urls,
                headline: p.headerLine,
                postedAt: post.created_at ? new Date(post.created_at).toISOString() : null,
                author: post.author ?? null,
                rawText: p.text,
                parseConfidence: p.parseConfidence,
                sourceUrl: `https://news.ycombinator.com/item?id=${post.id}`,
                scrapedAt,
            };
            if (keep(row)) rows.push(row);
        } catch (err) {
            skippedMalformed++;
            log.warning(`Skipping post ${post.id}: could not parse`, { error: err.message });
        }
        if (pushed + rows.length >= limit) break;
    }
    const batch = rows.slice(0, limit - pushed);
    if (batch.length) {
        await Actor.pushData(batch);
        await Actor.charge({ eventName: POST_EVENT, count: batch.length });
        pushed += batch.length;
    }
    log.info(`${thread.month}: returned ${batch.length} post(s) after filters.`);
}

log.info(`Done: ${pushed} post(s).${skippedMalformed ? ` ${skippedMalformed} skipped as unparseable.` : ''}${pushed >= limit && Number.isFinite(limit) ? ` Stopped at the ${limit} item limit.` : ''}`);
await Actor.exit();
