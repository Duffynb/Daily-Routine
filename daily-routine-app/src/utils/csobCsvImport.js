function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Split one CSV line by `;`, respecting double-quoted fields. */
export function splitCsobCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ';' && !inQuotes) {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
}

function normalizeHeader(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseCsobAmount(raw) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function parseCsobDate(raw) {
  const m = String(raw || '')
    .trim()
    .match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const d = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== month - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d.toISOString();
}

function cleanText(value) {
  return String(value || '')
    .replace(/^"+|"+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractPlaceFromMessage(message) {
  const text = cleanText(message);
  if (!text) return '';
  const m = text.match(/M[ií]sto:\s*([^,]+(?:,\s*[^,]+)?)/i);
  if (!m) return '';
  return cleanText(m[1]);
}

export function buildSpendDescription(row) {
  const counterparty = cleanText(row['jmeno protistrany']);
  if (counterparty) return counterparty;

  const place = extractPlaceFromMessage(row['zprava']);
  if (place) return place;

  const standingOrder = cleanText(row['nazev trvaleho prikazu']);
  if (standingOrder) return standingOrder;

  const operation = cleanText(row['oznaceni operace']);
  if (operation) return operation;

  const category = cleanText(row['kategorie']);
  if (category) return category;

  return 'Platba';
}

/**
 * Parse ČSOB movement export text into raw row objects keyed by normalized header.
 */
export function parseCsobCsv(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length === 0) {
    throw new Error('CSV soubor je prázdný.');
  }

  let headerIndex = lines.findIndex((line) =>
    normalizeHeader(splitCsobCsvLine(line)[0]).includes('cislo uctu')
  );
  if (headerIndex < 0) {
    headerIndex = lines.findIndex((line) =>
      normalizeHeader(line).includes('id transakce')
    );
  }
  if (headerIndex < 0) {
    throw new Error('V CSV se nenašla hlavička ČSOB výpisu.');
  }

  const headers = splitCsobCsvLine(lines[headerIndex]).map(normalizeHeader);
  const idIdx = headers.indexOf('id transakce');
  if (idIdx < 0) {
    throw new Error('CSV neobsahuje sloupec ID transakce.');
  }

  const rows = [];
  for (let i = headerIndex + 1; i < lines.length; i += 1) {
    const fields = splitCsobCsvLine(lines[i]);
    if (fields.every((f) => !String(f).trim())) continue;
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = fields[idx] != null ? fields[idx] : '';
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Map parsed rows to spend-item candidates.
 * Outgoing only (amount < 0). Returns { items, ignored }.
 */
export function mapCsobRowsToSpendItems(rows) {
  const items = [];
  let ignored = 0;

  for (const row of rows) {
    const bankTxId = cleanText(row['id transakce']);
    const amountRaw = parseCsobAmount(row['castka']);
    const createdAt = parseCsobDate(row['datum zauctovani']);

    if (!bankTxId || amountRaw == null || !createdAt) {
      ignored += 1;
      continue;
    }

    // Only outgoing payments become expenses.
    if (amountRaw >= 0) {
      ignored += 1;
      continue;
    }

    items.push({
      id: nextId(),
      amount: Math.abs(amountRaw),
      description: buildSpendDescription(row),
      isSalary: false,
      createdAt,
      bankTxId,
    });
  }

  return { items, ignored };
}

/**
 * Merge incoming imported items into existing spend list (idempotent by bankTxId).
 */
export function mergeImportedSpendItems(existing, incoming) {
  const current = Array.isArray(existing) ? existing : [];
  const known = new Set(
    current
      .map((item) => (item?.bankTxId != null ? String(item.bankTxId).trim() : ''))
      .filter(Boolean)
  );

  const toAdd = [];
  let skipped = 0;

  for (const item of incoming) {
    const key = item?.bankTxId != null ? String(item.bankTxId).trim() : '';
    if (!key) {
      skipped += 1;
      continue;
    }
    if (known.has(key)) {
      skipped += 1;
      continue;
    }
    known.add(key);
    toAdd.push(item);
  }

  return {
    nextItems: [...current, ...toAdd],
    added: toAdd.length,
    skipped,
  };
}

export function importCsobCsvText(text, existingItems) {
  const rows = parseCsobCsv(text);
  const { items: candidates, ignored } = mapCsobRowsToSpendItems(rows);
  const { nextItems, added, skipped } = mergeImportedSpendItems(
    existingItems,
    candidates
  );
  return { nextItems, added, skipped, ignored };
}
