import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_FILE = path.join(__dirname, '..', 'local-app-data.json');
const DATA_STORE = String(process.env.DATA_STORE || 'file').toLowerCase();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DATA_KEY = process.env.APP_DATA_KEY || 'daily-routine';

export const DEFAULT_DATA = {
  version: 1,
  revision: 0,
  updatedAt: null,
  todoItems: [],
  daylogItems: [],
  foodEntries: [],
  foodBurnEntries: [],
  spendEntries: [],
  passwordEntries: [],
  gratitudeDays: [],
  mindHeapItems: [],
  lessonEntries: [],
  calorieGoal: 2000,
  daylogHourlyRate: 300,
};

export function normalizeLoaded(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_DATA };
  return {
    version: 1,
    revision: Number.isFinite(Number(parsed.revision))
      ? Math.max(0, Math.floor(Number(parsed.revision)))
      : 0,
    updatedAt:
      typeof parsed.updatedAt === 'string' && parsed.updatedAt.trim() !== ''
        ? parsed.updatedAt
        : null,
    todoItems: Array.isArray(parsed.todoItems) ? parsed.todoItems : [],
    daylogItems: Array.isArray(parsed.daylogItems) ? parsed.daylogItems : [],
    foodEntries: Array.isArray(parsed.foodEntries) ? parsed.foodEntries : [],
    foodBurnEntries: Array.isArray(parsed.foodBurnEntries)
      ? parsed.foodBurnEntries
      : [],
    spendEntries: Array.isArray(parsed.spendEntries) ? parsed.spendEntries : [],
    passwordEntries: Array.isArray(parsed.passwordEntries)
      ? parsed.passwordEntries
      : [],
    gratitudeDays: Array.isArray(parsed.gratitudeDays) ? parsed.gratitudeDays : [],
    mindHeapItems: Array.isArray(parsed.mindHeapItems) ? parsed.mindHeapItems : [],
    lessonEntries: Array.isArray(parsed.lessonEntries) ? parsed.lessonEntries : [],
    calorieGoal: Number.isFinite(Number(parsed.calorieGoal))
      ? Number(parsed.calorieGoal)
      : 2000,
    daylogHourlyRate: Number.isFinite(Number(parsed.daylogHourlyRate))
      ? Math.max(0, Math.floor(Number(parsed.daylogHourlyRate)))
      : 300,
  };
}

