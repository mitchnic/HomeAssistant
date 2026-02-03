# Blood Sugar Custom Card (Home Assistant)

Local custom card that shows the latest Nightscout blood sugar value from Home Assistant, changes background color based on mmol/L thresholds, and estimates a trend arrow from recent history.

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
- `history_minutes`: how far back to look for trend calculation.
- `trend_window`: how many recent points to use for slope.
- `slope_flat`: mmol/L per minute threshold for a flat arrow.
- `slope_single`: mmol/L per minute threshold for a single/double arrow.

## Notes

- Trend arrows are computed from Home Assistant history. If history is unavailable, the card will show "Trend unknown".
- Colors can be overridden via CSS variables:
  - `--bs-low`, `--bs-range`, `--bs-high`, `--bs-unknown`
