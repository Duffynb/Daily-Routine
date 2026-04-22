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
      relaxSoundOn: false,
      relaxSoundError: '',
    };
    this.saveTimer = null;
    this.persistInFlight = false;
    this.pendingPersist = false;
    this.relaxClockTimer = null;
    this.wakeLock = null;
    this.relaxAudio = {
      ctx: null,
      master: null,
      noise: null,
      hum1: null,
      hum2: null,
      cup: null,
      lfo: null,
      panner: null,
      dingTimeout: null,
    };
  }

  componentDidMount() {
    window.addEventListener('beforeunload', this.handleBeforeUnload);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
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
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this.relaxClockTimer) {
      window.clearInterval(this.relaxClockTimer);
      this.relaxClockTimer = null;
    }
    this.stopRelaxAudio();
    this.releaseWakeLock();
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  componentDidUpdate(_prevProps, prevState) {
    if (prevState.page !== this.state.page) {
      if (this.state.page === 'relax') this.requestWakeLock();
      else this.releaseWakeLock();
    }
    if (
      prevState.page !== this.state.page ||
      prevState.relaxSoundOn !== this.state.relaxSoundOn
    ) {
      this.syncRelaxAudio();
    }
  }

  formatRelaxTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString('cs-CZ', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  requestWakeLock = async () => {
    try {
      if (!('wakeLock' in navigator)) return;
      if (document.visibilityState !== 'visible') return;
      if (this.wakeLock) return;
      this.wakeLock = await navigator.wakeLock.request('screen');
      this.wakeLock.addEventListener('release', () => {
        this.wakeLock = null;
      });
    } catch {
      // Browser may deny wake lock; relax page still works.
    }
  };

  releaseWakeLock = async () => {
    try {
      if (this.wakeLock) {
        await this.wakeLock.release();
        this.wakeLock = null;
      }
    } catch {
      this.wakeLock = null;
    }
  };

  handleVisibilityChange = () => {
    if (this.state.page !== 'relax') return;
    if (document.visibilityState === 'visible') {
      this.requestWakeLock();
      this.syncRelaxAudio();
    } else {
      this.releaseWakeLock();
      this.syncRelaxAudio();
    }
  };

  syncRelaxAudio = async () => {
    const shouldPlay =
      this.state.page === 'relax' &&
      this.state.relaxSoundOn &&
      document.visibilityState === 'visible';
    if (!shouldPlay) {
      this.stopRelaxAudio();
      return;
    }
    try {
      await this.startRelaxAudio();
      if (this.state.relaxSoundError) this.setState({ relaxSoundError: '' });
    } catch {
      this.setState({
        relaxSoundError: 'Zvuk se nepodarilo spustit (zkuste kliknout znovu).',
      });
    }
  };

  startRelaxAudio = async () => {
    if (!window.AudioContext && !window.webkitAudioContext) {
      throw new Error('AudioContext not supported');
    }
    if (!this.relaxAudio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.072;
      master.connect(ctx.destination);

      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const channel = noiseBuffer.getChannelData(0);
      for (let i = 0; i < channel.length; i += 1) {
        channel[i] = (Math.random() * 2 - 1) * 0.45;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 900;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.26;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);

      const hum1 = ctx.createOscillator();
      hum1.type = 'sine';
      hum1.frequency.value = 96;
      const hum1Gain = ctx.createGain();
      hum1Gain.gain.value = 0.06;
      hum1.connect(hum1Gain);
      hum1Gain.connect(master);

      const hum2 = ctx.createOscillator();
      hum2.type = 'sine';
      hum2.frequency.value = 142;
      const hum2Gain = ctx.createGain();
      hum2Gain.gain.value = 0.03;
      hum2.connect(hum2Gain);
      hum2Gain.connect(master);

      const cup = ctx.createOscillator();
      cup.type = 'triangle';
      cup.frequency.value = 226;
      const cupGain = ctx.createGain();
      cupGain.gain.value = 0.0;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.013;
      lfo.connect(lfoGain);
      lfoGain.connect(cupGain.gain);
      cup.connect(cupGain);
      cupGain.connect(master);

      const panner = ctx.createStereoPanner();
      panner.pan.value = 0.0;
      const pannerLfo = ctx.createOscillator();
      pannerLfo.type = 'sine';
      pannerLfo.frequency.value = 0.035;
      const pannerLfoGain = ctx.createGain();
      pannerLfoGain.gain.value = 0.25;
      pannerLfo.connect(pannerLfoGain);
      pannerLfoGain.connect(panner.pan);
      master.disconnect();
      master.connect(panner);
      panner.connect(ctx.destination);

      noise.start();
      hum1.start();
      hum2.start();
      cup.start();
      lfo.start();
      pannerLfo.start();

      this.relaxAudio = { ctx, master, noise, hum1, hum2, cup, lfo, panner, dingTimeout: null };
      this.scheduleCupDing();
    }
    if (this.relaxAudio.ctx.state === 'suspended') {
      await this.relaxAudio.ctx.resume();
    }
    this.scheduleCupDing();
  };

  stopRelaxAudio = () => {
    const { ctx, dingTimeout } = this.relaxAudio;
    if (dingTimeout) {
      window.clearTimeout(dingTimeout);
      this.relaxAudio.dingTimeout = null;
    }
    if (!ctx) return;
    if (ctx.state === 'running') {
      ctx.suspend().catch(() => {});
    }
  };

  scheduleCupDing = () => {
    const { ctx, dingTimeout } = this.relaxAudio;
    if (!ctx || ctx.state !== 'running') return;
    if (dingTimeout) return;
    const delayMs = 8000 + Math.random() * 14000;
    this.relaxAudio.dingTimeout = window.setTimeout(() => {
      this.relaxAudio.dingTimeout = null;
      this.triggerCupDing();
      this.scheduleCupDing();
    }, delayMs);
  };

  triggerCupDing = () => {
    const { ctx, master } = this.relaxAudio;
    if (!ctx || !master || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1150 + Math.random() * 180, now);
    osc.frequency.exponentialRampToValueAtTime(760 + Math.random() * 100, now + 0.24);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.022, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.5);
  };

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
      const { relaxNowTick, relaxAmbientOn, relaxSoundOn, relaxSoundError } = this.state;
      return (
        <div className={`relax-view${relaxAmbientOn ? ' relax-view--ambient' : ''}`} aria-label="Relax view">
          <div className={`relax-card${relaxAmbientOn ? ' relax-card--ambient' : ''}`}>
            <div className="relax-clock">{this.formatRelaxTime(relaxNowTick)}</div>
            <div className="relax-breath-wrap">
              <div className="relax-breath-cup" aria-hidden>
                <span className="relax-breath-cup-icon">☕</span>
                {relaxAmbientOn ? <span className="relax-steam" /> : null}
              </div>
            </div>
            <p className="relax-breath-hint">
              Nádech 4s · drž 4s · výdech 6s
              {relaxAmbientOn ? ' · ambient aktivní' : ''}
            </p>
            <button
              type="button"
              className={`btn${relaxAmbientOn ? ' btn-primary' : ''}`}
              onClick={() => this.setState((s) => ({ relaxAmbientOn: !s.relaxAmbientOn }))}
            >
              {relaxAmbientOn ? 'Ambient OFF' : 'Ambient ON'}
            </button>
            <button
              type="button"
              className={`btn${relaxSoundOn ? ' btn-primary' : ''}`}
              onClick={() =>
                this.setState((s) => ({
                  relaxSoundOn: !s.relaxSoundOn,
                  relaxSoundError: '',
                }))
              }
            >
              {relaxSoundOn ? 'Café sound OFF' : 'Café sound ON'}
            </button>
            {relaxSoundError ? <p className="relax-audio-error">{relaxSoundError}</p> : null}
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