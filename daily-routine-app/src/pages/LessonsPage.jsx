import React, { Component } from 'react';

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

function buildMonthCells(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
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

function entryDateKey(item) {
  if (typeof item?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date.trim())) {
    return item.date.trim();
  }
  if (item?.createdAt) return localDateKey(new Date(item.createdAt));
  return localDateKey();
}

function daysAgoKey(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return localDateKey(d);
}

export default class LessonsPage extends Component {
  constructor(props) {
    super(props);
    const today = new Date();
    this.state = {
      draft: '',
      dateDraft: localDateKey(today),
      editingId: null,
      editDraft: '',
      editDateDraft: '',
      calendarYear: today.getFullYear(),
      calendarMonth: today.getMonth(),
      selectedDateKey: null,
    };
    this.editInputRef = React.createRef();
  }

  get items() {
    const { items } = this.props;
    return Array.isArray(items) ? items : [];
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.editingId && this.state.editingId !== prevState.editingId) {
      const el = this.editInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }

  groupByDay = () => {
    const map = new Map();
    for (const item of this.items) {
      const key = entryDateKey(item);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    }
    const keys = [...map.keys()].sort((a, b) => b.localeCompare(a));
    return { map, keys };
  };

  countsForPeriod = () => {
    const todayKey = localDateKey();
    const weekFrom = daysAgoKey(6);
    const monthFrom = daysAgoKey(29);
    let week = 0;
    let month = 0;
    for (const item of this.items) {
      const key = entryDateKey(item);
      if (key >= weekFrom && key <= todayKey) week += 1;
      if (key >= monthFrom && key <= todayKey) month += 1;
    }
    return { week, month, total: this.items.length };
  };

  countByDateKey = () => {
    const counts = new Map();
    for (const item of this.items) {
      const key = entryDateKey(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  };

  handleAdd = (e) => {
    e.preventDefault();
    const text = String(this.state.draft || '').trim();
    if (!text) return;
    const date =
      typeof this.state.dateDraft === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(this.state.dateDraft)
        ? this.state.dateDraft
        : localDateKey();
    const item = {
      id: nextId(),
      text,
      date,
      createdAt: new Date().toISOString(),
    };
    this.props.onItemsChange([item, ...this.items]);
    this.setState({ draft: '', dateDraft: localDateKey() });
  };

  startEdit = (item) => {
    this.setState({
      editingId: item.id,
      editDraft: item.text || '',
      editDateDraft: entryDateKey(item),
    });
  };

  cancelEdit = () => {
    this.setState({ editingId: null, editDraft: '', editDateDraft: '' });
  };

  saveEdit = () => {
    const { editingId, editDraft, editDateDraft } = this.state;
    const text = String(editDraft || '').trim();
    if (!editingId || !text) return;
    const date =
      typeof editDateDraft === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(editDateDraft)
        ? editDateDraft
        : localDateKey();
    const next = this.items.map((item) =>
      item.id === editingId
        ? {
            ...item,
            text,
            date,
          }
        : item
    );
    this.props.onItemsChange(next);
    this.cancelEdit();
  };

  handleDelete = (id) => {
    this.props.onItemsChange(this.items.filter((item) => item.id !== id));
    if (this.state.editingId === id) this.cancelEdit();
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
      selectedDateKey: null,
    });
  };

  selectDay = (dateKey) => {
    this.setState((s) => ({
      selectedDateKey: s.selectedDateKey === dateKey ? null : dateKey,
    }));
  };

