import React, { Component } from 'react';

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function formatCreatedAt(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('cs-CZ', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default class ThoughtHeapPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      draft: '',
      listening: false,
      speechSupported: Boolean(getSpeechRecognitionCtor()),
      speechError: '',
    };
    this.recognition = null;
  }

  componentWillUnmount() {
    this.stopListening(true);
  }

  get items() {
    const { items } = this.props;
    return Array.isArray(items) ? items : [];
  }

  addThought = (rawText, source = 'text') => {
    const text = String(rawText || '').trim();
    if (!text) return;
    const item = {
      id: nextId(),
      text,
      createdAt: new Date().toISOString(),
      source: source === 'voice' ? 'voice' : 'text',
    };
    // Nejnovější nahoře, bez dalšího řazení.
    this.props.onItemsChange([item, ...this.items]);
    this.setState({ draft: '', speechError: '' });
  };

  handleDraftChange = (e) => {
    this.setState({ draft: e.target.value });
  };

  handleSubmit = (e) => {
    e.preventDefault();
    this.addThought(this.state.draft, 'text');
  };

  handleDelete = (id) => {
    this.props.onItemsChange(this.items.filter((item) => item.id !== id));
  };

  stopListening = (silent = false) => {
    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    if (!silent) {
      this.setState({ listening: false });
    } else {
      this.setState((s) => (s.listening ? { listening: false } : null));
    }
  };

  toggleListening = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      this.setState({
        speechError: 'Diktování v tomto prohlížeči nefunguje. Zkus Chrome nebo Edge.',
      });
      return;
    }

    if (this.state.listening) {
      this.stopListening();
      return;
    }

    const recognition = new Ctor();
    recognition.lang = 'cs-CZ';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = result?.[0]?.transcript || '';
        if (result.isFinal) {
          finalText = `${finalText} ${chunk}`.trim();
        } else {
          interim += chunk;
        }
      }
      const live = `${finalText} ${interim}`.trim();
      if (live) {
        this.setState({ draft: live, speechError: '' });
      }
    };

    recognition.onerror = (event) => {
      const code = event?.error || 'unknown';
      let message = 'Diktování se nepovedlo.';
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        message = 'Mikrofon nemá oprávnění. Povol ho v prohlížeči a zkus znovu.';
      } else if (code === 'no-speech') {
        message = 'Nic jsem neslyšel — zkus diktovat znovu.';
      } else if (code === 'aborted') {
        message = '';
      }
      this.recognition = null;
      this.setState({ listening: false, speechError: message });
    };

    recognition.onend = () => {
      this.recognition = null;
      this.setState({ listening: false }, () => {
        const text = String(this.state.draft || '').trim();
        if (text) {
          // Za pochodu rovnou odlož — bez dalšího upravování.
          this.addThought(text, 'voice');
        }
      });
    };

    this.recognition = recognition;
    this.setState({ listening: true, speechError: '' });
    try {
      recognition.start();
    } catch {
      this.recognition = null;
      this.setState({
        listening: false,
        speechError: 'Diktování se nepodařilo spustit.',
      });
    }
  };

  render() {
    const { draft, listening, speechSupported, speechError } = this.state;
    const items = this.items;

    return (
      <div className="panel mindfulness-panel">
        <h2>Halda</h2>
        <p className="mindfulness-hint">
          Rychlé odkladiště myšlenek. Zapiš nebo nadiktuj nápad tak, jak přišel — bez úprav a
          řazení. Až myšlenku někam zaplánuješ nebo zahodíš, prostě ji smaž.
        </p>

        <form className="heap-compose" onSubmit={this.handleSubmit}>
          <textarea
            className="heap-input"
            rows={3}
            value={draft}
            onChange={this.handleDraftChange}
            placeholder="Co ti právě naskočilo…"
            aria-label="Nová myšlenka"
          />
          <div className="heap-compose-actions">
            <button
              type="button"
              className={`btn btn-compact heap-mic-btn${listening ? ' heap-mic-btn--live' : ''}`}
              onClick={this.toggleListening}
              disabled={!speechSupported && !listening}
              aria-pressed={listening}
              title={
                speechSupported
                  ? listening
                    ? 'Zastavit diktování'
                    : 'Nadiktovat myšlenku'
                  : 'Diktování není v tomto prohlížeči dostupné'
              }
            >
              {listening ? 'Nahrávám…' : 'Mikrofon'}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={String(draft).trim() === ''}
            >
              Odložit
            </button>
          </div>
        </form>

        {speechError ? (
          <p className="heap-speech-error" role="alert">
            {speechError}
          </p>
        ) : null}
        {!speechSupported ? (
          <p className="heap-speech-note">
            Tip: diktování funguje nejlíp v Chrome / Edge (včetně telefonu).
          </p>
        ) : null}

        {items.length === 0 ? (
          <p className="empty-hint">Halda je zatím prázdná.</p>
        ) : (
          <ul className="list heap-list">
            {items.map((item) => (
              <li key={item.id} className="list-row heap-row">
                <div className="heap-row-main">
                  <div className="heap-row-text">{item.text}</div>
                  <div className="heap-row-meta">
                    {formatCreatedAt(item.createdAt)}
                    {item.source === 'voice' ? ' · diktát' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-compact btn-danger"
                  onClick={() => this.handleDelete(item.id)}
                >
                  Smazat
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
}
