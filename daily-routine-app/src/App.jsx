import React, { Component } from 'react';
import TodoPage from './pages/TodoPage.jsx';
import DaylogPage from './pages/DaylogPage.jsx';
import FoodTrackingPage from './pages/FoodTrackingPage.jsx';
import SpendlogPage from './pages/SpendlogPage.jsx';
import LifeManagerPage from './pages/LifeManagerPage.jsx';
import PasswordManagerPage from './pages/PasswordManagerPage.jsx';

const SAVE_DEBOUNCE_MS = 400;

export default class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      page: 'todo',
      theme: 'dark',
      todoItems: [],
      daylogItems: [],
      foodEntries: [],
      foodBurnEntries: [],
      spendEntries: [],
      passwordEntries: [],
      calorieGoal: 2000,
      daylogHourlyRate: 300,
      dataRevision: 0,
      lastServerUpdatedAt: null,
      lastSyncedAt: null,
      syncStatus: 'idle',
      storageLoaded: false,
      persistence: 'unknown',
      relaxNowTick: Date.now(),
      relaxAmbientOn: false,
    };
    this.saveTimer = null;
    this.persistInFlight = false;
    this.pendingPersist = false;
    this.relaxClockTimer = null;
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    this.relaxClockTimer = window.setInterval(() => {
      this.setState({ relaxNowTick: Date.now() });
    }, 1000);
    fetch('/api/app-data')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        this.applyServerData(data, {
          storageLoaded: true,
          persistence:
            data?.persistence === 'supabase'
              ? 'supabase'
              : data?.persistence === 'file'
                ? 'file'
                : 'file',
        });
      })
      .catch(() => {
        this.setState({
          storageLoaded: true,
          persistence: 'none',
        });
      });
  }

  componentWillUnmount() {
    window.removeEventListener('beforeunload', this.handleBeforeUnload);
    if (this.relaxClockTimer) {
      window.clearInterval(this.relaxClockTimer);
      this.relaxClockTimer = null;
    }
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  formatRelaxTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  handleBeforeUnload = () => {
    this.flushPersist();
  };

  applyServerData = (data, extraState = {}) => {
    const todoItems = Array.isArray(data?.todoItems) ? data.todoItems : [];
    const daylogItems = Array.isArray(data?.daylogItems) ? data.daylogItems : [];
    const foodEntries = Array.isArray(data?.foodEntries) ? data.foodEntries : [];
    const foodBurnEntries = Array.isArray(data?.foodBurnEntries) ? data.foodBurnEntries : [];
    const spendEntries = Array.isArray(data?.spendEntries) ? data.spendEntries : [];
    const passwordEntries = Array.isArray(data?.passwordEntries) ? data.passwordEntries : [];
    const calorieGoal = Number.isFinite(Number(data?.calorieGoal)) ? Number(data.calorieGoal) : 2000;
    const daylogHourlyRate = Number.isFinite(Number(data?.daylogHourlyRate))
      ? Math.max(0, Math.floor(Number(data.daylogHourlyRate)))
      : 300;
    const dataRevision = Number.isFinite(Number(data?.revision))
      ? Math.max(0, Math.floor(Number(data.revision)))
      : 0;
    const lastServerUpdatedAt =
      typeof data?.updatedAt === 'string' && data.updatedAt.trim() !== ''
        ? data.updatedAt
        : null;

    this.setState({
      todoItems,
      daylogItems,
      foodEntries,
      foodBurnEntries,
      spendEntries,
      passwordEntries,
      calorieGoal,
      daylogHourlyRate,
      dataRevision,
      lastServerUpdatedAt,
      ...extraState,
    });
  };

  formatDateTime = (value) => {
    if (!value) return 'neznamy';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'neznamy';
    return d.toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  buildPersistData = () => {
    const {
      todoItems,
      daylogItems,
      foodEntries,
      foodBurnEntries,
      spendEntries,
      passwordEntries,
      calorieGoal,
      daylogHourlyRate,
    } = this.state;
    return {
      version: 1,
      todoItems,
      daylogItems,
      foodEntries,
      foodBurnEntries,
      spendEntries,
      passwordEntries,
      calorieGoal,
      daylogHourlyRate,
    };
  };

  persistNow = async (opts = {}) => {
    const { keepalive = false } = opts;
    const { storageLoaded, persistence, dataRevision } = this.state;
    if (!storageLoaded || persistence === 'none') return;
    if (this.persistInFlight) {
      this.pendingPersist = true;
      return;
    }

    this.persistInFlight = true;
    this.setState({ syncStatus: 'saving' });
    try {
      const response = await fetch('/api/app-data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expectedRevision: dataRevision,
          data: this.buildPersistData(),
        }),
        keepalive,
      });

      if (response.status === 409) {
        const conflictPayload = await response.json().catch(() => null);
        const current = conflictPayload?.current;
        if (current && typeof current === 'object') {
          const currentRevision = Number.isFinite(Number(current.revision))
            ? Math.max(0, Math.floor(Number(current.revision)))
            : 0;
          const lastServerUpdatedAt =
            typeof current.updatedAt === 'string' && current.updatedAt.trim() !== ''
              ? current.updatedAt
              : null;
          this.setState({
            dataRevision: currentRevision,
            lastServerUpdatedAt,
            syncStatus: 'conflict',
          });
          this.pendingPersist = true;
        }
        return;
      }

      if (!response.ok) {
        this.setState({ syncStatus: 'error' });
        return;
      }
      const payload = await response.json().catch(() => null);
      this.setState({
        dataRevision: Number.isFinite(Number(payload?.revision))
          ? Math.max(0, Math.floor(Number(payload.revision)))
          : dataRevision,
        lastServerUpdatedAt:
          typeof payload?.updatedAt === 'string' && payload.updatedAt.trim() !== ''
            ? payload.updatedAt
            : this.state.lastServerUpdatedAt,
        lastSyncedAt: new Date().toISOString(),
        syncStatus: 'ok',
      });
    } catch {
      this.setState({ syncStatus: 'error' });
    } finally {
      this.persistInFlight = false;
      if (this.pendingPersist) {
        this.pendingPersist = false;
        this.persistNow();
      }
    }
  };

  flushPersist = () => {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.persistNow({ keepalive: true });
  };

  schedulePersist = () => {
    const { storageLoaded, persistence } = this.state;
    if (!storageLoaded || persistence === 'none') return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.persistNow();
    }, SAVE_DEBOUNCE_MS);
  };

  handleTodoItemsChange = (items) => {
    this.setState({ todoItems: items }, this.schedulePersist);
  };

  handleDaylogItemsChange = (items) => {
    this.setState({ daylogItems: items }, this.schedulePersist);
  };

  handleFoodEntriesChange = (items) => {
    this.setState({ foodEntries: items }, this.schedulePersist);
  };

  handleFoodBurnEntriesChange = (items) => {
    this.setState({ foodBurnEntries: items }, this.schedulePersist);
  };

  handleSpendEntriesChange = (items) => {
    this.setState({ spendEntries: items }, this.schedulePersist);
  };

  handlePasswordEntriesChange = (items) => {
    this.setState({ passwordEntries: items }, this.schedulePersist);
  };

  handleCalorieGoalChange = (goal) => {
    this.setState({ calorieGoal: goal }, this.schedulePersist);
  };

  handleDaylogHourlyRateChange = (hourlyRate) => {
    this.setState(
      { daylogHourlyRate: Math.max(0, Math.floor(Number(hourlyRate) || 0)) },
      this.schedulePersist
    );
  };

  renderMain(page) {
    const {
      todoItems,
      daylogItems,
      foodEntries,
      foodBurnEntries,
      spendEntries,
      passwordEntries,
      calorieGoal,
      daylogHourlyRate,
    } = this.state;

    if (page === 'todo') {
      return <TodoPage items={todoItems} onItemsChange={this.handleTodoItemsChange} />;
    }

    if (page === 'daylog') {
      return (
        <DaylogPage
          items={daylogItems}
          spendItems={spendEntries}
          hourlyRate={daylogHourlyRate}
          onHourlyRateChange={this.handleDaylogHourlyRateChange}
          onItemsChange={this.handleDaylogItemsChange}
        />
      );
    }

    if (page === 'food') {
      return (
        <FoodTrackingPage
          items={foodEntries}
          burnItems={foodBurnEntries}
          calorieGoal={calorieGoal}
          onItemsChange={this.handleFoodEntriesChange}
          onBurnItemsChange={this.handleFoodBurnEntriesChange}
          onGoalChange={this.handleCalorieGoalChange}
        />
      );
    }

    if (page === 'spend') {
      return <SpendlogPage items={spendEntries} onItemsChange={this.handleSpendEntriesChange} />;
    }

    if (page === 'password') {
      return (
        <PasswordManagerPage
          items={passwordEntries}
          onItemsChange={this.handlePasswordEntriesChange}
        />
      );
    }

    if (page === 'relax') {
      const { relaxNowTick, relaxAmbientOn } = this.state;
      return (
        <div className={`relax-view${relaxAmbientOn ? ' relax-view--ambient' : ''}`} aria-label="Relax view">
          <div className="relax-card">
            <div className="relax-clock">{this.formatRelaxTime(relaxNowTick)}</div>
            <div className="relax-breath-wrap">
              <div className="relax-breath-cup" aria-hidden>
                <span className="relax-breath-cup-icon">☕</span>
              </div>
            </div>
            <p className="relax-breath-hint">Nádech 4s · drž 4s · výdech 6s</p>
            <button
              type="button"
              className="btn"
              onClick={() => this.setState((s) => ({ relaxAmbientOn: !s.relaxAmbientOn }))}
            >
              {relaxAmbientOn ? 'Ambient OFF' : 'Ambient ON'}
            </button>
          </div>
        </div>
      );
    }

    if (page === 'life') {
      return (
      <LifeManagerPage
        todoItems={todoItems}
        onTodoItemsChange={this.handleTodoItemsChange}
        daylogItems={daylogItems}
        spendEntries={spendEntries}
        daylogHourlyRate={daylogHourlyRate}
        onDaylogItemsChange={this.handleDaylogItemsChange}
        onDaylogHourlyRateChange={this.handleDaylogHourlyRateChange}
        foodEntries={foodEntries}
        foodBurnEntries={foodBurnEntries}
        calorieGoal={calorieGoal}
        onFoodEntriesChange={this.handleFoodEntriesChange}
        onFoodBurnEntriesChange={this.handleFoodBurnEntriesChange}
        onCalorieGoalChange={this.handleCalorieGoalChange}
        onSpendEntriesChange={this.handleSpendEntriesChange}
      />
      );
    }

    return (
      <div className="panel">
        <p className="empty-hint">Neznámá stránka.</p>
      </div>
    );
  }

  render() {
    const { page, theme, storageLoaded, persistence, lastServerUpdatedAt, lastSyncedAt, syncStatus } =
      this.state;
    const syncStatusLabel =
      syncStatus === 'saving'
        ? 'ukladam'
        : syncStatus === 'conflict'
          ? 'kolize-resync'
          : syncStatus === 'error'
            ? 'chyba sync'
            : 'ok';
    return (
      <div className={`app-shell app-shell--${theme}`}>
        <header className="app-header">
          <div className="app-header-brand">
            <img
              src="/favicon.svg"
              alt="Coffee cup logo"
              className="app-header-logo"
            />
            <h1>Daily routine</h1>
          </div>
          <div className="app-header-right">
            <div className="app-header-tag">
              <div>
                {persistence === 'supabase'
                  ? 'Data v Supabase'
                  : persistence === 'file'
                    ? 'Data v souboru local-app-data.json'
                    : persistence === 'none'
                      ? 'Bez API — spusťte npm run dev nebo npm run preview pro ukládání do souboru'
                      : '...'}
              </div>
              <div>
                Posledni uprava dat: {this.formatDateTime(lastServerUpdatedAt)}
              </div>
              <div>
                Posledni sync klienta: {this.formatDateTime(lastSyncedAt)} ({syncStatusLabel})
              </div>
            </div>
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={() =>
                this.setState((s) => ({
                  theme: s.theme === 'dark' ? 'light' : 'dark',
                }))
              }
            >
              {theme === 'dark' ? 'Light café' : 'Dark café'}
            </button>
          </div>
        </header>
        <div className="app-body">
          <aside className="app-sidebar">
            <nav>
              <button
                type="button"
                className={`menu-item${page === 'todo' ? ' active' : ''}`}
                onClick={() => this.setState({ page: 'todo' })}
              >
                Todo
              </button>
              <button
                type="button"
                className={`menu-item${page === 'daylog' ? ' active' : ''}`}
                onClick={() => this.setState({ page: 'daylog' })}
              >
                Daylog
              </button>
              <button
                type="button"
                className={`menu-item${page === 'food' ? ' active' : ''}`}
                onClick={() => this.setState({ page: 'food' })}
              >
                Foodlog
              </button>
              <button
                type="button"
                className={`menu-item${page === 'spend' ? ' active' : ''}`}
                onClick={() => this.setState({ page: 'spend' })}
              >
                Spendlog
              </button>
              <button
                type="button"
                className={`menu-item${page === 'life' ? ' active' : ''}`}
                onClick={() => this.setState({ page: 'life' })}
              >
                Life manager
              </button>
              <button
                type="button"
                className={`menu-item${page === 'password' ? ' active' : ''}`}
                onClick={() => this.setState({ page: 'password' })}
              >
                Password manager
              </button>
              <button
                type="button"
                className={`menu-item${page === 'relax' ? ' active' : ''}`}
                onClick={() => this.setState({ page: 'relax' })}
              >
                Relax
              </button>
            </nav>
          </aside>
          <main className="app-main">
            {!storageLoaded ? (
              <div className="panel">
                <p className="empty-hint">Načítám uložená data…</p>
              </div>
            ) : (
              this.renderMain(page)
            )}
          </main>
        </div>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} Daily routine - made with coffee</span>
        </footer>
      </div>
    );
  }
}