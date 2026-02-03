/* global customElements */
try {
  console.info("blood-sugar-card: module loaded");
} catch (e) {
  // Ignore console issues in restricted environments
}

class BloodSugarCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._historyCache = null;
    this._historyFetchedAt = 0;
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You need to define an entity");
    }
    this._config = {
      name: "Blood Sugar",
      history_minutes: 30,
      trend_window: 3,
      low_threshold: 4.0,
      high_threshold: 10.1,
      slope_flat: 0.05,
      slope_single: 0.11,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;

    const now = Date.now();
    const refreshMs = 60 * 1000;
    if (now - this._historyFetchedAt > refreshMs) {
      this._fetchHistory().catch(() => {
        this._historyCache = null;
        this._historyFetchedAt = now;
        this._render();
      });
    } else {
      this._render();
    }
  }

  async _fetchHistory() {
    const entityId = this._config.entity;
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this._config.history_minutes * 60 * 1000);

    const data = await this._hass.callWS({
      type: "history/history_during_period",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      entity_ids: [entityId],
      minimal_response: true,
      no_attributes: true,
    });

    const series = (data && data[entityId]) ? data[entityId] : [];
    this._historyCache = series;
    this._historyFetchedAt = Date.now();
    this._render();
  }

  _getLatestValue() {
    const stateObj = this._hass.states[this._config.entity];
    if (!stateObj) return null;
    const value = parseFloat(stateObj.state);
    if (Number.isNaN(value)) return null;
    return value;
  }

  _minutesSinceLast() {
    const stateObj = this._hass.states[this._config.entity];
    if (stateObj && (stateObj.last_updated || stateObj.last_changed)) {
      const ts = stateObj.last_updated || stateObj.last_changed;
      const time = this._normalizeTime(ts);
      if (time) {
        const minutes = Math.floor((Date.now() - time) / 60000);
        if (minutes >= 0 && minutes <= 10080) {
          return minutes;
        }
      }
    }

    if (!this._historyCache || this._historyCache.length === 0) return null;
    const last = this._historyCache[this._historyCache.length - 1];
    const lastTime = this._entryTime(last);
    if (!lastTime) return null;
    const minutes = Math.floor((Date.now() - lastTime) / 60000);
    return minutes >= 0 && minutes <= 10080 ? minutes : null;
  }

  _computeTrend() {
    if (!this._historyCache || this._historyCache.length < 2) return "unknown";

    const windowSize = Math.max(2, this._config.trend_window);
    const recent = this._historyCache.slice(-windowSize);

    const first = recent[0];
    const last = recent[recent.length - 1];

    const firstVal = parseFloat(first.s);
    const lastVal = parseFloat(last.s);
    if (Number.isNaN(firstVal) || Number.isNaN(lastVal)) return "unknown";

    const firstTime = this._entryTime(first);
    const lastTime = this._entryTime(last);
    const minutes = (lastTime - firstTime) / 60000;
    if (!minutes || minutes <= 0) return "unknown";

    const slope = (lastVal - firstVal) / minutes;
    const flat = this._config.slope_flat;
    const single = this._config.slope_single;

    if (slope >= single) return "double_up";
    if (slope >= flat) return "single_up";
    if (slope <= -single) return "double_down";
    if (slope <= -flat) return "single_down";
    return "flat";
  }

  _entryTime(entry) {
    if (Array.isArray(entry)) {
      const ts = entry[2] || entry[1];
      return this._normalizeTime(ts);
    }

    const ts = entry.lu || entry.l || entry.t || entry.last_updated || entry.last_changed;
    return this._normalizeTime(ts);
  }

  _normalizeTime(ts) {
    if (!ts) return 0;
    if (typeof ts === "string" && ts.match(/^\\d+(\\.\\d+)?$/)) {
      const num = parseFloat(ts);
      const ms = num < 1e12 ? num * 1000 : num;
      return ms;
    }
    if (typeof ts === "number") {
      const ms = ts < 1e12 ? ts * 1000 : ts;
      return ms;
    }
    const parsed = Date.parse(ts);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  _sparklinePoints(width, height) {
    if (!this._historyCache || this._historyCache.length < 2) return "";
    const values = this._historyCache
      .map((item) => parseFloat(item.s))
      .filter((val) => !Number.isNaN(val));
    if (values.length < 2) return "";

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;

    return values
      .map((val, idx) => {
        const x = (idx / (values.length - 1)) * width;
        const y = height - ((val - min) / span) * height;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  _trendIcon(trend) {
    switch (trend) {
      case "double_up":
        return "⇈";
      case "single_up":
        return "↑";
      case "double_down":
        return "⇊";
      case "single_down":
        return "↓";
      case "flat":
        return "→";
      default:
        return "?";
    }
  }

  _trendLabel(trend) {
    switch (trend) {
      case "double_up":
        return "Rising fast";
      case "single_up":
        return "Rising";
      case "double_down":
        return "Falling fast";
      case "single_down":
        return "Falling";
      case "flat":
        return "Stable";
      default:
        return "Trend unknown";
    }
  }

  _backgroundFor(value) {
    const low = this._config.low_threshold;
    const high = this._config.high_threshold;

    if (value <= low) return "var(--bs-low, #b71c1c)";
    if (value >= high) return "var(--bs-high, #e65100)";
    return "var(--bs-range, #1b5e20)";
  }

  _render() {
    if (!this.shadowRoot || !this._config || !this._hass) return;

    const value = this._getLatestValue();
    const trend = this._computeTrend();
    const minutesSince = this._minutesSinceLast();
    const unit = "mmol/L";
    const bg = value === null ? "var(--bs-unknown, #424242)" : this._backgroundFor(value);
    const title = this._config.name || "Blood Sugar";
    const sparkPoints = this._sparklinePoints(120, 28);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: "Avenir Next", "Avenir", "Segoe UI", sans-serif;
        }
        .card {
          background: ${bg};
          color: #fff;
          border-radius: 18px;
          padding: 18px 20px;
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }
        .title {
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          opacity: 0.85;
          margin-bottom: 10px;
        }
        .value-row {
          display: flex;
          align-items: baseline;
          gap: 14px;
        }
        .value {
          font-size: 42px;
          font-weight: 700;
          line-height: 1;
        }
        .unit {
          font-size: 14px;
          opacity: 0.8;
        }
        .subline {
          margin-top: 8px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          opacity: 0.85;
        }
        .sparkline {
          margin-left: auto;
          width: 120px;
          height: 28px;
        }
        .sparkline polyline {
          fill: none;
          stroke: rgba(255, 255, 255, 0.85);
          stroke-width: 2;
        }
        .trend {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
        }
        .trend-icon {
          font-weight: 700;
          font-size: 22px;
          line-height: 1;
        }
        .trend-text {
          font-size: 12px;
          opacity: 0.9;
        }
        .unknown {
          font-size: 16px;
          opacity: 0.85;
        }
      </style>
      <div class="card">
        <div class="title">${title}</div>
        <div class="value-row">
          ${value === null
            ? `<div class="unknown">No data</div>`
            : `<div class="value">${value.toFixed(1)}</div><div class="unit">${unit}</div>`}
          <div class="trend" title="${this._trendLabel(trend)}">
            <div class="trend-icon">${this._trendIcon(trend)}</div>
            <div class="trend-text">${this._trendLabel(trend)}</div>
          </div>
        </div>
        <div class="subline">
          ${minutesSince === null
            ? `<div>Last reading: unknown</div>`
            : `<div>Last reading: ${minutesSince} min ago</div>`}
          <svg class="sparkline" viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <polyline points="${sparkPoints}" />
          </svg>
        </div>
      </div>
    `;
  }

  getCardSize() {
    return 2;
  }
}

customElements.define("blood-sugar-card", BloodSugarCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "blood-sugar-card",
  name: "Blood Sugar Card",
  description: "Shows latest blood sugar value with trend and color",
});
try {
  console.info("blood-sugar-card: element defined");
} catch (e) {
  // Ignore console issues in restricted environments
}