  renderCalendar(counts, todayKey) {
    const { calendarYear, calendarMonth, selectedDateKey } = this.state;
    const cells = buildMonthCells(calendarYear, calendarMonth);

    return (
      <div className="lessons-calendar">
        <div className="gratitude-calendar-top">
          <div className="gratitude-calendar-title-wrap">
            <button type="button" className="btn btn-compact" onClick={() => this.shiftMonth(-1)}>
              ← Předchozí
            </button>
            <h3>{monthTitle(calendarYear, calendarMonth)}</h3>
            <button type="button" className="btn btn-compact" onClick={() => this.shiftMonth(1)}>
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
            const count = counts.get(cell.dateKey) || 0;
            const has = count > 0;
            const isFuture = cell.dateKey > todayKey;
            const selected = cell.dateKey === selectedDateKey;
            return (
              <button
                key={cell.key}
                type="button"
                className={`daylog-calendar-day lessons-cal-day${
                  has ? ' lessons-cal-day--has' : ''
                }${isFuture ? ' lessons-cal-day--future' : ''}${
                  selected ? ' lessons-cal-day--selected' : ''
                }`}
                onClick={() => this.selectDay(cell.dateKey)}
                aria-pressed={selected}
              >
                <span className="daylog-calendar-day-num">{cell.day}</span>
                <span className="daylog-calendar-day-time">{has ? String(count) : ''}</span>
              </button>
            );
          })}
        </div>
        <p className="daylog-calendar-legend">
          Zvýrazněné dny mají zápis. Kliknutím filtruješ seznam na daný den (znovu klik = vše).
        </p>
      </div>
    );
  }

  render() {
    const {
      draft,
      dateDraft,
      editingId,
      editDraft,
      editDateDraft,
      selectedDateKey,
    } = this.state;
    const todayKey = localDateKey();
    const { map, keys } = this.groupByDay();
    const counts = this.countByDateKey();
    const stats = this.countsForPeriod();
    const visibleKeys = selectedDateKey
      ? keys.filter((k) => k === selectedDateKey)
      : keys;

    return (
      <div className="panel mindfulness-panel">
        <h2>Poučení</h2>
        <p className="mindfulness-hint">
          Zapiš si chvíle, na které nejsi hrdý — ne jako výčitku, ale jako připomínku, co příště
          udělat jinak. Můžeš se k tomu vrátit, upravit text i den, nebo zápis smazat.
        </p>

        <div className="lessons-stats">
          <div className="lessons-stat">
            <div className="lessons-stat-value">{stats.week}</div>
            <div className="lessons-stat-label">za 7 dní</div>
          </div>
          <div className="lessons-stat">
            <div className="lessons-stat-value">{stats.month}</div>
            <div className="lessons-stat-label">za 30 dní</div>
          </div>
          <div className="lessons-stat">
            <div className="lessons-stat-value">{stats.total}</div>
            <div className="lessons-stat-label">celkem</div>
          </div>
        </div>

        {this.renderCalendar(counts, todayKey)}

        <form className="toolbar lessons-compose" onSubmit={this.handleAdd}>
          <input
            type="date"
            className="daylog-date-input"
            value={dateDraft}
            onChange={(e) => this.setState({ dateDraft: e.target.value })}
            aria-label="Datum poučení"
          />
          <input
            type="text"
            value={draft}
            onChange={(e) => this.setState({ draft: e.target.value })}
            placeholder="Co se nepovedlo / z čeho se poučit…"
            aria-label="Text poučení"
          />
          <button type="submit" className="btn btn-primary" disabled={String(draft).trim() === ''}>
            Přidat
          </button>
        </form>

        {selectedDateKey ? (
          <p className="lessons-filter-hint">
            Filtr: {dayLabel(selectedDateKey, todayKey)}{' '}
            <button
              type="button"
              className="btn btn-compact"
              onClick={() => this.setState({ selectedDateKey: null })}
            >
              Zobrazit vše
            </button>
          </p>
        ) : null}

        {visibleKeys.length === 0 ? (
          <p className="empty-hint">
            {selectedDateKey
              ? 'Pro vybraný den zatím žádný zápis.'
              : 'Zatím žádná poučení — první zápis můžeš přidat výše.'}
          </p>
        ) : (
          visibleKeys.map((dateKey) => (
            <section key={dateKey} className="lessons-day">
              <h3 className="lessons-day-title">{dayLabel(dateKey, todayKey)}</h3>
              <ul className="list">
                {(map.get(dateKey) || []).map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <li
                      key={item.id}
                      className={`list-row lessons-row${
                        isEditing ? ' list-row--daylog-edit' : ''
                      }`}
                    >
                      {isEditing ? (
                        <div className="daylog-edit-fields lessons-edit-fields">
                          <input
                            type="date"
                            className="daylog-date-input"
                            value={editDateDraft}
                            onChange={(e) => this.setState({ editDateDraft: e.target.value })}
                            aria-label="Datum poučení"
                          />
                          <input
                            ref={this.editInputRef}
                            type="text"
                            className="inline-edit-input"
                            value={editDraft}
                            onChange={(e) => this.setState({ editDraft: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                this.saveEdit();
                              }
                              if (e.key === 'Escape') this.cancelEdit();
                            }}
                            aria-label="Upravit text poučení"
                          />
                          <button type="button" className="btn btn-primary btn-compact" onClick={this.saveEdit}>
                            Uložit
                          </button>
                          <button type="button" className="btn btn-compact" onClick={this.cancelEdit}>
                            Zrušit
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="lessons-row-text">{item.text}</div>
                          <div className="lessons-row-actions">
                            <button
                              type="button"
                              className="btn btn-compact"
                              onClick={() => this.startEdit(item)}
                            >
                              Upravit
                            </button>
                            <button
                              type="button"
                              className="btn btn-compact btn-danger"
                              onClick={() => this.handleDelete(item.id)}
                            >
                              Smazat
                            </button>
                          </div>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    );
  }
}
