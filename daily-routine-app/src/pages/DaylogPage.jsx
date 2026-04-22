import React, { Component } from 'react';

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Vrátí kanonické http(s) URL nebo null. Bez schématu doplní https:// */
function normalizeIssueUrl(raw) {
  let s = String(raw).trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    s = `https://${s}`;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function shortUrlLabel(href, maxLen = 42) {
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '');
    let out = host + u.pathname + u.search;
    if (out.length > maxLen) return `${out.slice(0, maxLen - 1)}…`;
    return out || host;
  } catch {
    return href.length > maxLen ? `${href.slice(0, maxLen - 1)}…` : href;
  }
}

/** GitLab/GitHub apod.: …/-/issues/2875 nebo …/issues/2875 → klikací text #2875 */
function issueAnchorLabel(href) {
  const matches = [...String(href).matchAll(/\/issues\/(\d+)/g)];
  if (matches.length > 0) {
    return `#${matches[matches.length - 1][1]}`;
  }
  return shortUrlLabel(href);
}

/** Aktuální odkaz na issue; staré záznamy jen s issueNumber → null */
function resolveIssueHref(item) {
  if (item.issueUrl != null && String(item.issueUrl).trim() !== '') {
    return normalizeIssueUrl(item.issueUrl);
  }
  return null;
}

/** Normalizuje mezery a parsuje např. "30m", "1h", "1h 30m", "2h15m". Vrací minuty nebo null. */
function parseDurationToMinutes(raw) {
  const compact = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!compact) return null;

  let m = compact.match(/^(\d+)m$/);
  if (m) return parseInt(m[1], 10);

  m = compact.match(/^(\d+)h(?:(\d+)m)?$/);
  if (m) {
    const hours = parseInt(m[1], 10);
    const mins = m[2] != null ? parseInt(m[2], 10) : 0;
    return hours * 60 + mins;
  }

  return null;
}