export function normalizeForSave(data) {
  return {
    version: 1,
    revision: Number.isFinite(Number(data.revision))
      ? Math.max(0, Math.floor(Number(data.revision)))
      : 0,
    updatedAt:
      typeof data.updatedAt === 'string' && data.updatedAt.trim() !== ''
        ? data.updatedAt
        : null,
    todoItems: Array.isArray(data.todoItems) ? data.todoItems : [],
    daylogItems: Array.isArray(data.daylogItems) ? data.daylogItems : [],
    foodEntries: Array.isArray(data.foodEntries) ? data.foodEntries : [],
    foodBurnEntries: Array.isArray(data.foodBurnEntries)
      ? data.foodBurnEntries
      : [],
    spendEntries: Array.isArray(data.spendEntries) ? data.spendEntries : [],
    passwordEntries: Array.isArray(data.passwordEntries)
      ? data.passwordEntries
      : [],
    gratitudeDays: Array.isArray(data.gratitudeDays) ? data.gratitudeDays : [],
    mindHeapItems: Array.isArray(data.mindHeapItems) ? data.mindHeapItems : [],
    lessonEntries: Array.isArray(data.lessonEntries) ? data.lessonEntries : [],
    calorieGoal: Number.isFinite(Number(data.calorieGoal))
      ? Number(data.calorieGoal)
      : 2000,
    daylogHourlyRate: Number.isFinite(Number(data.daylogHourlyRate))
      ? Math.max(0, Math.floor(Number(data.daylogHourlyRate)))
      : 300,
  };
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function shouldUseSupabase() {
  return (
    DATA_STORE === 'supabase' &&
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.trim() !== '' &&
    typeof SUPABASE_SERVICE_ROLE_KEY === 'string' &&
    SUPABASE_SERVICE_ROLE_KEY.trim() !== ''
  );
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function supabaseGetRow() {
  const url =
    `${SUPABASE_URL}/rest/v1/app_state` +
    `?key=eq.${encodeURIComponent(DATA_KEY)}` +
    '&select=data&limit=1';
  const response = await fetch(url, {
    method: 'GET',
    headers: supabaseHeaders(),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase GET failed (${response.status}): ${body}`);
  }
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function supabaseUpsertData(data) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/app_state`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(),
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([{ key: DATA_KEY, data }]),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase UPSERT failed (${response.status}): ${body}`);
  }
}

async function readAppData() {
  if (shouldUseSupabase()) {
    const row = await supabaseGetRow();
    if (!row || row.data == null) return { ...DEFAULT_DATA };
    const parsed = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return normalizeLoaded(parsed || DEFAULT_DATA);
  }
  if (!fs.existsSync(DATA_FILE)) return { ...DEFAULT_DATA };
  const raw = await fs.promises.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  return normalizeLoaded(parsed);
}

async function writeAppData(data, expectedRevision) {
  const current = await readAppData();
  const hasExpectedRevision = Number.isFinite(Number(expectedRevision));
  const expected = hasExpectedRevision
    ? Math.max(0, Math.floor(Number(expectedRevision)))
    : null;

  if (hasExpectedRevision && current.revision !== expected) {
    return { ok: false, conflict: true, current };
  }

  const normalized = normalizeForSave(data);
  const nextData = {
    ...normalized,
    revision: Math.max(0, Math.floor(Number(current.revision) || 0)) + 1,
    updatedAt: new Date().toISOString(),
  };

  if (shouldUseSupabase()) {
    await supabaseUpsertData(nextData);
    return { ok: true, data: nextData };
  }
  await fs.promises.writeFile(DATA_FILE, JSON.stringify(nextData, null, 2), 'utf8');
  return { ok: true, data: nextData };
}

async function estimateCaloriesViaOpenAi(foodText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'Jsi nutriční asistent. Odpovídej pouze validním JSON bez markdownu.',
        },
        {
          role: 'user',
          content:
            `Odhadni kalorie pro jídlo: "${foodText}". ` +
            'Vrať jen JSON: {"estimatedCalories": number, "reason": string}.',
        },
      ],
      max_output_tokens: 180,
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const text = payload?.output_text || '{}';
  const parsed = JSON.parse(text);
  const estimatedCalories = Number(parsed?.estimatedCalories);

  if (!Number.isFinite(estimatedCalories) || estimatedCalories < 0) {
    throw new Error('OpenAI response does not include valid estimatedCalories');
  }

  return {
    estimatedCalories: Math.round(estimatedCalories),
    reason: String(parsed?.reason || ''),
  };
}

async function estimateCaloriesViaGroq(foodText) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Jsi nutriční asistent. Odpovídej pouze validním JSON bez markdownu.',
        },
        {
          role: 'user',
          content:
            `Odhadni kalorie pro jídlo: "${foodText}". ` +
            'Vrať jen JSON: {"estimatedCalories": number, "reason": string}.',
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(text);
  const estimatedCalories = Number(parsed?.estimatedCalories);

  if (!Number.isFinite(estimatedCalories) || estimatedCalories < 0) {
    throw new Error('Groq response does not include valid estimatedCalories');
  }

  return {
    estimatedCalories: Math.round(estimatedCalories),
    reason: String(parsed?.reason || ''),
  };
}

async function estimateCaloriesViaProvider(foodText) {
  const provider = String(process.env.AI_PROVIDER || 'groq').toLowerCase();
  if (provider === 'openai') {
    const result = await estimateCaloriesViaOpenAi(foodText);
    return { ...result, provider: 'openai' };
  }
  const result = await estimateCaloriesViaGroq(foodText);
  return { ...result, provider: 'groq' };
}

async function estimateBurnViaOpenAi(activityText, durationText) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing');
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content:
            'Jsi fitness asistent. Odpovídej pouze validním JSON bez markdownu.',
        },
        {
          role: 'user',
          content:
            `Odhadni spálené kalorie pro aktivitu "${activityText}" ` +
            `po dobu "${durationText}". ` +
            'Vrať jen JSON: {"estimatedCalories": number, "reason": string}.',
        },
      ],
      max_output_tokens: 180,
      text: { format: { type: 'json_object' } },
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI burn request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const text = payload?.output_text || '{}';
  const parsed = JSON.parse(text);
  const estimatedCalories = Number(parsed?.estimatedCalories);

  if (!Number.isFinite(estimatedCalories) || estimatedCalories < 0) {
    throw new Error('OpenAI burn response does not include valid estimatedCalories');
  }

  return {
    estimatedCalories: Math.round(estimatedCalories),
    reason: String(parsed?.reason || ''),
  };
}

async function estimateBurnViaGroq(activityText, durationText) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Jsi fitness asistent. Odpovídej pouze validním JSON bez markdownu.',
        },
        {
          role: 'user',
          content:
            `Odhadni spálené kalorie pro aktivitu "${activityText}" ` +
            `po dobu "${durationText}". ` +
            'Vrať jen JSON: {"estimatedCalories": number, "reason": string}.',
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Groq burn request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(text);
  const estimatedCalories = Number(parsed?.estimatedCalories);

  if (!Number.isFinite(estimatedCalories) || estimatedCalories < 0) {
    throw new Error('Groq burn response does not include valid estimatedCalories');
  }

  return {
    estimatedCalories: Math.round(estimatedCalories),
    reason: String(parsed?.reason || ''),
  };
}

async function estimateBurnViaProvider(activityText, durationText) {
  const provider = String(process.env.AI_PROVIDER || 'groq').toLowerCase();
  if (provider === 'openai') {
    const result = await estimateBurnViaOpenAi(activityText, durationText);
    return { ...result, provider: 'openai' };
  }
  const result = await estimateBurnViaGroq(activityText, durationText);
  return { ...result, provider: 'groq' };
}

export function appDataMiddleware(req, res, next) {
  const url = req.url.split('?')[0];
  if (url !== '/api/app-data') {
    next();
    return;
  }

  const requestId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const storeMode = shouldUseSupabase() ? 'supabase' : 'file';
  const ip =
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const userAgent = String(req.headers['user-agent'] || '');
  const uaShort = userAgent.length > 120 ? `${userAgent.slice(0, 120)}...` : userAgent;
  const logBase = `[api/app-data][${requestId}]`;

  if (req.method === 'GET') {
    console.log(`${logBase} GET start store=${storeMode} key=${DATA_KEY} ip=${ip} ua="${uaShort}"`);
    res.setHeader('Content-Type', 'application/json');
    readAppData()
      .then((data) => {
        console.log(
          `${logBase} GET ok rev=${data?.revision ?? 0} todo=${
            Array.isArray(data?.todoItems) ? data.todoItems.length : 0
          } food=${
            Array.isArray(data?.foodEntries) ? data.foodEntries.length : 0
          } spend=${Array.isArray(data?.spendEntries) ? data.spendEntries.length : 0}`
        );
        res.end(
          JSON.stringify({
            ...data,
            persistence: storeMode,
          })
        );
      })
      .catch((e) => {
        console.error(`${logBase} GET error store=${storeMode}:`, e);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(e.message) }));
      });
    return;
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    console.log(
      `${logBase} ${req.method} start store=${storeMode} key=${DATA_KEY} ip=${ip} ua="${uaShort}"`
    );
    readBody(req)
      .then((body) => {
        console.log(`${logBase} ${req.method} body-bytes=${Buffer.byteLength(body || '', 'utf8')}`);
        let data;
        try {
          data = JSON.parse(body || '{}');
        } catch {
          console.warn(`${logBase} ${req.method} invalid-json`);
          res.statusCode = 400;
          res.end('Invalid JSON');
          return;
        }
        const expectedRevision = Number(data?.expectedRevision);
        const incomingData =
          data && typeof data === 'object' && data.data && typeof data.data === 'object'
            ? data.data
            : data;

        writeAppData(incomingData, expectedRevision)
          .then((result) => {
            if (result?.conflict) {
              console.warn(
                `${logBase} ${req.method} conflict expected=${Number.isFinite(expectedRevision) ? Math.floor(expectedRevision) : 'none'} current=${result.current?.revision ?? 0}`
              );
              res.statusCode = 409;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  ok: false,
                  error: 'revision_conflict',
                  current: {
                    ...result.current,
                    persistence: storeMode,
                  },
                })
              );
              return;
            }

            const saved = result?.data || normalizeForSave(incomingData);
            console.log(
              `${logBase} ${req.method} ok rev=${saved.revision ?? 0} todo=${saved.todoItems.length} food=${saved.foodEntries.length} spend=${saved.spendEntries.length}`
            );
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                ok: true,
                revision: saved.revision ?? 0,
                updatedAt: saved.updatedAt ?? null,
              })
            );
          })
          .catch((e) => {
            console.error(`${logBase} ${req.method} write-error store=${storeMode}:`, e);
            res.statusCode = 500;
            res.end(String(e));
          });
      })
      .catch((e) => {
        console.error(`${logBase} ${req.method} read-body-error:`, e);
        res.statusCode = 500;
        res.end(String(e));
      });
    return;
  }

  res.statusCode = 405;
  res.end();
}

export function foodEstimateMiddleware(req, res, next) {
  const url = req.url.split('?')[0];
  if (url !== '/api/food-estimate') {
    next();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  readBody(req)
    .then(async (body) => {
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch {
        res.statusCode = 400;
        res.end('Invalid JSON');
        return;
      }

      const text = String(data?.text || '').trim();
      if (!text) {
        res.statusCode = 400;
        res.end('Field "text" is required');
        return;
      }

      try {
        const result = await estimateCaloriesViaProvider(text);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: String(error?.message || error),
          })
        );
      }
    })
    .catch((e) => {
      res.statusCode = 500;
      res.end(String(e));
    });
}

export function activityBurnEstimateMiddleware(req, res, next) {
  const url = req.url.split('?')[0];
  if (url !== '/api/activity-burn-estimate') {
    next();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  readBody(req)
    .then(async (body) => {
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch {
        res.statusCode = 400;
        res.end('Invalid JSON');
        return;
      }

      const activity = String(data?.activity || '').trim();
      const duration = String(data?.duration || '').trim();
      if (!activity || !duration) {
        res.statusCode = 400;
        res.end('Fields "activity" and "duration" are required');
        return;
      }

      try {
        const result = await estimateBurnViaProvider(activity, duration);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ ok: true, ...result }));
      } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: String(error?.message || error),
          })
        );
      }
    })
    .catch((e) => {
      res.statusCode = 500;
      res.end(String(e));
    });
}

const BOOK_SUMMARY_UA = 'DailyRoutineApp/1.0 (personal; book-summary)';

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDescription(raw) {
  if (!raw) return '';
  if (typeof raw === 'string') return stripHtml(raw);
  if (typeof raw === 'object' && typeof raw.value === 'string') return stripHtml(raw.value);
  return '';
}

async function fetchJsonExternal(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': BOOK_SUMMARY_UA,
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function wikipediaSummaryForQuery(query, lang) {
  const searchUrl =
    `https://${lang}.wikipedia.org/w/api.php` +
    `?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    `&srlimit=5&format=json&utf8=1&origin=*`;
  const searchPayload = await fetchJsonExternal(searchUrl);
  const hits = Array.isArray(searchPayload?.query?.search)
    ? searchPayload.query.search
    : [];
  if (hits.length === 0) return null;

  const preferred =
    hits.find((h) =>
      /kniha|román|literár|novel|book|fiction|pohád/i.test(
        `${h.title || ''} ${h.snippet || ''}`
      )
    ) || hits[0];

  const title = preferred?.title;
  if (!title) return null;

  const summaryUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, '_')
  )}`;
  const summary = await fetchJsonExternal(summaryUrl);
  const extract = String(summary?.extract || '').trim();
  if (!extract) return null;

  return {
    title: summary?.title || title,
    summary: extract,
    source: `Wikipedia (${lang})`,
    sourceUrl:
      summary?.content_urls?.desktop?.page ||
      `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    image: summary?.thumbnail?.source || null,
    authors: [],
    year: null,
  };
}

async function openLibrarySummaryForQuery(query) {
  const searchUrl =
    `https://openlibrary.org/search.json` +
    `?q=${encodeURIComponent(query)}` +
    `&limit=5&fields=key,title,author_name,first_publish_year,cover_i,edition_count`;
  const searchPayload = await fetchJsonExternal(searchUrl);
  const docs = Array.isArray(searchPayload?.docs) ? searchPayload.docs : [];
  if (docs.length === 0) return null;

  const ranked = [...docs].sort(
    (a, b) => (Number(b.edition_count) || 0) - (Number(a.edition_count) || 0)
  );

  for (const doc of ranked.slice(0, 3)) {
    const workKey = String(doc.key || '');
    if (!workKey.startsWith('/works/')) continue;
    try {
      const work = await fetchJsonExternal(`https://openlibrary.org${workKey}.json`);
      const description = normalizeDescription(work?.description);
      if (!description) continue;
      const coverId = doc.cover_i || (Array.isArray(work?.covers) ? work.covers[0] : null);
      return {
        title: doc.title || work.title || query,
        summary: description,
        source: 'Open Library',
        sourceUrl: `https://openlibrary.org${workKey}`,
        image: coverId
          ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
          : null,
        authors: Array.isArray(doc.author_name) ? doc.author_name : [],
        year: Number.isFinite(Number(doc.first_publish_year))
          ? Number(doc.first_publish_year)
          : null,
      };
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function extractBookMessageViaGroq({ query, title, authors, contextSummary }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is missing');
  }

  const authorLine =
    Array.isArray(authors) && authors.length > 0 ? authors.join(', ') : '';
  const contextBlock = contextSummary
    ? `Kontext z volného zdroje:\n"""${contextSummary.slice(0, 1200)}"""\n`
    : '';

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'Jsi literární asistent. Odpovídej pouze validním JSON bez markdownu. ' +
            'Piš česky. Nesnaž se přepisovat celý děj se spoilerovými detaily; ' +
            'soustřeď se na hlavní poselství a praktické poučení z knihy. ' +
            'Pokud si nejsi jistý konkrétní knihou, řekni to v poli "confidenceNote".',
        },
        {
          role: 'user',
          content:
            `Uživatel hledá výcuc poselství knihy podle dotazu: "${query}".\n` +
            (title ? `Nalezený název: "${title}".\n` : '') +
            (authorLine ? `Autor(ři): ${authorLine}.\n` : '') +
            contextBlock +
            'Vrať jen JSON tvaru:\n' +
            '{' +
            '"resolvedTitle": string, ' +
            '"authors": string[], ' +
            '"overview": string, ' +
            '"mainMessage": string, ' +
            '"keyTakeaways": string[], ' +
            '"confidenceNote": string' +
            '}.\n' +
            'Požadavky: overview = 1-2 věty o čem kniha je; ' +
            'mainMessage = 2-4 věty s jádrem poselství; ' +
            'keyTakeaways = 3 až 6 krátkých bodů (poučení / principy); ' +
            'confidenceNote = krátká poznámka o jistotě identifikace knihy.',
        },
      ],
    }),
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Groq request failed (${response.status}): ${details}`);
  }

  const payload = await response.json();
  const text = payload?.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(text);
  const mainMessage = String(parsed?.mainMessage || '').trim();
  if (!mainMessage) {
    throw new Error('Groq response does not include mainMessage');
  }

  const keyTakeaways = Array.isArray(parsed?.keyTakeaways)
    ? parsed.keyTakeaways.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    resolvedTitle: String(parsed?.resolvedTitle || title || query).trim(),
    authors: Array.isArray(parsed?.authors)
      ? parsed.authors.map((a) => String(a || '').trim()).filter(Boolean)
      : [],
    overview: String(parsed?.overview || '').trim(),
    mainMessage,
    keyTakeaways,
    confidenceNote: String(parsed?.confidenceNote || '').trim(),
    provider: 'groq',
  };
}

async function lookupBookBase(query) {
  const errors = [];
  for (const lang of ['cs', 'en']) {
    try {
      const wiki = await wikipediaSummaryForQuery(query, lang);
      if (wiki?.summary) return { base: wiki, errors };
    } catch (error) {
      errors.push(`wikipedia:${lang}: ${String(error?.message || error)}`);
    }
  }

  try {
    const openLibrary = await openLibrarySummaryForQuery(query);
    if (openLibrary?.summary) return { base: openLibrary, errors };
  } catch (error) {
    errors.push(`openlibrary: ${String(error?.message || error)}`);
  }

  return { base: null, errors };
}

export async function lookupBookSummary(query) {
  const q = String(query || '').trim();
  if (!q) throw new Error('Field "query" is required');

  const { base } = await lookupBookBase(q);

  try {
    const insight = await extractBookMessageViaGroq({
      query: q,
      title: base?.title || '',
      authors: base?.authors || [],
      contextSummary: base?.summary || '',
    });

    return {
      ok: true,
      query: q,
      title: insight.resolvedTitle || base?.title || q,
      authors:
        insight.authors.length > 0
          ? insight.authors
          : Array.isArray(base?.authors)
            ? base.authors
            : [],
      year: base?.year ?? null,
      image: base?.image || null,
      source: base?.source || 'Groq (free)',
      sourceUrl: base?.sourceUrl || null,
      overview: insight.overview,
      mainMessage: insight.mainMessage,
      keyTakeaways: insight.keyTakeaways,
      confidenceNote: insight.confidenceNote,
      // Keep raw blurb for optional display / debugging context.
      summary: insight.overview || base?.summary || insight.mainMessage,
      provider: insight.provider,
    };
  } catch (error) {
    if (base?.summary) {
      // Fallback: at least return free-source blurb if Groq fails.
      return {
        ok: true,
        query: q,
        ...base,
        overview: base.summary,
        mainMessage: '',
        keyTakeaways: [],
        confidenceNote:
          'Nepodařilo se vygenerovat poselství přes Groq — zobrazuji jen volný popis zdroje.',
        provider: null,
        groqError: String(error?.message || error),
      };
    }

    const err = new Error(
      `Nepodařilo se připravit výcuc poselství. ${String(error?.message || error)}`
    );
    err.code = 'NOT_FOUND';
    throw err;
  }
}

export function bookSummaryMiddleware(req, res, next) {
  const url = req.url.split('?')[0];
  if (url !== '/api/book-summary') {
    next();
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
    return;
  }

  readBody(req)
    .then(async (body) => {
      let data;
      try {
        data = JSON.parse(body || '{}');
      } catch {
        res.statusCode = 400;
        res.end('Invalid JSON');
        return;
      }

      const query = String(data?.query || data?.title || '').trim();
      if (!query) {
        res.statusCode = 400;
        res.end('Field "query" is required');
        return;
      }

      try {
        const result = await lookupBookSummary(query);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
      } catch (error) {
        const notFound = error?.code === 'NOT_FOUND';
        res.statusCode = notFound ? 404 : 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(
          JSON.stringify({
            ok: false,
            error: String(error?.message || error),
          })
        );
      }
    })
    .catch((e) => {
      res.statusCode = 500;
      res.end(String(e));
    });
}
