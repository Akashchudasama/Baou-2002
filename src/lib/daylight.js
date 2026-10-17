// The "fourth dimension": the portal is lit for the actual time of day in
// Ahmedabad (India Standard Time), whatever the visitor's own clock says.

const PHASES = [
  { id: 'night', from: 0, to: 5 },
  { id: 'dawn', from: 5, to: 8 },
  { id: 'day', from: 8, to: 16.5 },
  { id: 'dusk', from: 16.5, to: 19.25 },
  { id: 'night', from: 19.25, to: 24 },
];

export function istNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour').value);
  const minute = Number(parts.find((p) => p.type === 'minute').value);
  return { hour, minute, decimal: hour + minute / 60 };
}

export function daylight() {
  const t = istNow();
  // ?daylight=dawn|day|dusk|night previews another time of day
  const forced = new URLSearchParams(location.search).get('daylight');
  const phase = ['dawn', 'day', 'dusk', 'night'].includes(forced) ? forced : PHASES.find((p) => t.decimal >= p.from && t.decimal < p.to).id;
  const label = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
  // sun elevation proxy: 0 at 6:00 and 18:30, 1 at 12:15
  const sun = Math.max(0, Math.sin(((t.decimal - 6) / 12.5) * Math.PI));
  return { phase, label, sun, hour: t.decimal };
}

export const NAMES = { dawn: 'dawn light', day: 'daylight', dusk: 'evening light', night: 'lamplight' };

/** Applies data-daylight to <html> now and every five minutes; returns a stop function. */
export function startDaylight(onChange) {
  const tick = () => {
    const d = daylight();
    document.documentElement.dataset.daylight = d.phase;
    paintChip(d);
    onChange?.(d);
  };
  tick();
  const id = setInterval(tick, 5 * 60 * 1000);
  return () => clearInterval(id);
}

/** Writes the "lit for …" caption into the hero, if the hero is on screen. */
export function paintChip(d = daylight()) {
  const chip = document.getElementById('daylight-chip');
  if (chip) chip.textContent = `Lit by ${NAMES[d.phase]} · ${d.label} in Ahmedabad`;
}
