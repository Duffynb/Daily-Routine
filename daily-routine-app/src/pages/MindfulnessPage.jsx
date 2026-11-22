import React, { Component } from 'react';
import ThoughtHeapPage from './ThoughtHeapPage.jsx';
import LessonsPage from './LessonsPage.jsx';
import PomodoroPage from './PomodoroPage.jsx';
import BookSummaryPage from './BookSummaryPage.jsx';

const ENTRIES_PER_DAY = 3;
const WEEKDAY_LABELS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function localDateKey(date = new Date()) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function dayLabel(dateKey, todayKey) {
  if (dateKey === todayKey) return 'Dnes';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === localDateKey(yesterday)) return 'Včera';
  const day = parseDateKey(dateKey);
  if (!day) return dateKey;
  return day.toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function monthTitle(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString('cs-CZ', {
    month: 'long',
    year: 'numeric',
  });
}

function normalizeDay(raw, dateKey) {
  const entriesRaw = Array.isArray(raw?.entries) ? raw.entries : [];
  const entries = [];
  for (let i = 0; i < ENTRIES_PER_DAY; i += 1) {
    const src = entriesRaw[i];
    entries.push({
      id: src?.id || nextId(),
      text: typeof src?.text === 'string' ? src.text : '',
      confirmed: Boolean(src?.confirmed) && String(src?.text || '').trim() !== '',
    });
  }
  return {
    date: typeof raw?.date === 'string' && raw.date.trim() !== '' ? raw.date : dateKey,
    entries,
  };
}

function isDayComplete(day) {
  return (
    Array.isArray(day?.entries) &&
    day.entries.length === ENTRIES_PER_DAY &&
    day.entries.every((e) => e.confirmed && String(e.text || '').trim() !== '')
  );
}

