import React, { Component } from 'react';

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default class PasswordManagerPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      draftTitle: '',
      draftUsername: '',
      draftPassword: '',
      draftUrl: '',
      filterDraft: '',
      editingId: null,
      editTitle: '',
      editUsername: '',
      editPassword: '',
      editUrl: '',
      editNotes: '',
      visibleIds: {},
      copyHint: '',
    };
    this.copyHintTimer = null;
  }

  get items() {
    const { items } = this.props;
    return Array.isArray(items) ? items : [];
  }

  componentWillUnmount() {
    if (this.copyHintTimer) {
      window.clearTimeout(this.copyHintTimer);
      this.copyHintTimer = null;
    }
  }

  setCopyHint = (text) => {
    if (this.copyHintTimer) window.clearTimeout(this.copyHintTimer);
    this.setState({ copyHint: text });
    this.copyHintTimer = window.setTimeout(() => {
      this.setState({ copyHint: '' });
      this.copyHintTimer = null;
    }, 2200);
  };

  copyText = (text, label) => {
    const t = String(text || '');
    if (!t) {
      this.setCopyHint('Není co kopírovat');
      return;
    }
    const done = () => this.setCopyHint(`${label} zkopírováno`);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(t).then(done).catch(() => {
        this.setCopyHint('Kopírování se nepovedlo');
      });
    } else {
      this.setCopyHint('Prohlížeč nepodporuje schránku');
    }
  };

  filteredItems() {
    const q = this.state.filterDraft.trim().toLowerCase();
    const list = [...this.items];
    list.sort((a, b) =>
      String(a.title || '').localeCompare(String(b.title || ''), 'cs', {
        sensitivity: 'base',
      })
    );
    if (!q) return list;
    return list.filter((i) => {
      const hay = `${i.title} ${i.username} ${i.url} ${i.notes}`.toLowerCase();
      return hay.includes(q);
    });
  }

  addItem = () => {
    const title = this.state.draftTitle.trim();
    const username = this.state.draftUsername.trim();
    const password = this.state.draftPassword;
    const url = this.state.draftUrl.trim();
    if (!title && !username && !password) return;
    const row = {
      id: nextId(),
      title: title || 'Bez názvu',
      username,
      password,
      url,
      notes: '',
      createdAt: new Date().toISOString(),
    };
    this.props.onItemsChange([...this.items, row]);
    this.setState({
      draftTitle: '',
      draftUsername: '',
      draftPassword: '',
      draftUrl: '',
    });
  };

  removeItem = (id) => {
    if (this.state.editingId === id) this.cancelEdit();
    this.setState((s) => {
      const nextVis = { ...s.visibleIds };
      delete nextVis[id];
      return { visibleIds: nextVis };
    });
    this.props.onItemsChange(this.items.filter((i) => i.id !== id));
  };

  startEdit = (item) => {
    this.setState({
      editingId: item.id,
      editTitle: item.title || '',
      editUsername: item.username || '',
      editPassword: item.password || '',
      editUrl: item.url || '',
      editNotes: item.notes || '',
    });
  };

  cancelEdit = () => {
    this.setState({
      editingId: null,
      editTitle: '',
      editUsername: '',
      editPassword: '',
      editUrl: '',
      editNotes: '',
    });
  };

  saveEdit = () => {
    const {
      editingId,
      editTitle,
      editUsername,
      editPassword,
      editUrl,
      editNotes,
    } = this.state;
    if (!editingId) return;
    const title = editTitle.trim();
    if (!editUsername.trim() && !editPassword && !title) {
      this.cancelEdit();
      return;
    }
    this.props.onItemsChange(
      this.items.map((i) =>
        i.id === editingId
          ? {
              ...i,
              title: title || 'Bez názvu',
              username: editUsername.trim(),
              password: editPassword,
              url: editUrl.trim(),
              notes: editNotes,
            }
          : i
      )
    );
    this.cancelEdit();
  };

  toggleVisible = (id) => {
    this.setState((s) => ({
      visibleIds: { ...s.visibleIds, [id]: !s.visibleIds[id] },
    }));
  };

  generatePassword = () => {
    const chars =
      'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%';
    let out = '';
    const cryptoObj = globalThis.crypto;
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint8Array(16);
      cryptoObj.getRandomValues(buf);
      for (let i = 0; i < 16; i += 1) {
        out += chars[buf[i] % chars.length];
      }
    } else {
      for (let i = 0; i < 16; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    return out;
  };

  fillGenerated = (forEdit) => {
    const pwd = this.generatePassword();
    if (forEdit) {
      this.setState({ editPassword: pwd });
    } else {
      this.setState({ draftPassword: pwd });
    }
    this.setCopyHint('Nové heslo vygenerováno');
  };

  render() {
    const {
      draftTitle,
      draftUsername,
      draftPassword,
      draftUrl,
      filterDraft,
      editingId,
      editTitle,
      editUsername,
      editPassword,
      editUrl,
      editNotes,
      visibleIds,
      copyHint,
    } = this.state;
    const rows = this.filteredItems();

    return (
      <div className="panel">
        <h2>Password manager</h2>
        <p className="pwd-manager-hint">
          Údaje se ukládají do souboru <code>local-app-data.json</code> v čitelné
          podobě — vhodné jen pro lokální použití, ne pro citlivá produkční data.
        </p>

        <div className="toolbar pwd-toolbar">
          <input
            type="search"
            className="pwd-filter-input"
            placeholder="Hledat (název, účet, URL, poznámka)…"
            value={filterDraft}
            onChange={(e) => this.setState({ filterDraft: e.target.value })}
            aria-label="Filtrovat záznamy"
          />
        </div>

        <div className="pwd-add-card">
          <h3 className="pwd-add-title">Nový záznam</h3>
          <div className="pwd-add-grid">
            <input
              type="text"
              placeholder="Název / služba"
              value={draftTitle}
              onChange={(e) => this.setState({ draftTitle: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') this.addItem();
              }}
              aria-label="Název"
            />
            <input
              type="text"
              placeholder="Uživatelské jméno"
              value={draftUsername}
              onChange={(e) => this.setState({ draftUsername: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') this.addItem();
              }}
              aria-label="Uživatelské jméno"
            />
            <div className="pwd-password-row">
              <input
                type="text"
                placeholder="Heslo"
                value={draftPassword}
                onChange={(e) => this.setState({ draftPassword: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') this.addItem();
                }}
                autoComplete="off"
                aria-label="Heslo"
              />
              <button
                type="button"
                className="btn btn-compact"
                onClick={() => this.fillGenerated(false)}
              >
                Náhodné heslo
              </button>
            </div>
            <input
              type="text"
              placeholder="URL (volitelné)"
              value={draftUrl}
              onChange={(e) => this.setState({ draftUrl: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') this.addItem();
              }}
              inputMode="url"
              aria-label="URL"
            />
          </div>
          <div className="pwd-add-actions">
            <button type="button" className="btn btn-primary" onClick={this.addItem}>
              Uložit záznam
            </button>
          </div>
        </div>

        {copyHint ? (
          <p className="pwd-copy-hint" role="status">
            {copyHint}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="empty-hint">
            {this.items.length === 0
              ? 'Zatím žádné záznamy — vyplňte formulář výše.'
              : 'Žádný záznam neodpovídá filtru.'}
          </p>
        ) : (
          <ul className="list pwd-list">
            {rows.map((item) => (
              <li key={item.id} className="list-row pwd-row">
                {editingId === item.id ? (
                  <div className="pwd-edit-wrap">
                    <input
                      type="text"
                      className="inline-edit-input"
                      value={editTitle}
                      onChange={(e) => this.setState({ editTitle: e.target.value })}
                      placeholder="Název"
                      aria-label="Upravit název"
                    />
                    <input
                      type="text"
                      className="inline-edit-input"
                      value={editUsername}
                      onChange={(e) => this.setState({ editUsername: e.target.value })}
                      placeholder="Uživatelské jméno"
                      aria-label="Upravit uživatelské jméno"
                    />
                    <div className="pwd-password-row">
                      <input
                        type="text"
                        className="inline-edit-input"
                        value={editPassword}
                        onChange={(e) => this.setState({ editPassword: e.target.value })}
                        placeholder="Heslo"
                        autoComplete="off"
                        aria-label="Upravit heslo"
                      />
                      <button
                        type="button"
                        className="btn btn-compact"
                        onClick={() => this.fillGenerated(true)}
                      >
                        Náhodné heslo
                      </button>
                    </div>
                    <input
                      type="text"
                      className="inline-edit-input"
                      value={editUrl}
                      onChange={(e) => this.setState({ editUrl: e.target.value })}
                      placeholder="URL"
                      aria-label="Upravit URL"
                    />
                    <textarea
                      className="pwd-notes-input"
                      rows={2}
                      value={editNotes}
                      onChange={(e) => this.setState({ editNotes: e.target.value })}
                      placeholder="Poznámka (volitelné)"
                      aria-label="Poznámka"
                    />
                    <div className="pwd-edit-actions">
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
                  </div>
                ) : (
                  <>
                    <div className="pwd-row-main">
                      <div className="pwd-row-titleline">
                        <strong className="pwd-title">{item.title}</strong>
                        {item.url ? (
                          <a
                            className="pwd-url"
                            href={
                              /^[a-z][a-z0-9+.-]*:/i.test(item.url)
                                ? item.url
                                : `https://${item.url}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {item.url.length > 48 ? `${item.url.slice(0, 47)}…` : item.url}
                          </a>
                        ) : null}
                      </div>
                      <div className="pwd-row-credentials">
                        <span className="pwd-label">Účet</span>
                        <code className="pwd-mono">{item.username || '—'}</code>
                        <span className="pwd-label">Heslo</span>
                        <code className="pwd-mono pwd-secret">
                          {visibleIds[item.id]
                            ? item.password || '—'
                            : item.password
                              ? '••••••••'
                              : '—'}
                        </code>
                      </div>
                      {item.notes ? (
                        <p className="pwd-notes-preview">{item.notes}</p>
                      ) : null}
                    </div>
                    <div className="pwd-row-actions">
                      <button
                        type="button"
                        className="btn btn-compact"
                        onClick={() => this.toggleVisible(item.id)}
                      >
                        {visibleIds[item.id] ? 'Skrýt' : 'Zobrazit'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-compact"
                        onClick={() => this.copyText(item.username, 'Účet')}
                      >
                        Kopírovat účet
                      </button>
                      <button
                        type="button"
                        className="btn btn-compact"
                        onClick={() => this.copyText(item.password, 'Heslo')}
                      >
                        Kopírovat heslo
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        title="Upravit"
                        onClick={() => this.startEdit(item)}
                        aria-label="Upravit záznam"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Smazat"
                        onClick={() => this.removeItem(item.id)}
                        aria-label="Smazat záznam"
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
}
