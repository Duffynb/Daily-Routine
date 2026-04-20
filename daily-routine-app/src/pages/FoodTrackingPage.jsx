import React, { Component } from 'react';

function nextId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayLabel(dayStart, todayStart) {
  if (dayStart === todayStart) return 'Dnes';
  if (dayStart === todayStart - 86400000) return 'Včera';
  return new Date(dayStart).toLocaleDateString('cs-CZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const FOOD_DB = [
  { key: 'banan', kcal: 105 },
  { key: 'jablko', kcal: 90 },
  { key: 'hruska', kcal: 95 },
  { key: 'pomeranc', kcal: 85 },
  { key: 'mandarink', kcal: 65 },
  { key: 'grep', kcal: 75 },
  { key: 'broskev', kcal: 70 },
  { key: 'merunka', kcal: 65 },
  { key: 'svestk', kcal: 70 },
  { key: 'hrozno', kcal: 110 },
  { key: 'jahod', kcal: 55 },
  { key: 'malin', kcal: 55 },
  { key: 'boruv', kcal: 60 },
  { key: 'avokad', kcal: 240 },
  { key: 'mango', kcal: 140 },
  { key: 'ananas', kcal: 95 },
  { key: 'meloun', kcal: 70 },
  { key: 'kiwi', kcal: 70 },
  { key: 'datle', kcal: 170 },
  { key: 'rozink', kcal: 130 },
  { key: 'oves', kcal: 230 },
  { key: 'müsli', kcal: 260 },
  { key: 'musli', kcal: 260 },
  { key: 'granola', kcal: 280 },
  { key: 'kasa', kcal: 210 },
  { key: 'krupice', kcal: 240 },
  { key: 'palacink', kcal: 280 },
  { key: 'livan', kcal: 300 },
  { key: 'vafl', kcal: 300 },
  { key: 'toast', kcal: 170 },
  { key: 'rohlik', kcal: 120 },
  { key: 'baget', kcal: 270 },
  { key: 'chleba', kcal: 95 },
  { key: 'toust', kcal: 90 },
  { key: 'croissant', kcal: 250 },
  { key: 'kolac', kcal: 320 },
  { key: 'buchta', kcal: 320 },
  { key: 'vajec', kcal: 80 },
  { key: 'volske oko', kcal: 115 },
  { key: 'michana vejce', kcal: 210 },
  { key: 'slanina', kcal: 240 },
  { key: 'parek', kcal: 220 },
  { key: 'sunka', kcal: 120 },
  { key: 'salam', kcal: 220 },
  { key: 'klobasa', kcal: 330 },
  { key: 'jogurt', kcal: 140 },
  { key: 'skyr', kcal: 110 },
  { key: 'tvaroh', kcal: 180 },
  { key: 'kefir', kcal: 140 },
  { key: 'acidofil', kcal: 120 },
  { key: 'syr', kcal: 180 },
  { key: 'eidam', kcal: 190 },
  { key: 'mozarella', kcal: 220 },
  { key: 'mozzarella', kcal: 220 },
  { key: 'parmezan', kcal: 170 },
  { key: 'brynza', kcal: 180 },
  { key: 'maslo', kcal: 150 },
  { key: 'margarin', kcal: 145 },
  { key: 'arašíd', kcal: 220 },
  { key: 'arasid', kcal: 220 },
  { key: 'nutella', kcal: 250 },
  { key: 'med', kcal: 110 },
  { key: 'dzem', kcal: 120 },
  { key: 'marmelad', kcal: 120 },
  { key: 'ryze', kcal: 180 },
  { key: 'jasmínová ryze', kcal: 190 },
  { key: 'basmati', kcal: 185 },
  { key: 'testoviny', kcal: 220 },
  { key: 'spaghet', kcal: 240 },
  { key: 'penne', kcal: 240 },
  { key: 'lasagn', kcal: 520 },
  { key: 'gnocchi', kcal: 330 },
  { key: 'brambor', kcal: 170 },
  { key: 'pecene brambory', kcal: 220 },
  { key: 'bramborova kase', kcal: 230 },
  { key: 'hranol', kcal: 420 },
  { key: 'kroket', kcal: 360 },
  { key: 'kuskus', kcal: 210 },
  { key: 'quinoa', kcal: 220 },
  { key: 'bulgur', kcal: 210 },
  { key: 'cizrna', kcal: 240 },
  { key: 'cocka', kcal: 220 },
  { key: 'fazol', kcal: 230 },
  { key: 'polivka', kcal: 180 },
  { key: 'vyvar', kcal: 90 },
  { key: 'rajcatova', kcal: 140 },
  { key: 'cesnecka', kcal: 160 },
  { key: 'kulajda', kcal: 290 },
  { key: 'gulas', kcal: 460 },
  { key: 'svickova', kcal: 640 },
  { key: 'rajska', kcal: 540 },
  { key: 'koprovka', kcal: 500 },
  { key: 'segedin', kcal: 620 },
  { key: 'kure', kcal: 250 },
  { key: 'kureci prso', kcal: 220 },
  { key: 'kureci stehno', kcal: 310 },
  { key: 'kruti', kcal: 240 },
  { key: 'vepro', kcal: 320 },
  { key: 'veprovy rizek', kcal: 520 },
  { key: 'hov', kcal: 300 },
  { key: 'hamburger maso', kcal: 330 },
  { key: 'ryba', kcal: 250 },
  { key: 'losos', kcal: 320 },
  { key: 'tunak', kcal: 220 },
  { key: 'pstruh', kcal: 260 },
  { key: 'treska', kcal: 210 },
  { key: 'krevety', kcal: 210 },
  { key: 'tofu', kcal: 190 },
  { key: 'tempeh', kcal: 260 },
  { key: 'falafel', kcal: 340 },
  { key: 'salat', kcal: 70 },
  { key: 'cezar', kcal: 430 },
  { key: 'caesar', kcal: 430 },
  { key: 'coleslaw', kcal: 260 },
  { key: 'okurka', kcal: 25 },
  { key: 'rajce', kcal: 35 },
  { key: 'paprika', kcal: 35 },
  { key: 'mrkev', kcal: 45 },
  { key: 'brokolice', kcal: 55 },
  { key: 'spenat', kcal: 45 },
  { key: 'spenát', kcal: 45 },
  { key: 'kvetak', kcal: 50 },
  { key: 'cuketa', kcal: 45 },
  { key: 'lilek', kcal: 60 },
  { key: 'pecivo', kcal: 180 },
  { key: 'pizza', kcal: 650 },
  { key: 'burger', kcal: 700 },
  { key: 'hamburger', kcal: 700 },
  { key: 'cheeseburger', kcal: 760 },
  { key: 'hot dog', kcal: 430 },
  { key: 'doner', kcal: 780 },
  { key: 'kebab', kcal: 780 },
  { key: 'burrito', kcal: 720 },
  { key: 'taco', kcal: 260 },
  { key: 'wrap', kcal: 520 },
  { key: 'sushi', kcal: 420 },
  { key: 'ramen', kcal: 560 },
  { key: 'pho', kcal: 500 },
  { key: 'curry', kcal: 540 },
  { key: 'rizoto', kcal: 460 },
  { key: 'fried rice', kcal: 580 },
  { key: 'nudle', kcal: 460 },
  { key: 'sendvic', kcal: 430 },
  { key: 'sandwich', kcal: 430 },
  { key: 'bagel', kcal: 320 },
  { key: 'tortilla', kcal: 300 },
  { key: 'dezert', kcal: 320 },
  { key: 'zakusek', kcal: 340 },
  { key: 'zmrzlina', kcal: 240 },
  { key: 'susenka', kcal: 130 },
  { key: 'sušenka', kcal: 130 },
  { key: 'pernik', kcal: 280 },
  { key: 'makovec', kcal: 340 },
  { key: 'bublanina', kcal: 300 },
  { key: 'donut', kcal: 320 },
  { key: 'muffin', kcal: 380 },
  { key: 'brownie', kcal: 420 },
  { key: 'cokol', kcal: 250 },
  { key: 'tycinka', kcal: 210 },
  { key: 'protein bar', kcal: 230 },
  { key: 'orech', kcal: 200 },
  { key: 'mandle', kcal: 200 },
  { key: 'kesu', kcal: 210 },
  { key: 'vlasske orechy', kcal: 220 },
  { key: 'pistacie', kcal: 200 },
  { key: 'seminka', kcal: 180 },
  { key: 'chia', kcal: 170 },
  { key: 'slunecnice', kcal: 190 },
  { key: 'dyne', kcal: 180 },
  { key: 'kafe', kcal: 30 },
  { key: 'espresso', kcal: 10 },
  { key: 'americano', kcal: 15 },
  { key: 'cappuccino', kcal: 120 },
  { key: 'latte', kcal: 190 },
  { key: 'flat white', kcal: 170 },
  { key: 'ledova kava', kcal: 210 },
  { key: 'caj', kcal: 10 },
  { key: 'dzus', kcal: 120 },
  { key: 'juice', kcal: 120 },
  { key: 'cola', kcal: 170 },
  { key: 'limonada', kcal: 150 },
  { key: 'energy drink', kcal: 210 },
  { key: 'smoothie', kcal: 260 },
  { key: 'milkshake', kcal: 420 },
  { key: 'pivo', kcal: 210 },
  { key: 'vino', kcal: 160 },
  { key: 'prosecco', kcal: 150 },
  { key: 'rum', kcal: 160 },
  { key: 'whisky', kcal: 170 },
  { key: 'vodka', kcal: 160 },
  { key: 'protein', kcal: 140 },
  { key: 'whey', kcal: 140 },
  { key: 'gainer', kcal: 320 },
];

function estimateCaloriesWithAiLikeModel(text) {
  const normalized = String(text).toLowerCase();

  let total = 0;
  let hits = 0;
  for (const row of FOOD_DB) {
    if (normalized.includes(row.key)) {
      hits += 1;
      total += row.kcal;
    }
  }

  const qtyMatch = normalized.match(/(\d+(?:[\.,]\d+)?)\s*(x|ks|porc|porce)/);
  let multiplier = 1;
  if (qtyMatch) {
    multiplier = Math.max(1, Math.min(6, Number(qtyMatch[1].replace(',', '.'))));
  }

  if (hits === 0) {
    const words = normalized.split(/\s+/).filter(Boolean).length;
    return Math.round(Math.min(900, 160 + words * 35));
  }

  return Math.round(total * multiplier);
}

function groupByDay(items) {
  const todayStart = startOfLocalDay(new Date());
  const map = new Map();

  for (const item of items) {
    const day = startOfLocalDay(new Date(item.createdAt));
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(item);
  }

  const days = [...map.keys()].sort((a, b) => b - a);
  return { todayStart, map, days };
}

function sumKcal(items) {
  return items.reduce((acc, i) => acc + (Number(i.estimatedCalories) || 0), 0);
}

function parseDurationToMinutes(raw) {
  const compact = String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
  if (!compact) return null;

  let m = compact.match(/^(\d+)m$/);
  if (m) return parseInt(m[1], 10);

  m = compact.match(/^(\d+)h(?:(\d+)m)?$/);
  if (m) {
    const hours = parseInt(m[1], 10);
    const mins = m[2] != null ? parseInt(m[2], 10) : 0;
    return hours * 60 + mins;
  }
  return null;
}

function formatMinutes(total) {
  const n = Math.max(0, Math.floor(Number(total) || 0));
  const h = Math.floor(n / 60);
  const m = n % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const ACTIVITY_BURN_DB = [
  { key: 'chuze', kcalPerHour: 220 },
  { key: 'walking', kcalPerHour: 220 },
  { key: 'prochaz', kcalPerHour: 220 },
  { key: 'kolo', kcalPerHour: 500 },
  { key: 'cykli', kcalPerHour: 500 },
  { key: 'bike', kcalPerHour: 500 },
  { key: 'beh', kcalPerHour: 700 },
  { key: 'run', kcalPerHour: 700 },
  { key: 'plav', kcalPerHour: 560 },
  { key: 'swim', kcalPerHour: 560 },
  { key: 'fitko', kcalPerHour: 420 },
  { key: 'posil', kcalPerHour: 420 },
  { key: 'gym', kcalPerHour: 420 },
  { key: 'joga', kcalPerHour: 210 },
  { key: 'yoga', kcalPerHour: 210 },
  { key: 'turist', kcalPerHour: 420 },
  { key: 'hike', kcalPerHour: 420 },
  { key: 'uklid', kcalPerHour: 230 },
  { key: 'domaci prace', kcalPerHour: 230 },
];

function estimateBurnFallback(activityText, durationMinutes) {
  const normalized = String(activityText).toLowerCase();
  let rate = 300;
  for (const row of ACTIVITY_BURN_DB) {
    if (normalized.includes(row.key)) {
      rate = row.kcalPerHour;
      break;
    }
  }
  return Math.max(0, Math.round((rate * durationMinutes) / 60));
}

export default class FoodTrackingPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      draft: '',
      goalDraft: String(props.calorieGoal || 2000),
      isEstimating: false,
      estimateInfo: '',
      editingFoodId: null,
      editFoodDraft: '',
      isEditingReestimate: false,
      burnModalOpen: false,
      burnActivityDraft: '',
      burnDurationDraft: '',
      burnError: '',
      isEstimatingBurn: false,
    };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.calorieGoal !== this.props.calorieGoal) {
      this.setState({ goalDraft: String(this.props.calorieGoal || 2000) });
    }
  }

  get items() {
    return Array.isArray(this.props.items) ? this.props.items : [];
  }

  get burnItems() {
    return Array.isArray(this.props.burnItems) ? this.props.burnItems : [];
  }

  estimateCalories = async (text) => {
    try {
      const response = await fetch('/api/food-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const kcal = Number(payload?.estimatedCalories);
      const provider = String(payload?.provider || 'ai');
      if (!Number.isFinite(kcal)) {
        throw new Error('Invalid estimatedCalories');
      }
      return {
        estimatedCalories: Math.max(0, Math.round(kcal)),
        source: provider,
      };
    } catch {
      return {
        estimatedCalories: estimateCaloriesWithAiLikeModel(text),
        source: 'fallback',
      };
    }
  };

  estimateBurn = async (activity, durationText, durationMinutes) => {
    try {
      const response = await fetch('/api/activity-burn-estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity, duration: durationText }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const payload = await response.json();
      const kcal = Number(payload?.estimatedCalories);
      const provider = String(payload?.provider || 'ai');
      if (!Number.isFinite(kcal)) {
        throw new Error('Invalid estimatedCalories');
      }
      return {
        estimatedCalories: Math.max(0, Math.round(kcal)),
        source: provider,
      };
    } catch {
      return {
        estimatedCalories: estimateBurnFallback(activity, durationMinutes),
        source: 'fallback',
      };
    }
  };

  addFood = async () => {
    const text = this.state.draft.trim();
    if (!text || this.state.isEstimating) return;

    this.setState({ isEstimating: true, estimateInfo: '' });
    const result = await this.estimateCalories(text);
    this.props.onItemsChange([
      ...this.items,
      {
        id: nextId(),
        text,
        estimatedCalories: result.estimatedCalories,
        estimateSource: result.source,
        createdAt: new Date().toISOString(),
      },
    ]);

    this.setState({
      draft: '',
      isEstimating: false,
      estimateInfo:
        result.source === 'fallback'
          ? 'AI provider nedostupný, použit lokální odhad'
          : `Odhad z AI (${result.source})`,
    });
  };

  removeFood = (id) => {
    this.props.onItemsChange(this.items.filter((i) => i.id !== id));
  };

  startEditFood = (item) => {
    this.setState({
      editingFoodId: item.id,
      editFoodDraft: item.text,
    });
  };

  cancelEditFood = () => {
    this.setState({
      editingFoodId: null,
      editFoodDraft: '',
      isEditingReestimate: false,
    });
  };

  saveEditFood = async (item) => {
    const { editFoodDraft, isEditingReestimate } = this.state;
    const text = editFoodDraft.trim();
    if (!text || isEditingReestimate) return;

    this.setState({ isEditingReestimate: true });
    const result = await this.estimateCalories(text);

    this.props.onItemsChange(
      this.items.map((row) =>
        row.id === item.id
          ? {
              ...row,
              text,
              estimatedCalories: result.estimatedCalories,
              estimateSource: result.source,
            }
          : row
      )
    );

    this.setState({
      editingFoodId: null,
      editFoodDraft: '',
      isEditingReestimate: false,
      estimateInfo:
        result.source === 'fallback'
          ? 'Upraveno: AI provider nedostupný, použit lokální odhad'
          : `Upraveno: přepočet z AI (${result.source})`,
    });
  };

  applyGoal = () => {
    const n = Number(this.state.goalDraft);
    if (!Number.isFinite(n) || n < 100) return;
    this.props.onGoalChange(Math.round(n));
  };

  openBurnModal = () => {
    this.setState({
      burnModalOpen: true,
      burnActivityDraft: '',
      burnDurationDraft: '',
      burnError: '',
    });
  };

  closeBurnModal = () => {
    if (this.state.isEstimatingBurn) return;
    this.setState({
      burnModalOpen: false,
      burnActivityDraft: '',
      burnDurationDraft: '',
      burnError: '',
    });
  };

  addBurn = async () => {
    const { burnActivityDraft, burnDurationDraft, isEstimatingBurn } = this.state;
    const activity = burnActivityDraft.trim();
    const durationText = burnDurationDraft.trim();
    if (!activity || !durationText || isEstimatingBurn) return;

    const durationMinutes = parseDurationToMinutes(durationText);
    if (durationMinutes === null || durationMinutes < 1) {
      this.setState({
        burnError: 'Neplatná délka. Použijte třeba 30m, 1h nebo 1h 30m.',
      });
      return;
    }

    this.setState({ isEstimatingBurn: true, burnError: '', estimateInfo: '' });
    const result = await this.estimateBurn(activity, durationText, durationMinutes);
    this.props.onBurnItemsChange([
      ...this.burnItems,
      {
        id: nextId(),
        activity,
        durationMinutes,
        estimatedCalories: result.estimatedCalories,
        estimateSource: result.source,
        createdAt: new Date().toISOString(),
      },
    ]);

    this.setState({
      burnModalOpen: false,
      burnActivityDraft: '',
      burnDurationDraft: '',
      burnError: '',
      isEstimatingBurn: false,
      estimateInfo:
        result.source === 'fallback'
          ? 'Výdej: AI provider nedostupný, použit lokální odhad'
          : `Výdej: odhad z AI (${result.source})`,
    });
  };

  removeBurn = (id) => {
    this.props.onBurnItemsChange(this.burnItems.filter((i) => i.id !== id));
  };

  renderGoalSummary(todayIntake, todayBurn) {
    const goal = Number(this.props.calorieGoal) || 2000;
    const net = todayIntake - todayBurn;
    const diff = net - goal;
    let text = 'V cíli';
    let cls = 'food-balance food-balance--ok';
    if (diff > 0) {
      text = `Nad cílem o ${diff} kcal`;
      cls = 'food-balance food-balance--over';
    } else if (diff < 0) {
      text = `Pod cílem o ${Math.abs(diff)} kcal`;
      cls = 'food-balance food-balance--under';
    }

    return (
      <div className="food-summary-grid">
        <div className="food-summary-card">
          <div className="food-summary-label">Snědeno dnes</div>
          <div className="food-summary-value">{todayIntake} kcal</div>
        </div>
        <div className="food-summary-card">
          <div className="food-summary-label">Spáleno dnes</div>
          <div className="food-summary-value">{todayBurn} kcal</div>
        </div>
        <div className="food-summary-card">
          <div className="food-summary-label">Netto dnes</div>
          <div className="food-summary-value">{net} kcal</div>
        </div>
        <div className="food-summary-card">
          <div className="food-summary-label">Cíl</div>
          <div className="food-summary-value">{goal} kcal</div>
        </div>
        <div className={cls}>{text}</div>
      </div>
    );
  }

  render() {
    const {
      draft,
      goalDraft,
      isEstimating,
      estimateInfo,
      editingFoodId,
      editFoodDraft,
      isEditingReestimate,
      burnModalOpen,
      burnActivityDraft,
      burnDurationDraft,
      burnError,
      isEstimatingBurn,
    } = this.state;
    const { todayStart, map, days } = groupByDay(this.items);
    const { map: burnMap, days: burnDays } = groupByDay(this.burnItems);
    const mergedDays = [...new Set([...days, ...burnDays])].sort((a, b) => b - a);
    const todayIntake = sumKcal(map.get(todayStart) || []);
    const todayBurn = sumKcal(burnMap.get(todayStart) || []);

    return (
      <div className="panel">
        <h2>Foodlog</h2>

        <div className="toolbar food-toolbar">
          <input
            type="text"
            className="food-input"
            placeholder="Co jsem snědl (např. kuře s rýží, 2x rohlík se sýrem)"
            value={draft}
            onChange={(e) => this.setState({ draft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isEstimating) {
                e.preventDefault();
                this.addFood();
              }
            }}
            aria-label="Co jsem snědl"
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={this.addFood}
            disabled={isEstimating}
          >
            {isEstimating ? 'Odhaduji...' : 'Přidat jídlo'}
          </button>
          <button
            type="button"
            className="btn"
            onClick={this.openBurnModal}
            disabled={isEstimatingBurn}
          >
            Zadat výdej energie
          </button>
        </div>
        {estimateInfo ? <p className="food-estimate-info">{estimateInfo}</p> : null}

        <div className="toolbar food-goal-toolbar">
          <input
            type="number"
            className="food-goal-input"
            value={goalDraft}
            onChange={(e) => this.setState({ goalDraft: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                this.applyGoal();
              }
            }}
            aria-label="Denní kalorický cíl"
          />
          <button type="button" className="btn" onClick={this.applyGoal}>
            Nastavit cíl
          </button>
        </div>

        {this.renderGoalSummary(todayIntake, todayBurn)}

        {burnModalOpen ? (
          <div className="daylog-calendar-modal-backdrop" onClick={this.closeBurnModal}>
            <div className="food-burn-modal" onClick={(e) => e.stopPropagation()}>
              <div className="food-burn-modal-top">
                <h3>Zadej výdej energie</h3>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={this.closeBurnModal}
                  aria-label="Zavřít modal"
                  disabled={isEstimatingBurn}
                >
                  ✕
                </button>
              </div>
              <div className="food-burn-modal-fields">
                <input
                  type="text"
                  placeholder="Aktivita (běh, fitko, kolo...)"
                  value={burnActivityDraft}
                  onChange={(e) =>
                    this.setState({ burnActivityDraft: e.target.value, burnError: '' })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      this.addBurn();
                    }
                  }}
                  aria-label="Aktivita"
                />
                <input
                  type="text"
                  placeholder="Délka (např. 45m, 1h 20m)"
                  value={burnDurationDraft}
                  onChange={(e) =>
                    this.setState({ burnDurationDraft: e.target.value, burnError: '' })
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      this.addBurn();
                    }
                  }}
                  aria-label="Délka aktivity"
                />
              </div>
              {burnError ? <p className="daylog-form-error">{burnError}</p> : null}
              <div className="food-burn-modal-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={this.addBurn}
                  disabled={isEstimatingBurn}
                >
                  {isEstimatingBurn ? 'Odhaduji...' : 'Přidat výdej'}
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={this.closeBurnModal}
                  disabled={isEstimatingBurn}
                >
                  Zrušit
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {this.items.length === 0 && this.burnItems.length === 0 ? (
          <p className="empty-hint">Zatím žádný záznam jídla ani výdeje.</p>
        ) : (
          mergedDays.map((day) => {
            const dayItems = map.get(day) || [];
            const dayBurnItems = burnMap.get(day) || [];
            const dayTotal = sumKcal(dayItems);
            const dayBurnTotal = sumKcal(dayBurnItems);
            return (
              <section key={day} className="daylog-section">
                <h3 className="daylog-section-title">
                  {dayLabel(day, todayStart)}
                  <span className="daylog-section-total">
                    {' '}
                    · netto {dayTotal - dayBurnTotal} kcal
                  </span>
                </h3>
                {dayItems.length > 0 ? (
                  <p className="food-day-subtitle">Snědeno: {dayTotal} kcal</p>
                ) : null}
                <ul className="list">
                  {dayItems.map((item) => (
                    <li
                      key={item.id}
                      className={`list-row food-row${
                        editingFoodId === item.id ? ' food-row--editing' : ''
                      }`}
                    >
                      {editingFoodId === item.id ? (
                        <>
                          <input
                            type="text"
                            className="inline-edit-input food-inline-input"
                            value={editFoodDraft}
                            onChange={(e) =>
                              this.setState({ editFoodDraft: e.target.value })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                this.saveEditFood(item);
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                this.cancelEditFood();
                              }
                            }}
                            aria-label="Upravit jídlo"
                            autoFocus
                          />
                          <div className="food-inline-actions">
                            <button
                              type="button"
                              className="btn btn-primary btn-compact"
                              onClick={() => this.saveEditFood(item)}
                              disabled={isEditingReestimate}
                            >
                              {isEditingReestimate ? 'Přepočet...' : 'Uložit'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-compact"
                              onClick={this.cancelEditFood}
                              disabled={isEditingReestimate}
                            >
                              Zrušit
                            </button>
                          </div>
                        </>
                      ) : (
                        <span className="list-row-text">{item.text}</span>
                      )}
                      <span className="food-kcal">
                        ~ {item.estimatedCalories} kcal
                        <span className="food-kcal-source">
                          {item.estimateSource === 'fallback'
                            ? ' (lokální)'
                            : ` (AI: ${item.estimateSource || 'online'})`}
                        </span>
                      </span>
                      {editingFoodId !== item.id ? (
                        <button
                          type="button"
                          className="icon-btn"
                          title="Upravit a přepočítat"
                          onClick={() => this.startEditFood(item)}
                          aria-label="Upravit záznam jídla"
                        >
                          ✎
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="icon-btn danger"
                        title="Smazat"
                        onClick={() => this.removeFood(item.id)}
                        aria-label="Smazat záznam jídla"
                      >
                        🗑
                      </button>
                    </li>
                  ))}
                </ul>
                {dayBurnItems.length > 0 ? (
                  <>
                    <p className="food-day-subtitle food-day-subtitle--burn">
                      Spáleno: {dayBurnTotal} kcal
                    </p>
                    <ul className="list">
                      {dayBurnItems.map((item) => (
                        <li key={item.id} className="list-row food-burn-row">
                          <span className="list-row-text">
                            {item.activity}{' '}
                            <span className="food-burn-duration">
                              ({formatMinutes(item.durationMinutes)})
                            </span>
                          </span>
                          <span className="food-kcal food-kcal--burn">
                            - {item.estimatedCalories} kcal
                            <span className="food-kcal-source">
                              {item.estimateSource === 'fallback'
                                ? ' (lokální)'
                                : ` (AI: ${item.estimateSource || 'online'})`}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="icon-btn danger"
                            title="Smazat výdej"
                            onClick={() => this.removeBurn(item.id)}
                            aria-label="Smazat záznam výdeje"
                          >
                            🗑
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            );
          })
        )}
      </div>
    );
  }
}