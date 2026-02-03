# Blood Sugar Custom Card (Home Assistant)

Custom Lovelace card that shows the latest Nightscout blood sugar value from Home Assistant, changes background color based on mmol/L thresholds, estimates a trend arrow from recent history, and includes a minutes-since-last-reading line plus a mini sparkline.

## Install (Local)

1. Copy `blood-sugar-card.js` to your Home Assistant `config/www/` folder.
2. Add it as a resource in Home Assistant:
   - Settings → Dashboards → Resources → Add Resource
   - URL: `/local/blood-sugar-card.js`
   - Type: `JavaScript Module`
3. Add the card to a dashboard using YAML.

## Example Card YAML

```yaml
type: custom:blood-sugar-card
name: Blood Sugar
entity: sensor.blood_sugar
low_threshold: 4.0
high_threshold: 10.1
history_minutes: 30
trend_window: 3
slope_flat: 0.05
slope_single: 0.11
```

## Options

- `entity` (required): sensor with the current glucose value.
- `name`: title shown on the card.
- `low_threshold`: mmol/L value at or below this is treated as low.
- `high_threshold`: mmol/L value at or above this is treated as high.
- `history_minutes`: how far back to look for trend calculation and sparkline.
- `trend_window`: how many recent points to use for slope.
- `slope_flat`: mmol/L per minute threshold for a flat arrow.
- `slope_single`: mmol/L per minute threshold for a single/double arrow.

## HACS (Prepared)

This folder includes `manifest.json` and `hacs.json` so the card can be published as a HACS Lovelace card. If you decide to make this repo HACS-installable later, HACS generally expects a single card per repository. You can either:

- Move this card to its own repo, or
- Promote `Blood-Sugar-Card` to the repo root and adjust `hacs.json`

Note: As the repo is currently structured (multiple projects), this card is not directly installable via HACS until one of the above options is done.

## Notes

- Trend arrows and the sparkline are computed from Home Assistant history. If history is unavailable, the card will show "Trend unknown" and the sparkline may be empty.
- Colors can be overridden via CSS variables:
  - `--bs-low`, `--bs-range`, `--bs-high`, `--bs-unknown`