function formatMinutes(total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function sectionLabelForKey(key, todayStart, yesterdayStart) {
  if (key === 'today') return 'Dnes';
  if (key === 'yesterday') return 'Včera';
  const day = new Date(Number(key));
  return day.toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupItemsByDay(items, now = new Date()) {
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = todayStart - 86400000;

  const map = new Map();
  for (const item of items) {
    const created = new Date(item.createdAt);
    const dayStart = startOfLocalDay(created);
    let key;
    if (dayStart === todayStart) key = 'today';
    else if (dayStart === yesterdayStart) key = 'yesterday';
    else key = String(dayStart);

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }

  const keys = [...map.keys()].sort((a, b) => {
    if (a === 'today') return -1;
    if (b === 'today') return 1;
    if (a === 'yesterday') return -1;
    if (b === 'yesterday') return 1;
    return Number(b) - Number(a);
  });

  return { map, keys, todayStart, yesterdayStart };
}

function sumSpentMinutes(dayItems) {
  return dayItems.reduce(
    (acc, i) => acc + (i.spentMinutes != null ? i.spentMinutes : 0),
    0
  );
}

const DAYLOG_DAILY_LIMIT_MINUTES = 8 * 60;
const WORKDAY_START_HOUR = 8;
const WORKDAY_END_HOUR = 16;
const DEFAULT_HOURLY_RATE = 300;

function clampProgressPercent(totalMinutes) {
  return Math.max(
    0,
    Math.min(100, (Number(totalMinutes) / DAYLOG_DAILY_LIMIT_MINUTES) * 100)
  );
}

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Pracovní den pro výdělek: ne víkend, ne pevný státní svátek (stejná sada jako kalendář). */
function isEarningsCountingDay(date = new Date()) {
  if (isWeekend(date)) return false;
  if (isCzechFixedHoliday(date)) return false;
  return true;
}

function earnedHoursToday(now = new Date()) {
  if (!isEarningsCountingDay(now)) return 0;
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const hourWithMinutes = currentHour + currentMinute / 60;
  const fullHours = Math.floor(hourWithMinutes) - WORKDAY_START_HOUR;
  return Math.max(0, Math.min(WORKDAY_END_HOUR - WORKDAY_START_HOUR, fullHours));
}

function earningsPhaseClass(now = new Date()) {
  if (!isEarningsCountingDay(now)) return 'daylog-earnings-box--off';
  const hour = now.getHours();
  if (hour < WORKDAY_START_HOUR) return 'daylog-earnings-box--before';
  if (hour >= WORKDAY_END_HOUR) return 'daylog-earnings-box--done';
  return 'daylog-earnings-box--active';
}

function formatMoneyCzk(value) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

function sumTodaySpent(spendItems, now = new Date()) {
  if (!Array.isArray(spendItems)) return 0;
  const todayStart = startOfLocalDay(now);
  return spendItems.reduce((acc, item) => {
    const createdAt = new Date(item?.createdAt);
    if (Number.isNaN(createdAt.getTime())) return acc;
    if (startOfLocalDay(createdAt) !== todayStart) return acc;
    if (item?.isSalary) return acc;
    const amount = Number(item?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return acc;
    return acc + amount;
  }, 0);
}

function progressColorClass(totalMinutes) {
  const n = Number(totalMinutes) || 0;
  if (n < 1) return 'progress-gray';
  if (n < 4 * 60) return 'progress-red';
  if (n < 6 * 60) return 'progress-orange';
  if (n < 7 * 60) return 'progress-yellow';
  return 'progress-green';
}

function dayTotalsByStart(items) {
  const map = new Map();
  for (const item of items) {
    const dayStart = startOfLocalDay(new Date(item.createdAt));
    const prev = map.get(dayStart) || 0;
    map.set(dayStart, prev + (item.spentMinutes != null ? item.spentMinutes : 0));
  }
  return map;
}

function isCzechFixedHoliday(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const key = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const fixed = new Set([
    '01-01',
    '05-01',
    '05-08',
    '07-05',
    '07-06',
    '09-28',
    '10-28',
    '11-17',
    '12-24',
    '12-25',
    '12-26',
  ]);
  return fixed.has(key);
}

function monthTitle(date) {
  return date.toLocaleDateString('cs-CZ', {
    month: 'long',
    year: 'numeric',
  });
}

function buildMonthCalendar(baseDate, totalsMap) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = (firstDay.getDay() + 6) % 7; // pondeli=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ kind: 'empty', key: `e-${i}` });
  }

  for (let d = 1; d <= daysInMonth; d += 1) {
    const date = new Date(year, month, d);
    const dayStart = startOfLocalDay(date);
    const weekday = date.getDay(); // 0..6
    const isWeekend = weekday === 0 || weekday === 6;
    const isHoliday = isCzechFixedHoliday(date);
    const workedMinutes = totalsMap.get(dayStart) || 0;
    cells.push({
      kind: 'day',
      key: `d-${d}`,
      day: d,
      workedMinutes,
      isWeekend,
      isHoliday,
      progressClass: progressColorClass(workedMinutes),
    });
  }
  return { cells, title: monthTitle(firstDay) };
}

function stripLegacyIssueFields(item) {
  const { issueNumber: _n, ...rest } = item;
  return rest;
}

export default class DaylogPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      urlDraft: '',
      descDraft: '',
      timeDraft: '',
      timeError: '',
      linkError: '',
      editingId: null,
      editUrl: '',
      editTime: '',
      editDesc: '',
      editError: '',
      calendarOpen: false,
      calendarOffset: 0,
      hourlyRateDraft: String(
        Number.isFinite(Number(this.props.hourlyRate))
          ? Math.max(0, Math.floor(Number(this.props.hourlyRate)))
          : DEFAULT_HOURLY_RATE
      ),
      hourlyRateError: '',
      nowTick: Date.now(),
    };
    this.editUrlRef = React.createRef();
    this.clockTimer = null;
  }

  get items() {
    const { items } = this.props;
    return Array.isArray(items) ? items : [];
  }

  get spendItems() {
    const { spendItems } = this.props;
    return Array.isArray(spendItems) ? spendItems : [];
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.editingId &&
      this.state.editingId !== prevState.editingId
    ) {
      const el = this.editUrlRef.current;
      if (el) el.focus();
    }
    if (prevProps.hourlyRate !== this.props.hourlyRate) {
      const parsed = Number(this.props.hourlyRate);
      const safeValue = Number.isFinite(parsed)
        ? Math.max(0, Math.floor(parsed))
        : DEFAULT_HOURLY_RATE;
      if (String(safeValue) !== this.state.hourlyRateDraft) {
        this.setState({ hourlyRateDraft: String(safeValue), hourlyRateError: '' });
      }
    }
  }

  componentDidMount() {
    this.clockTimer = window.setInterval(() => {
      this.setState({ nowTick: Date.now() });
    }, 30000);
  }

  componentWillUnmount() {
    if (this.clockTimer) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  clearAddErrors = () => {
    if (this.state.timeError || this.state.linkError) {
      this.setState({ timeError: '', linkError: '' });
    }
  };

  handleUrlChange = (e) => {
    this.setState({ urlDraft: e.target.value });
    this.clearAddErrors();
  };

  handleDescChange = (e) => {
    this.setState({ descDraft: e.target.value });
    this.clearAddErrors();
  };

  handleTimeChange = (e) => {
    this.setState({ timeDraft: e.target.value });
    this.clearAddErrors();
  };

  handleHourlyRateChange = (e) => {
    const raw = e.target.value;
    this.setState({ hourlyRateDraft: raw, hourlyRateError: '' });
  };

  parsedHourlyRate() {
    const n = Number(this.state.hourlyRateDraft);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }

  commitHourlyRate = () => {
    const parsed = this.parsedHourlyRate();
    if (parsed === null) {
      this.setState({
        hourlyRateError: 'Zadejte prosím platnou nezápornou sazbu.',
      });
      return;
    }
    this.setState({ hourlyRateDraft: String(parsed), hourlyRateError: '' });
    const { onHourlyRateChange } = this.props;
    if (typeof onHourlyRateChange === 'function') {
      onHourlyRateChange(parsed);
    }
  };

  addItem = () => {
    const urlRaw = this.state.urlDraft.trim();
    const description = this.state.descDraft.trim();
    const timeRaw = this.state.timeDraft.trim();

    if (!urlRaw || !description) return;

    const issueUrl = normalizeIssueUrl(urlRaw);
    if (!issueUrl) {
      this.setState({
        linkError:
          'Neplatná adresa issue. Zadejte celé URL (https://…) nebo doménu s cestou (doplní se https://).',
        timeError: '',
      });
      return;
    }

    const spentMinutes = timeRaw === '' ? null : parseDurationToMinutes(timeRaw);
    if (timeRaw !== '' && spentMinutes === null) {
      this.setState({
        timeError:
          'Neplatný čas. Použijte např. 30m, 1h nebo 1h 30m (mezeru mezi h a m lze vynechat).',
        linkError: '',
      });
      return;
    }

    this.props.onItemsChange([
      ...this.items,
      {
        id: nextId(),
        issueUrl,
        description,
        spentMinutes,
        createdAt: new Date().toISOString(),
        completed: false,
      },
    ]);
    this.setState({
      urlDraft: '',
      descDraft: '',
      timeDraft: '',
      timeError: '',
      linkError: '',
    });
  };

  handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addItem();
    }
  };

  removeItem = (id) => {
    if (this.state.editingId === id) {
      this.cancelRowEdit();
    }
    this.props.onItemsChange(this.items.filter((i) => i.id !== id));
  };

  toggleComplete = (id) => {
    this.props.onItemsChange(
      this.items.map((i) =>
        i.id === id ? { ...i, completed: !i.completed } : i
      )
    );
  };

  startRowEdit = (item) => {
    const href = resolveIssueHref(item);
    this.setState({
      editingId: item.id,
      editUrl: href || '',
      editTime:
        item.spentMinutes != null
          ? formatMinutes(item.spentMinutes)
          : '',
      editDesc: item.description,
      editError: '',
    });
  };

  cancelRowEdit = () => {
    this.setState({
      editingId: null,
      editUrl: '',
      editTime: '',
      editDesc: '',
      editError: '',
    });
  };

  saveRowEdit = () => {
    const { editingId, editUrl, editTime, editDesc } = this.state;
    if (!editingId) return;

    const urlRaw = editUrl.trim();
    const description = editDesc.trim();
    const timeRaw = editTime.trim();

    if (!urlRaw || !description) {
      this.setState({
        editError: 'Vyplňte odkaz na issue a popis.',
      });
      return;
    }

    const issueUrl = normalizeIssueUrl(urlRaw);
    if (!issueUrl) {
      this.setState({
        editError:
          'Neplatná adresa issue. Použijte http(s) URL nebo doménu s cestou.',
      });
      return;
    }

    const spentMinutes = timeRaw === '' ? null : parseDurationToMinutes(timeRaw);
    if (timeRaw !== '' && spentMinutes === null) {
      this.setState({
        editError:
          'Neplatný čas. Použijte např. 30m, 1h nebo 1h 30m.',
      });
      return;
    }

    this.props.onItemsChange(
      this.items.map((i) => {
        if (i.id !== editingId) return i;
        return stripLegacyIssueFields({
          ...i,
          issueUrl,
          description,
          spentMinutes,
        });
      })
    );
    this.cancelRowEdit();
  };

  handleRowEditKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelRowEdit();
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      this.saveRowEdit();
    }
  };

  renderIssueCell(item) {
    const href = resolveIssueHref(item);
    const legacy =
      item.issueNumber != null && item.issueNumber !== ''
        ? item.issueNumber
        : null;

    if (href) {
      return (
        <a
          className="daylog-issue-link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={href}
          onClick={(e) => e.stopPropagation()}
        >
          {issueAnchorLabel(href)}
        </a>
      );
    }

    if (legacy !== null) {
      return (
        <span
          className="daylog-issue-legacy"
          title="Starý záznam s číslem — upravte řádek a vložte URL issue"
        >
          #{legacy}
        </span>
      );
    }

    return (
      <span className="daylog-issue-legacy" title="Chybí odkaz">
        —
      </span>
    );
  }

  renderRowView(item) {
    return (
      <>
        {this.renderIssueCell(item)}
        <span
          className={`daylog-time${item.spentMinutes == null ? ' daylog-time--missing' : ''}`}
          title={item.spentMinutes == null ? 'Chybí odpracovaný čas' : 'Strávený čas'}
        >
          {item.spentMinutes != null ? formatMinutes(item.spentMinutes) : 'CHYBÍ ČAS'}
        </span>
        <span
          role="button"
          tabIndex={0}
          className="list-row-text daylog-desc list-row-text--editable"
          title="Upravit řádek (tlačítko ✎)"
          onDoubleClick={() => this.startRowEdit(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this.startRowEdit(item);
            }
          }}
        >
          {item.description}
        </span>
        <button
          type="button"
          className="icon-btn"
          title="Upravit řádek"
          onClick={() => this.startRowEdit(item)}
          aria-label="Upravit řádek"
        >
          ✎
        </button>
        <button
          type="button"
          className="icon-btn danger"
          title="Odebrat"
          onClick={() => this.removeItem(item.id)}
          aria-label="Smazat záznam"
        >
          🗑
        </button>
        <button
          type="button"
          className="icon-btn done"
          title={item.completed ? 'Označit jako nesplněné' : 'Splněno'}
          onClick={() => this.toggleComplete(item.id)}
          aria-label={
            item.completed ? 'Zrušit splnění' : 'Označit jako splněné'
          }
        >
          ✓
        </button>
      </>
    );
  }

  renderRowEdit(item) {
    const { editUrl, editTime, editDesc, editError } = this.state;
    return (
      <>
        <div className="daylog-edit-fields">
          <input
            ref={this.editUrlRef}
            type="text"
            className="inline-edit-input inline-edit-input--url"
            inputMode="url"
            value={editUrl}
            onChange={(e) =>
              this.setState({ editUrl: e.target.value, editError: '' })
            }
            onKeyDown={this.handleRowEditKeyDown}
            placeholder="https://…"
            aria-label="Odkaz na issue"
            autoComplete="off"
          />
          <input
            type="text"
            className="inline-edit-input inline-edit-input--time"
            value={editTime}
            onChange={(e) =>
              this.setState({ editTime: e.target.value, editError: '' })
            }
            onKeyDown={this.handleRowEditKeyDown}
            placeholder="30m, 1h 30m"
            aria-label="Strávený čas"
            autoComplete="off"
          />
          <input
            type="text"
            className="inline-edit-input inline-edit-input--desc"
            value={editDesc}
            onChange={(e) =>
              this.setState({ editDesc: e.target.value, editError: '' })
            }
            onKeyDown={this.handleRowEditKeyDown}
            aria-label="Popis issue"
          />
          <div className="daylog-edit-actions">
            <button
              type="button"
              className="btn btn-primary btn-compact"
              onClick={this.saveRowEdit}
            >
              Uložit
            </button>
            <button
              type="button"
              className="btn btn-compact"
              onClick={this.cancelRowEdit}
            >
              Zrušit
            </button>
          </div>
        </div>
        {editError ? (
          <p className="daylog-edit-row-error" role="alert">
            {editError}
          </p>
        ) : null}
        <button
          type="button"
          className="icon-btn danger"
          title="Odebrat"
          onClick={() => this.removeItem(item.id)}
          aria-label="Smazat záznam"
        >
          🗑
        </button>
        <button
          type="button"
          className="icon-btn done"
          title={item.completed ? 'Označit jako nesplněné' : 'Splněno'}
          onClick={() => this.toggleComplete(item.id)}
          aria-label={
            item.completed ? 'Zrušit splnění' : 'Označit jako splněné'
          }
        >
          ✓
        </button>
      </>
    );
  }

  render() {
    const {
      urlDraft,
      descDraft,
      timeDraft,
      timeError,
      linkError,
      editingId,
      calendarOpen,
      calendarOffset,
      hourlyRateDraft,
      hourlyRateError,
      nowTick,
    } = this.state;
    const items = this.items;
    const now = new Date(nowTick);
    const hourlyRate = this.parsedHourlyRate();
    const earningsDay = isEarningsCountingDay(now);
    const earnedHours = earnedHoursToday(now);
    const earnedToday = (hourlyRate || 0) * earnedHours;
    const spentToday = sumTodaySpent(this.spendItems, now);
    const earningsBoxClass = earningsPhaseClass(now);
    const { map, keys, todayStart, yesterdayStart } = groupItemsByDay(items);
    const calendarBaseDate = new Date();
    calendarBaseDate.setMonth(calendarBaseDate.getMonth() + calendarOffset);
    const { cells: currentMonthCells, title: currentMonthTitle } = buildMonthCalendar(
      calendarBaseDate,
      dayTotalsByStart(items)
    );

    return (
      <div className="panel">
        <div className="daylog-header-row">
          <h2>Daylog</h2>
          <button
            type="button"
            className="btn btn-compact"
            onClick={() => this.setState({ calendarOpen: true, calendarOffset: 0 })}
          >
            Kalendář měsíce
          </button>
        </div>
        <div className={`daylog-earnings-box ${earningsBoxClass}`}>
          <div className="daylog-earnings-main">
            <div className="daylog-earnings-topline">
              <div className="daylog-earnings-label">Kolik jsem si dnes vydělal</div>
              <div className="daylog-earnings-spent">
                Dnes utraceno: {formatMoneyCzk(spentToday)}
              </div>
            </div>
            <div className="daylog-earnings-value">{formatMoneyCzk(earnedToday)}</div>
            <div className="daylog-earnings-meta">
              {earningsDay ? (
                <>
                  Zaplaceno: {earnedHours} h z {WORKDAY_END_HOUR - WORKDAY_START_HOUR}{' '}
                  h (počítá se po hodinách mezi 8:00–16:00)
                </>
              ) : (
                <>
                  Víkend nebo státní svátek — výdělek se dnes nepočítá (pracovní dny
                  8:00–16:00).
                </>
              )}
            </div>
          </div>
          <div className="daylog-earnings-rate-wrap">
            <label className="daylog-earnings-rate-label" htmlFor="daylog-hourly-rate">
              Hodinová sazba (Kč)
            </label>
            <input
              id="daylog-hourly-rate"
              type="number"
              min="0"
              step="1"
              className="daylog-earnings-rate-input"
              value={hourlyRateDraft}
              onChange={this.handleHourlyRateChange}
              onBlur={this.commitHourlyRate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  this.commitHourlyRate();
                }
              }}
              aria-label="Hodinová sazba v korunách"
            />
            {hourlyRateError ? (
              <span className="daylog-earnings-rate-error">{hourlyRateError}</span>
            ) : null}
          </div>
        </div>
        <div className="toolbar">
          <input
            type="text"
            className="daylog-url-input"
            placeholder="Odkaz na issue (https://… nebo jen doména s cestou)"
            inputMode="url"
            value={urlDraft}
            onChange={this.handleUrlChange}
            onKeyDown={this.handleKeyDown}
            aria-label="Odkaz na issue"
            autoComplete="off"
          />
          <input
            type="text"
            className="daylog-time-input"
            placeholder="Čas nepovinný (30m, 1h 30m)"
            value={timeDraft}
            onChange={this.handleTimeChange}
            onKeyDown={this.handleKeyDown}
            aria-label="Strávený čas"
            autoComplete="off"
          />
          <input
            type="text"
            placeholder="Krátký popis issue"
            value={descDraft}
            onChange={this.handleDescChange}
            onKeyDown={this.handleKeyDown}
            aria-label="Popis issue"
          />
          <button type="button" className="btn btn-primary" onClick={this.addItem}>
            Přidat řádek
          </button>
        </div>
        {linkError ? (
          <p className="daylog-form-error" role="alert">
            {linkError}
          </p>
        ) : null}
        {timeError ? (
          <p className="daylog-form-error" role="alert">
            {timeError}
          </p>
        ) : null}
        {calendarOpen ? (
          <div
            className="daylog-calendar-modal-backdrop"
            onClick={() => this.setState({ calendarOpen: false })}
          >
            <div
              className="daylog-calendar-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="daylog-calendar-modal-top">
                <div className="daylog-calendar-title-wrap">
                  <button
                    type="button"
                    className="btn btn-compact"
                    onClick={() =>
                      this.setState((s) => ({ calendarOffset: s.calendarOffset - 1 }))
                    }
                  >
                    ← Předchozí
                  </button>
                  <h3>{currentMonthTitle}</h3>
                </div>
                <div className="daylog-calendar-top-actions">
                  <button
                    type="button"
                    className="btn btn-compact"
                    onClick={() => this.setState({ calendarOffset: 0 })}
                  >
                    Aktuální měsíc
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => this.setState({ calendarOpen: false })}
                    aria-label="Zavřít kalendář"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="daylog-calendar-weekdays">
                <span>Po</span>
                <span>Út</span>
                <span>St</span>
                <span>Čt</span>
                <span>Pá</span>
                <span>So</span>
                <span>Ne</span>
              </div>
              <div className="daylog-calendar-grid">
                {currentMonthCells.map((cell) => {
                  if (cell.kind === 'empty') {
                    return <div key={cell.key} className="daylog-calendar-empty" />;
                  }
                  const base = 'daylog-calendar-day';
                  const stateClass = cell.isHoliday || cell.isWeekend
                    ? 'daylog-calendar-day--weekend'
                    : cell.workedMinutes === 0
                      ? 'daylog-calendar-day--work-empty'
                      : `daylog-calendar-day--${cell.progressClass}`;
                  return (
                    <div key={cell.key} className={`${base} ${stateClass}`}>
                      <span className="daylog-calendar-day-num">{cell.day}</span>
                      <span className="daylog-calendar-day-time">
                        {cell.workedMinutes > 0 ? formatMinutes(cell.workedMinutes) : ''}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="daylog-calendar-legend">
                Víkendy a státní svátky = zlatá, pracovní dny bez záznamu = šedá,
                pracovní dny s prací: červená → oranžová → žlutá → zelená podle
                odpracovaného času.
              </p>
            </div>
          </div>
        ) : null}
        {items.length === 0 ? (
          <p className="empty-hint">
            Zatím žádné záznamy — vložte odkaz na issue, popis a případně čas.
          </p>
        ) : (
          keys.map((key) => {
            const dayItems = map.get(key);
            const dayTotal = sumSpentMinutes(dayItems);
            return (
              <section key={key} className="daylog-section">
                <h3 className="daylog-section-title">
                  {sectionLabelForKey(key, todayStart, yesterdayStart)}
                  <span className="daylog-section-total">
                    {' '}
                    · celkem {formatMinutes(dayTotal)}
                  </span>
                </h3>
                <div className="daylog-progress-row">
                  <div className="daylog-progress-label">
                    Splněno z 8h: {formatMinutes(dayTotal)}
                  </div>
                  <div className="daylog-progress-track" aria-hidden>
                    <div
                      className={`daylog-progress-fill ${progressColorClass(
                        dayTotal
                      )}`}
                      style={{ width: `${clampProgressPercent(dayTotal)}%` }}
                    />
                  </div>
                </div>
                <ul className="list">
                  {dayItems.map((item) => (
                    <li
                      key={item.id}
                      className={`list-row daylog-as-row${
                        item.completed ? ' completed' : ''
                      }${editingId === item.id ? ' list-row--daylog-edit' : ''}${
                        item.spentMinutes == null ? ' daylog-as-row--missing-time' : ''
                      }`}
                    >
                      {editingId === item.id
                        ? this.renderRowEdit(item)
                        : this.renderRowView(item)}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}
      </div>
    );
  }
}