function confirmedCount(day) {
  if (!day || !Array.isArray(day.entries)) return 0;
  return day.entries.filter((e) => e.confirmed && String(e.text || '').trim() !== '').length;
}

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  // Monday-first: JS Sunday=0 → shift so Monday=0
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ kind: 'empty', key: `e-${i}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    cells.push({
      kind: 'day',
      key: localDateKey(date),
      day,
      dateKey: localDateKey(date),
    });
  }

  return cells;
}

export default class MindfulnessPage extends Component {
  constructor(props) {
    super(props);
    const today = new Date();
    this.state = {
      selectedDateKey: localDateKey(today),
      calendarYear: today.getFullYear(),
      calendarMonth: today.getMonth(),
    };
  }

  get days() {
    const { gratitudeDays } = this.props;
    return Array.isArray(gratitudeDays) ? gratitudeDays : [];
  }

  getDayMap = () => {
    const map = new Map();
    for (const raw of this.days) {
      if (!raw || typeof raw !== 'object') continue;
      const key =
        typeof raw.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.date.trim())
          ? raw.date.trim()
          : null;
      if (!key) continue;
      map.set(key, normalizeDay(raw, key));
    }
    return map;
  };

  upsertDay = (day) => {
    const key = day.date;
    const next = this.days.filter((d) => d?.date !== key);
    next.push({
      date: key,
      entries: day.entries.map((e) => ({
        id: e.id,
        text: e.text,
        confirmed: Boolean(e.confirmed),
      })),
    });
    next.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    this.props.onGratitudeDaysChange(next);
  };

  shiftMonth = (delta) => {
    this.setState((s) => {
      const d = new Date(s.calendarYear, s.calendarMonth + delta, 1);
      return {
        calendarYear: d.getFullYear(),
        calendarMonth: d.getMonth(),
      };
    });
  };

  goToCurrentMonth = () => {
    const today = new Date();
    this.setState({
      calendarYear: today.getFullYear(),
      calendarMonth: today.getMonth(),
      selectedDateKey: localDateKey(today),
    });
  };

  selectDay = (dateKey) => {
    const parsed = parseDateKey(dateKey);
    if (!parsed) return;
    this.setState({
      selectedDateKey: dateKey,
      calendarYear: parsed.getFullYear(),
      calendarMonth: parsed.getMonth(),
    });
  };

  handleTextChange = (dateKey, entryId, text) => {
    const map = this.getDayMap();
    const day = map.get(dateKey) || normalizeDay(null, dateKey);
    const entries = day.entries.map((e) =>
      e.id === entryId
        ? {
            ...e,
            text,
            confirmed: false,
          }
        : e
    );
    this.upsertDay({ date: dateKey, entries });
  };

  handleConfirm = (dateKey, entryId) => {
    const map = this.getDayMap();
    const day = map.get(dateKey) || normalizeDay(null, dateKey);
    const entries = day.entries.map((e) => {
      if (e.id !== entryId) return e;
      const text = String(e.text || '').trim();
      if (!text) return e;
      return { ...e, text, confirmed: true };
    });
    this.upsertDay({ date: dateKey, entries });
  };

  handleEdit = (dateKey, entryId) => {
    const map = this.getDayMap();
    const day = map.get(dateKey) || normalizeDay(null, dateKey);
    const entries = day.entries.map((e) =>
      e.id === entryId ? { ...e, confirmed: false } : e
    );
    this.upsertDay({ date: dateKey, entries });
  };

  handleClear = (dateKey, entryId) => {
    const map = this.getDayMap();
    const day = map.get(dateKey) || normalizeDay(null, dateKey);
    const entries = day.entries.map((e) =>
      e.id === entryId ? { ...e, text: '', confirmed: false } : e
    );
    this.upsertDay({ date: dateKey, entries });
  };

  dayStatusClass = (dateKey, map, todayKey) => {
    if (dateKey > todayKey) return 'gratitude-cal-day--future';
    const day = map.get(dateKey);
    if (isDayComplete(day)) return 'gratitude-cal-day--complete';
    return 'gratitude-cal-day--missing';
  };

  renderCalendar(map, todayKey) {
    const { calendarYear, calendarMonth, selectedDateKey } = this.state;
    const cells = buildMonthCells(calendarYear, calendarMonth);

    return (
      <div className="gratitude-calendar">
        <div className="gratitude-calendar-top">
          <div className="gratitude-calendar-title-wrap">
            <button
              type="button"
              className="btn btn-compact"
              onClick={() => this.shiftMonth(-1)}
            >
              ← Předchozí
            </button>
            <h3>{monthTitle(calendarYear, calendarMonth)}</h3>
            <button
              type="button"
              className="btn btn-compact"
              onClick={() => this.shiftMonth(1)}
            >
              Další →
            </button>
          </div>
          <button type="button" className="btn btn-compact" onClick={this.goToCurrentMonth}>
            Dnes
          </button>
        </div>

        <div className="daylog-calendar-weekdays">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div className="daylog-calendar-grid gratitude-calendar-grid">
          {cells.map((cell) => {
            if (cell.kind === 'empty') {
              return <div key={cell.key} className="daylog-calendar-empty gratitude-cal-empty" />;
            }

            const statusClass = this.dayStatusClass(cell.dateKey, map, todayKey);
            const selected = cell.dateKey === selectedDateKey;
            const day = map.get(cell.dateKey);
            const count = confirmedCount(day);
            const isFuture = cell.dateKey > todayKey;

            return (
              <button
                key={cell.key}
                type="button"
                className={`daylog-calendar-day gratitude-cal-day ${statusClass}${
                  selected ? ' gratitude-cal-day--selected' : ''
                }`}
                onClick={() => this.selectDay(cell.dateKey)}
                aria-pressed={selected}
                aria-label={`${dayLabel(cell.dateKey, todayKey)}${
                  isFuture
                    ? ''
                    : isDayComplete(day)
                      ? ', splněno'
                      : `, vyplněno ${count} z ${ENTRIES_PER_DAY}`
                }`}
              >
                <span className="daylog-calendar-day-num">{cell.day}</span>
                <span className="daylog-calendar-day-time">
                  {isFuture ? '' : `${count}/${ENTRIES_PER_DAY}`}
                </span>
              </button>
            );
          })}
        </div>

        <p className="daylog-calendar-legend">
          Zelená = den splněný (3/3), červená = chybí vyplnění. Klikni na den pro zobrazení nebo
          doplnění.
        </p>
      </div>
    );
  }

  renderSelectedDay(map, todayKey) {
    const { selectedDateKey } = this.state;
    const day = map.get(selectedDateKey) || normalizeDay(null, selectedDateKey);
    const complete = isDayComplete(day);

    return (
      <section
        className={`gratitude-day${complete ? ' gratitude-day--complete' : ''}`}
      >
        <header className="gratitude-day-header">
          <h3>{dayLabel(selectedDateKey, todayKey)}</h3>
          <span className="gratitude-day-status">
            {complete
              ? 'Splněno'
              : `${confirmedCount(day)}/${ENTRIES_PER_DAY}`}
          </span>
        </header>
        <ul className="list gratitude-list">
          {day.entries.map((entry, index) => {
            const canConfirm = String(entry.text || '').trim() !== '';
            return (
              <li
                key={entry.id}
                className={`list-row gratitude-row${
                  entry.confirmed ? ' gratitude-row--confirmed' : ''
                }`}
              >
                <span className="gratitude-row-index" aria-hidden>
                  {index + 1}
                </span>
                <input
                  type="text"
                  className="gratitude-input"
                  value={entry.text}
                  disabled={entry.confirmed}
                  placeholder={
                    index === 0
                      ? 'např. Dnes jsem si dal dobrý oběd'
                      : index === 1
                        ? 'např. Měl jsem super schůzku s kolegou'
                        : 'např. Udělal jsem radost babičce'
                  }
                  onChange={(e) =>
                    this.handleTextChange(selectedDateKey, entry.id, e.target.value)
                  }
                  aria-label={`Vděčnost ${index + 1} pro ${dayLabel(
                    selectedDateKey,
                    todayKey
                  )}`}
                />
                <div className="gratitude-row-actions">
                  {entry.confirmed ? (
                    <button
                      type="button"
                      className="btn btn-compact"
                      onClick={() => this.handleEdit(selectedDateKey, entry.id)}
                    >
                      Změnit
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-compact"
                      disabled={!canConfirm}
                      onClick={() => this.handleConfirm(selectedDateKey, entry.id)}
                    >
                      Potvrdit
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-compact btn-danger"
                    disabled={!canConfirm && !entry.confirmed}
                    onClick={() => this.handleClear(selectedDateKey, entry.id)}
                    aria-label={`Vymazat vděčnost ${index + 1}`}
                  >
                    Vymazat
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  renderGratitudeList() {
    const todayKey = localDateKey();
    const map = this.getDayMap();

    return (
      <div className="panel mindfulness-panel">
        <h2>Seznam vděčnosti</h2>
        <p className="mindfulness-hint">
          Každý den si zapiš tři věci, za které jsi vděčný. V kalendáři uvidíš splněné dny zeleně a
          chybějící červeně — kliknutím se k dni vrátíš a můžeš ho doplnit nebo si prohlédnout
          starší zápisy.
        </p>

        {this.renderCalendar(map, todayKey)}
        <div className="gratitude-days">{this.renderSelectedDay(map, todayKey)}</div>
      </div>
    );
  }

  render() {
    const {
      section,
      mindHeapItems,
      onMindHeapItemsChange,
      lessonEntries,
      onLessonEntriesChange,
    } = this.props;
    if (section === 'gratitude') {
      return this.renderGratitudeList();
    }
    if (section === 'heap') {
      return (
        <ThoughtHeapPage items={mindHeapItems} onItemsChange={onMindHeapItemsChange} />
      );
    }
    if (section === 'lessons') {
      return (
        <LessonsPage items={lessonEntries} onItemsChange={onLessonEntriesChange} />
      );
    }
    if (section === 'pomodoro') {
      return <PomodoroPage />;
    }
    if (section === 'book-summary') {
      return <BookSummaryPage />;
    }
    return (
      <div className="panel">
        <p className="empty-hint">Vyber položku v podmenu Mindfulness.</p>
      </div>
    );
  }
}
