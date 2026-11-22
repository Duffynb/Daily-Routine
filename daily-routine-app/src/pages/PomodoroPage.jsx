import React, { Component } from 'react';

const PRESETS_MINUTES = [15, 20, 25, 45];

function clampMinutes(raw) {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 20;
  return Math.min(180, Math.max(1, n));
}

function formatRemaining(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

export default class PomodoroPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      minutesDraft: 20,
      phase: 'idle', // idle | running | done
      remainingSeconds: 20 * 60,
      totalSeconds: 20 * 60,
    };
    this.endsAt = null;
    this.tickTimer = null;
    this.wakeLock = null;
    this.audioCtx = null;
  }

  componentWillUnmount() {
    this.clearTick();
    this.releaseWakeLock();
    this.restoreDocumentTitle();
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }

  clearTick = () => {
    if (this.tickTimer) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  };

  restoreDocumentTitle = () => {
    if (typeof document !== 'undefined' && document.title.startsWith('⏱ ')) {
      document.title = 'Daily routine';
    }
  };

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
      // optional
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

  playDoneSound = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!this.audioCtx) this.audioCtx = new Ctx();
      const ctx = this.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      [880, 1174, 1318].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.18);
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.05, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.4);
      });
    } catch {
      // ignore audio errors
    }
  };

  syncTick = () => {
    if (this.state.phase !== 'running' || !this.endsAt) return;
    const remainingSeconds = Math.max(0, Math.ceil((this.endsAt - Date.now()) / 1000));
    if (remainingSeconds <= 0) {
      this.clearTick();
      this.releaseWakeLock();
      this.endsAt = null;
      this.setState(
        {
          phase: 'done',
          remainingSeconds: 0,
        },
        () => {
          this.playDoneSound();
          if (typeof document !== 'undefined') {
            document.title = '✓ Interval hotov — Daily routine';
          }
        }
      );
      return;
    }
    this.setState({ remainingSeconds });
    if (typeof document !== 'undefined') {
      document.title = `⏱ ${formatRemaining(remainingSeconds)} — focus`;
    }
  };

  start = () => {
    if (this.state.phase === 'running') return;
    const minutes = clampMinutes(this.state.minutesDraft);
    const totalSeconds = minutes * 60;
    this.endsAt = Date.now() + totalSeconds * 1000;
    this.clearTick();
    this.setState(
      {
        minutesDraft: minutes,
        phase: 'running',
        remainingSeconds: totalSeconds,
        totalSeconds,
      },
      () => {
        this.requestWakeLock();
        this.syncTick();
        this.tickTimer = window.setInterval(this.syncTick, 250);
      }
    );
  };

  resetToIdle = () => {
    this.clearTick();
    this.releaseWakeLock();
    this.endsAt = null;
    this.restoreDocumentTitle();
    const minutes = clampMinutes(this.state.minutesDraft);
    this.setState({
      phase: 'idle',
      remainingSeconds: minutes * 60,
      totalSeconds: minutes * 60,
    });
  };

  handleMinutesChange = (e) => {
    if (this.state.phase === 'running') return;
    const minutes = clampMinutes(e.target.value);
    this.setState({
      minutesDraft: minutes,
      remainingSeconds: minutes * 60,
      totalSeconds: minutes * 60,
      phase: 'idle',
    });
    this.restoreDocumentTitle();
  };

  applyPreset = (minutes) => {
    if (this.state.phase === 'running') return;
    const value = clampMinutes(minutes);
    this.setState({
      minutesDraft: value,
      remainingSeconds: value * 60,
      totalSeconds: value * 60,
      phase: 'idle',
    });
    this.restoreDocumentTitle();
  };

  render() {
    const { minutesDraft, phase, remainingSeconds, totalSeconds } = this.state;
    const progress =
      totalSeconds > 0 ? Math.min(100, ((totalSeconds - remainingSeconds) / totalSeconds) * 100) : 0;
    const running = phase === 'running';
    const done = phase === 'done';

    return (
      <div className="panel mindfulness-panel">
        <h2>Pomodoro</h2>
        <p className="mindfulness-hint">
          Nastav interval soustředění a spusť ho. Během běhu nejde pauznout — čas doběhne a teprve
          potom si dej krátkou pauzu, než odstartuješ další.
        </p>

        <div className={`pomodoro-card${running ? ' pomodoro-card--running' : ''}${done ? ' pomodoro-card--done' : ''}`}>
          <div className="pomodoro-time" aria-live="polite">
            {formatRemaining(remainingSeconds)}
          </div>
          <div className="pomodoro-progress-track" aria-hidden>
            <div className="pomodoro-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="pomodoro-status">
            {running
              ? 'Soustřeď se — interval běží'
              : done
                ? 'Hotovo. Dej si pauzu a pak můžeš spustit další.'
                : 'Připraveno ke startu'}
          </div>

          <div className="pomodoro-presets">
            {PRESETS_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                className={`btn btn-compact${minutesDraft === m && !running ? ' btn-primary' : ''}`}
                disabled={running}
                onClick={() => this.applyPreset(m)}
              >
                {m} min
              </button>
            ))}
          </div>

          <label className="pomodoro-minutes-label">
            Vlastní interval (minuty)
            <input
              type="number"
              min={1}
              max={180}
              className="pomodoro-minutes-input"
              value={minutesDraft}
              disabled={running}
              onChange={this.handleMinutesChange}
            />
          </label>

          <div className="pomodoro-actions">
            {running ? (
              <button type="button" className="btn btn-primary" disabled>
                Běží…
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={this.start}>
                {done ? 'Spustit další interval' : 'Start'}
              </button>
            )}
            {done ? (
              <button type="button" className="btn btn-compact" onClick={this.resetToIdle}>
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
