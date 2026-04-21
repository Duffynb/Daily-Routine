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
      storageLoaded: false,
      persistence: 'unknown',
    };
    this.saveTimer = null;
    this.persistInFlight = false;
    this.pendingPersist = false;
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    fetch('/api/app-data')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        this.applyServerData(data, {
          storageLoaded: true,
          persistence: 'file',
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
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

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
      ...extraState,
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
    if (!storageLoaded || persistence !== 'file') return;
    if (this.persistInFlight) {
      this.pendingPersist = true;
      return;
    }

    this.persistInFlight = true;
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
          this.applyServerData(current);
          this.pendingPersist = true;
        }
        return;
      }

      if (!response.ok) return;
      const payload = await response.json().catch(() => null);
      if (Number.isFinite(Number(payload?.revision))) {
        this.setState({ dataRevision: Math.max(0, Math.floor(Number(payload.revision))) });
      }
    } catch {
      // no-op, next user change will retry persist
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
    if (!storageLoaded || persistence !== 'file') return;
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
    const { page, theme, storageLoaded, persistence } = this.state;
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
            <span className="app-header-tag">
              {persistence === 'file'
                ? 'Data v souboru local-app-data.json'
                : persistence === 'none'
                  ? 'Bez API — spusťte npm run dev nebo npm run preview pro ukládání do souboru'
                  : '...'}
            </span>
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