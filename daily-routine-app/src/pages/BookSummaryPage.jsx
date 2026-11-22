import React, { Component } from 'react';

export default class BookSummaryPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      query: '',
      loading: false,
      error: '',
      result: null,
    };
  }

  handleSubmit = async (e) => {
    e.preventDefault();
    const query = String(this.state.query || '').trim();
    if (!query || this.state.loading) return;

    this.setState({ loading: true, error: '', result: null });
    try {
      const response = await fetch('/api/book-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload?.error ||
            (response.status === 404
              ? 'Shrnutí se nepodařilo najít.'
              : `Chyba serveru (HTTP ${response.status}).`)
        );
      }
      this.setState({ loading: false, result: payload, error: '' });
    } catch (error) {
      this.setState({
        loading: false,
        result: null,
        error: String(error?.message || error),
      });
    }
  };

  render() {
    const { query, loading, error, result } = this.state;
    const takeaways = Array.isArray(result?.keyTakeaways) ? result.keyTakeaways : [];

    return (
      <div className="panel mindfulness-panel">
        <h2>Shrnutí knihy</h2>
        <p className="mindfulness-hint">
          Zadej název knihy. Nejdřív dohledám volný popis (Wikipedie / Open Library) a pak přes
          free Groq připravím výcuc hlavního poselství a klíčových poučení.
        </p>

        <form className="toolbar book-summary-form" onSubmit={this.handleSubmit}>
          <input
            type="text"
            value={query}
            onChange={(e) => this.setState({ query: e.target.value })}
            placeholder="např. Malý princ"
            aria-label="Název knihy"
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || String(query).trim() === ''}
          >
            {loading ? 'Připravuji výcuc…' : 'Najít poselství'}
          </button>
        </form>

        {error ? (
          <p className="book-summary-error" role="alert">
            {error}
          </p>
        ) : null}

        {result ? (
          <article className="book-summary-card">
            <div className="book-summary-card-top">
              {result.image ? (
                <img
                  className="book-summary-cover"
                  src={result.image}
                  alt=""
                  loading="lazy"
                />
              ) : null}
              <div className="book-summary-meta">
                <h3>{result.title}</h3>
                {Array.isArray(result.authors) && result.authors.length > 0 ? (
                  <p className="book-summary-authors">{result.authors.join(', ')}</p>
                ) : null}
                {result.year ? (
                  <p className="book-summary-year">Rok: {result.year}</p>
                ) : null}
                <p className="book-summary-source">
                  Zdroj kontextu: {result.source || '—'}
                  {result.sourceUrl ? (
                    <>
                      {' · '}
                      <a href={result.sourceUrl} target="_blank" rel="noreferrer">
                        otevřít
                      </a>
                    </>
                  ) : null}
                  {result.provider ? ` · poselství: ${result.provider}` : null}
                </p>
              </div>
            </div>

            {result.overview ? (
              <section className="book-summary-section">
                <h4>O knize</h4>
                <p className="book-summary-text">{result.overview}</p>
              </section>
            ) : null}

            {result.mainMessage ? (
              <section className="book-summary-section book-summary-section--message">
                <h4>Hlavní poselství</h4>
                <p className="book-summary-text">{result.mainMessage}</p>
              </section>
            ) : (
              <section className="book-summary-section">
                <h4>Popis</h4>
                <p className="book-summary-text">{result.summary}</p>
              </section>
            )}

            {takeaways.length > 0 ? (
              <section className="book-summary-section">
                <h4>Klíčová poučení</h4>
                <ul className="book-summary-takeaways">
                  {takeaways.map((item, index) => (
                    <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            {result.confidenceNote ? (
              <p className="book-summary-note">{result.confidenceNote}</p>
            ) : null}
          </article>
        ) : null}
      </div>
    );
  }
}
