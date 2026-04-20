import React, { Component } from 'react';

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Nesplněné nahoře, splněné dole; uvnitř skupiny zachová původní pořadí. */
function sortTodosActiveFirst(items) {
  const active = [];
  const done = [];
  for (const item of items) {
    if (item.completed) done.push(item);
    else active.push(item);
  }
  return [...active, ...done];
}

export default class TodoPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      draft: '',
      editingId: null,
      editDraft: '',
      dueEditingId: null,
      dueDraft: '',
      draggingId: null,
      dragOverId: null,
    };
    this.editInputRef = React.createRef();
  }

  get items() {
    const { items } = this.props;
    return Array.isArray(items) ? items : [];
  }

  componentDidUpdate(prevProps, prevState) {
    if (
      this.state.editingId &&
      this.state.editingId !== prevState.editingId
    ) {
      const el = this.editInputRef.current;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }

  reorderById = (sourceId, targetId) => {
    if (!sourceId || sourceId === targetId) return;
    const items = this.items;
    const from = items.findIndex((i) => i.id === sourceId);
    const to = items.findIndex((i) => i.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...items];
    const [removed] = next.splice(from, 1);
    const adjustedTo = from < to ? to - 1 : to;
    next.splice(adjustedTo, 0, removed);
    this.props.onItemsChange(next);
  };

  handleDragStart = (e, id) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    this.setState({ draggingId: id, dragOverId: null });
  };

  handleDragEnd = () => {
    this.setState({ draggingId: null, dragOverId: null });
  };

  handleRowDragOver = (e, id) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (this.state.dragOverId !== id) {
      this.setState({ dragOverId: id });
    }
  };

  handleRowDrop = (e, targetId) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    this.reorderById(sourceId, targetId);
    this.setState({ draggingId: null, dragOverId: null });
  };

  handleDraftKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addItem();
    }
  };

  addItem = () => {
    const text = this.state.draft.trim();
    if (!text) return;
    const { onItemsChange } = this.props;
    const next = [
      ...this.items,
      { id: nextId(), text, completed: false, dueAt: null },
    ];
    onItemsChange(sortTodosActiveFirst(next));
    this.setState({ draft: '' });
  };

  removeItem = (id) => {
    if (this.state.editingId === id || this.state.dueEditingId === id) {
      this.setState({
        editingId: null,
        editDraft: '',
        dueEditingId: null,
        dueDraft: '',
      });
    }
    this.props.onItemsChange(this.items.filter((i) => i.id !== id));
  };

  formatDueLabel = (dueAt) => {
    if (!dueAt) return 'Bez termínu';
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return 'Neplatný termín';
    return d.toLocaleString('cs-CZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  dueStatus = (item) => {
    if (!item?.dueAt) return 'none';
    const due = new Date(item.dueAt).getTime();
    if (!Number.isFinite(due)) return 'none';
    if (!item.completed && due < Date.now()) return 'overdue';
    return 'scheduled';
  };

  startDueEdit = (item) => {
    let value = '';
    if (item?.dueAt) {
      const d = new Date(item.dueAt);
      if (!Number.isNaN(d.getTime())) {
        const tzOffset = d.getTimezoneOffset() * 60000;
        value = new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
      }
    }
    this.setState({ dueEditingId: item.id, dueDraft: value });
  };

  cancelDueEdit = () => {
    this.setState({ dueEditingId: null, dueDraft: '' });
  };

  saveDueEdit = (id) => {
    const draft = this.state.dueDraft.trim();
    const nextDueAt = draft ? new Date(draft).toISOString() : null;
    this.props.onItemsChange(
      this.items.map((i) => (i.id === id ? { ...i, dueAt: nextDueAt } : i))
    );
    this.cancelDueEdit();
  };

  toggleComplete = (id) => {
    const next = this.items.map((i) =>
      i.id === id ? { ...i, completed: !i.completed } : i
    );
    this.props.onItemsChange(sortTodosActiveFirst(next));
  };

  startEdit = (item) => {
    this.setState({ editingId: item.id, editDraft: item.text });
  };

  commitEdit = () => {
    const { editingId, editDraft } = this.state;
    if (!editingId) return;
    const text = editDraft.trim();
    if (!text) {
      this.setState({ editingId: null, editDraft: '' });
      return;
    }
    this.props.onItemsChange(
      this.items.map((i) =>
        i.id === editingId ? { ...i, text } : i
      )
    );
    this.setState({ editingId: null, editDraft: '' });
  };

  cancelEdit = () => {
    this.setState({ editingId: null, editDraft: '' });
  };

  handleEditKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commitEdit();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelEdit();
    }
  };

  handleEditBlur = () => {
    setTimeout(() => this.commitEdit(), 0);
  };

  render() {
    const {
      draft,
      editingId,
      editDraft,
      dueEditingId,
      dueDraft,
      draggingId,
      dragOverId,
    } =
      this.state;
    const items = this.items;
    return (
      <div className="panel">
        <h2>Todolog</h2>
        <p className="todo-dnd-hint">
          Pořadí shora = vyšší priorita — táhni řádek za úchyt ⋮⋮.
        </p>
        <div className="toolbar">
          <input
            type="text"
            placeholder="Nový úkol…"
            value={draft}
            onChange={(e) => this.setState({ draft: e.target.value })}
            onKeyDown={this.handleDraftKeyDown}
            aria-label="Text úkolu"
          />
          <button type="button" className="btn btn-primary" onClick={this.addItem}>
            Přidat řádek
          </button>
        </div>
        {items.length === 0 ? (
          <p className="empty-hint">Zatím nic — zadejte text a klikněte na Přidat řádek.</p>
        ) : (
          <ul className="list">
            {items.map((item) => (
              (() => {
                const dueStatus = this.dueStatus(item);
                return (
              <li
                key={item.id}
                className={`list-row${item.completed ? ' completed' : ''}${
                  dueStatus === 'scheduled' ? ' list-row--todo-has-due' : ''
                }${
                  dueStatus === 'overdue' ? ' list-row--todo-overdue' : ''
                }${
                  dragOverId === item.id ? ' list-row--todo-drag-over' : ''
                }${draggingId === item.id ? ' list-row--todo-dragging' : ''}`}
                onDragOver={(e) => this.handleRowDragOver(e, item.id)}
                onDrop={(e) => this.handleRowDrop(e, item.id)}
              >
                {editingId !== item.id ? (
                  <span
                    className="todo-drag-handle"
                    draggable
                    onDragStart={(e) => this.handleDragStart(e, item.id)}
                    onDragEnd={this.handleDragEnd}
                    title="Přetáhnout pro změnu priority"
                    aria-label="Přetáhnout úkol"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                      }
                    }}
                  >
                    ⋮⋮
                  </span>
                ) : (
                  <span
                    className="todo-drag-handle"
                    style={{ visibility: 'hidden', pointerEvents: 'none' }}
                    aria-hidden
                  >
                    ⋮⋮
                  </span>
                )}
                {editingId === item.id ? (
                  <input
                    ref={this.editInputRef}
                    type="text"
                    className="inline-edit-input"
                    value={editDraft}
                    onChange={(e) => this.setState({ editDraft: e.target.value })}
                    onKeyDown={this.handleEditKeyDown}
                    onBlur={this.handleEditBlur}
                    aria-label="Upravit text úkolu"
                  />
                ) : (
                  <span
                    role="button"
                    tabIndex={0}
                    className="list-row-text list-row-text--editable"
                    title="Dvojklik nebo Enter pro úpravu"
                    onDoubleClick={() => this.startEdit(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.startEdit(item);
                      }
                    }}
                  >
                    {item.text}
                  </span>
                )}
                {editingId !== item.id ? (
                  dueEditingId === item.id ? (
                    <div className="todo-due-editor">
                      <input
                        type="datetime-local"
                        className="todo-due-input"
                        value={dueDraft}
                        onChange={(e) => this.setState({ dueDraft: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            this.saveDueEdit(item.id);
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            this.cancelDueEdit();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-compact"
                        onClick={() => this.saveDueEdit(item.id)}
                      >
                        Uložit termín
                      </button>
                      <button
                        type="button"
                        className="btn btn-compact"
                        onClick={this.cancelDueEdit}
                      >
                        Zrušit
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`todo-due-badge todo-due-badge--${dueStatus}`}
                      onClick={() => this.startDueEdit(item)}
                      title="Klikněte pro nastavení termínu"
                    >
                      {this.formatDueLabel(item.dueAt)}
                    </button>
                  )
                ) : null}
                {editingId !== item.id ? (
                  <button
                    type="button"
                    className="icon-btn"
                    title="Upravit text"
                    onClick={() => this.startEdit(item)}
                    aria-label="Upravit text"
                  >
                    ✎
                  </button>
                ) : null}
                <button
                  type="button"
                  className="icon-btn danger"
                  title="Odebrat"
                  onClick={() => this.removeItem(item.id)}
                  aria-label="Smazat úkol"
                >
                  🗑
                </button>
                <button
                  type="button"
                  className="icon-btn done"
                  title={item.completed ? 'Označit jako nesplněné' : 'Splněno'}
                  onClick={() => this.toggleComplete(item.id)}
                  aria-label={item.completed ? 'Zrušit splnění' : 'Označit jako splněné'}
                >
                  ✓
                </button>
              </li>
                );
              })()
            ))}
          </ul>
        )}
      </div>
    );
  }
}
