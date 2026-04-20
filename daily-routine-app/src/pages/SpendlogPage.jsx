import React, { Component } from 'react';

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function parseAmount(raw) {
  const n = Number(String(raw).trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

function formatAmount(value) {
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function dayLabel(dayStart, todayStart) {
  if (dayStart === todayStart) return 'Dnes';
  if (dayStart === todayStart - 86400000) return 'Včera';
  return new Date(dayStart).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function payPeriodStart(dateLike) {
  const d = new Date(dateLike);
  if (d.getDate() >= 15) {
    return new Date(d.getFullYear(), d.getMonth(), 15).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth() - 1, 15).getTime();
}

function payPeriodEndExclusive(periodStartMs) {
  const d = new Date(periodStartMs);
  return new Date(d.getFullYear(), d.getMonth() + 1, 15).getTime();
}

function payPeriodLabel(periodStartMs) {
  const start = new Date(periodStartMs);
  const end = new Date(payPeriodEndExclusive(periodStartMs));
  const fmt = new Intl.DateTimeFormat('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function groupSpendItems(items) {
  const periodMap = new Map();

  for (const item of items) {
    const created = new Date(item.createdAt);
    const periodStart = payPeriodStart(created);
    const dayStart = startOfLocalDay(created);

    if (!periodMap.has(periodStart)) {
      periodMap.set(periodStart, new Map());
    }
    const dayMap = periodMap.get(periodStart);
    if (!dayMap.has(dayStart)) {
      dayMap.set(dayStart, []);
    }
    dayMap.get(dayStart).push(item);
  }

  const periodKeys = [...periodMap.keys()].sort((a, b) => b - a);
  return { periodMap, periodKeys };
}

function sumByPredicate(items, predicate) {
  return items.reduce(
    (acc, item) => (predicate(item) ? acc + (Number(item.amount) || 0) : acc),
    0
  );
}

function periodProgressClass(expenses, income) {
  if (income <= 0) return 'spend-progress--gray';
  const r = expenses / income;
  if (r < 0.5) return 'spend-progress--green';
  if (r < 0.75) return 'spend-progress--yellow';
  if (r <= 1) return 'spend-progress--orange';
  return 'spend-progress--red';
}

function periodProgressWidth(expenses, income) {
  if (income <= 0) return 0;
  return Math.max(0, Math.min(100, (expenses / income) * 100));
}

function sortByCreatedAsc(a, b) {
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

export default class SpendlogPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      amountDraft: '',
      descDraft: '',
      formError: '',
      editingId: null,
      editAmount: '',
      editDesc: '',
      editError: '',
    };
  }

  get items() {
    return Array.isArray(this.props.items) ? this.props.items : [];
  }

  hasSalaryInPeriod = (periodStartMs) => {
    return this.items.some(
      (i) => payPeriodStart(i.createdAt) === periodStartMs && i.isSalary
    );
  };

  clearFormError = () => {
    if (this.state.formError) this.setState({ formError: '' });
  };

  addItem = () => {
    const now = new Date();
    const nowPeriodStart = payPeriodStart(now);
    const amount = parseAmount(this.state.amountDraft);
    const rawDescription = this.state.descDraft.trim();

    if (amount == null) {
      this.setState({ formError: 'Zadejte platnou částku.' });
      return;
    }

    const needsSalary = !this.hasSalaryInPeriod(nowPeriodStart);

    if (!needsSalary && !rawDescription) {
      this.setState({ formError: 'Vyplňte popis výdaje.' });
      return;
    }

    const item = {
      id: nextId(),
      amount,
      description: needsSalary ? 'Výplata' : rawDescription,
      isSalary: needsSalary,
      createdAt: now.toISOString(),
    };

    this.props.onItemsChange([...this.items, item]);

    this.setState({
      amountDraft: '',
      descDraft: '',
      formError: '',
    });
  };

  removeItem = (id) => {
    const item = this.items.find((i) => i.id === id);
    if (item?.isSalary) {
      const periodStart = payPeriodStart(item.createdAt);
      const hasExpenses = this.items.some(
        (i) => payPeriodStart(i.createdAt) === periodStart && !i.isSalary
      );
      if (hasExpenses) {
        this.setState({
          formError:
            'Nejdřív smažte výdaje v tomto období. Výplata musí zůstat první položkou.',
        });
        return;
      }
    }

    this.props.onItemsChange(this.items.filter((i) => i.id !== id));
    if (this.state.editingId === id) {
      this.cancelEdit();
    }
  };

  startEdit = (item) => {
    this.setState({
      editingId: item.id,
      editAmount: String(item.amount ?? ''),
      editDesc: item.description ?? '',
      editError: '',
    });
  };

  cancelEdit = () => {
    this.setState({
      editingId: null,
      editAmount: '',
      editDesc: '',
      editError: '',
    });
  };

  saveEdit = () => {
    const { editingId, editAmount, editDesc } = this.state;
    if (!editingId) return;
    const current = this.items.find((i) => i.id === editingId);
    if (!current) return;

    const amount = parseAmount(editAmount);
    const description = current.isSalary ? 'Výplata' : editDesc.trim();
    if (amount == null || (!current.isSalary && !description)) {
      this.setState({ editError: 'Zadejte platnou částku i popis.' });
      return;
    }

    this.props.onItemsChange(
      this.items.map((i) =>
        i.id === editingId ? { ...i, amount, description } : i
      )
    );
    this.cancelEdit();
  };

  render() {
    const {
      amountDraft,
      descDraft,
      formError,
      editingId,
      editAmount,
      editDesc,
      editError,
    } = this.state;
    const items = this.items;
    const { periodMap, periodKeys } = groupSpendItems(items);
    const todayStart = startOfLocalDay(new Date());
    const nowPeriodStart = payPeriodStart(new Date());
    const needsSalaryNow = !this.hasSalaryInPeriod(nowPeriodStart);

    return (
      <div className="panel">
        <h2>Spendlog</h2>
        <div className="toolbar">
          <input
            type="text"
            className="spend-amount-input"
            placeholder={
              needsSalaryNow ? 'Částka výplaty' : 'Částka výdaje (např. 249.9)'
            }
            value={amountDraft}
            onChange={(e) => {
              this.setState({ amountDraft: e.target.value });
              this.clearFormError();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                this.addItem();
              }
            }}
            aria-label="Částka"
          />
          <input
            type="text"
            placeholder={needsSalaryNow ? 'První položka bude Výplata' : 'Za co výdaj je'}
            value={needsSalaryNow ? 'Výplata' : descDraft}
            onChange={(e) => {
              this.setState({ descDraft: e.target.value });
              this.clearFormError();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                this.addItem();
              }
            }}
            aria-label="Popis"
            disabled={needsSalaryNow}
          />
          <button type="button" className="btn btn-primary" onClick={this.addItem}>
            {needsSalaryNow ? 'Uložit výplatu' : 'Přidat výdaj'}
          </button>
        </div>
        {needsSalaryNow ? (
          <p className="spend-salary-hint">Nové období začíná výplatou (15. - 15.).</p>
        ) : null}
        {formError ? (
          <p className="daylog-form-error" role="alert">
            {formError}
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="empty-hint">Zatím žádné záznamy. Začněte vložením výplaty.</p>
        ) : (
          periodKeys.map((periodStart) => {
            const dayMap = periodMap.get(periodStart);
            const dayKeys = [...dayMap.keys()].sort((a, b) => b - a);
            const periodItems = dayKeys
              .flatMap((day) => dayMap.get(day) || [])
              .sort(sortByCreatedAsc);
            const income = sumByPredicate(periodItems, (i) => !!i.isSalary);
            const expenses = sumByPredicate(periodItems, (i) => !i.isSalary);
            const remaining = income - expenses;

            return (
              <section key={periodStart} className="spend-period">
                <h3 className="spend-period-title">
                  Výplatní období {payPeriodLabel(periodStart)}
                </h3>

                <div className="spend-summary-grid">
                  <div className="spend-summary-chip spend-summary-chip--income">
                    Příjem: {formatAmount(income)}
                  </div>
                  <div className="spend-summary-chip spend-summary-chip--expense">
                    Výdaje: {formatAmount(expenses)}
                  </div>
                  <div
                    className={`spend-summary-chip ${
                      remaining >= 0
                        ? 'spend-summary-chip--remaining'
                        : 'spend-summary-chip--negative'
                    }`}
                  >
                    Zůstatek: {formatAmount(remaining)}
                  </div>
                </div>

                <div className="spend-progress-wrap">
                  <div className="spend-progress-label">Výdaje vs příjem</div>
                  <div className="spend-progress-track" aria-hidden>
                    <div
                      className={`spend-progress-fill ${periodProgressClass(
                        expenses,
                        income
                      )}`}
                      style={{ width: `${periodProgressWidth(expenses, income)}%` }}
                    />
                  </div>
                </div>

                {dayKeys.map((dayKey) => {
                  const dayItems = (dayMap.get(dayKey) || []).slice().sort(sortByCreatedAsc);
                  const dayExpenseTotal = sumByPredicate(dayItems, (i) => !i.isSalary);
                  return (
                    <section key={dayKey} className="daylog-section">
                      <h4 className="spend-day-title">
                        {dayLabel(dayKey, todayStart)}
                        <span className="spend-day-total">
                          {' '}
                          · denní výdaje {formatAmount(dayExpenseTotal)}
                        </span>
                      </h4>
                      <ul className="list">
                        {dayItems.map((item) => (
                          <li key={item.id} className="list-row spend-row">
                            {editingId === item.id ? (
                              <>
                                <input
                                  type="text"
                                  className="inline-edit-input spend-edit-amount"
                                  value={editAmount}
                                  onChange={(e) =>
                                    this.setState({
                                      editAmount: e.target.value,
                                      editError: '',
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      this.saveEdit();
                                    }
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      this.cancelEdit();
                                    }
                                  }}
                                  aria-label="Upravit částku"
                                  autoFocus
                                />
                                {item.isSalary ? (
                                  <span className="spend-type-badge spend-type-badge--salary">
                                    Výplata
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    className="inline-edit-input spend-edit-desc"
                                    value={editDesc}
                                    onChange={(e) =>
                                      this.setState({
                                        editDesc: e.target.value,
                                        editError: '',
                                      })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        this.saveEdit();
                                      }
                                      if (e.key === 'Escape') {
                                        e.preventDefault();
                                        this.cancelEdit();
                                      }
                                    }}
                                    aria-label="Upravit popis"
                                  />
                                )}
                                <div className="food-inline-actions">
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-compact"
                                    onClick={this.saveEdit}
                                  >
                                    Uložit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-compact"
                                    onClick={this.cancelEdit}
                                  >
                                    Zrušit
                                  </button>
                                </div>
                                {editError ? (
                                  <p className="daylog-edit-row-error" role="alert">
                                    {editError}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <span
                                  className={`spend-amount ${
                                    item.isSalary
                                      ? 'spend-amount--income'
                                      : 'spend-amount--expense'
                                  }`}
                                >
                                  {item.isSalary ? '+' : '-'} {formatAmount(item.amount)}
                                </span>
                                <span className="list-row-text">{item.description}</span>
                                {item.isSalary ? (
                                  <span className="spend-type-badge spend-type-badge--salary">
                                    Výplata
                                  </span>
                                ) : null}
                                <button
                                  type="button"
                                  className="icon-btn"
                                  title="Upravit výdaj"
                                  onClick={() => this.startEdit(item)}
                                  aria-label="Upravit výdaj"
                                >
                                  ✎
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              className="icon-btn danger"
                              title="Smazat"
                              onClick={() => this.removeItem(item.id)}
                              aria-label="Smazat výdaj"
                            >
                              🗑
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </section>
            );
          })
        )}
      </div>
    );
  }
}