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
  todoItems: [],
  daylogItems: [],
  foodEntries: [],
  foodBurnEntries: [],
  spendEntries: [],
  passwordEntries: [],
  calorieGoal: 2000,
  daylogHourlyRate: 300,
};

export function normalizeLoaded(parsed) {
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_DATA };
  return {
    version: 1,
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

async function writeAppData(data) {
  const normalized = normalizeForSave(data);
  if (shouldUseSupabase()) {
    await supabaseUpsertData(normalized);
    return;
  }
  await fs.promises.writeFile(
    DATA_FILE,
    JSON.stringify(normalized, null, 2),
    'utf8'
  );
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
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
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
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
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

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    readAppData()
      .then((data) => {
        res.end(JSON.stringify(data));
      })
      .catch((e) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(e.message) }));
      });
    return;
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    readBody(req)
      .then((body) => {
        let data;
        try {
          data = JSON.parse(body || '{}');
        } catch {
          res.statusCode = 400;
          res.end('Invalid JSON');
          return;
        }
        writeAppData(data)
          .then(() => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          })
          .catch((e) => {
            res.statusCode = 500;
            res.end(String(e));
          });
      })
      .catch((e) => {
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
