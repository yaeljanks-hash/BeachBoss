
# Beach Boss 🏝️

A 2D beach restaurant time-management game built with Phaser.

## Project Goal
Build a playable mobile game with Game Operations and Analytics features.

## Tech Stack
- Phaser
- JavaScript
- GitHub

## Running the game

```bash
npm install
npm run dev            # play at the printed localhost address
npm run dev -- --host  # also reachable from a phone on the same Wi-Fi (play in landscape)
npm run build          # production build into dist/
```

## How to play

Each level is one timed shift. Earn the revenue target before the clock runs out.

1. Tap an empty table to seat the next guest in line (or tap a guest first to choose who sits).
2. When a guest shows **!**, tap their table: the waitress takes the order.
3. Tap the **beach bar** to hand in orders. Tap it again when an order shows **READY** to pick it up.
4. Tap the guest's table to deliver. They eat, pay, and leave a dirty table.
5. Tap the dirty table to clean it.

Every guest has a **patience meter** (green → yellow → red). It drains while they wait in line
and while they wait to order or to be served. If it empties, they leave unhappy and pay nothing.

## Where to change things

| What | File |
|---|---|
| Menu items, prices, prep times | `src/data/menu.js` |
| Levels: shift length, target, arrivals, patience, line size | `src/data/levels.js` |
| Global timings (menu reading, eating, cleaning), speeds, layout | `src/config.js` |

Both data files are validated at start-up; problems are reported in the browser console.

## Level balance

| Level | Name | Shift | Target | Arrivals every | Line | Patience in line | Patience seated |
|---|---|---|---|---|---|---|---|
| 1 | Easy Introduction | 2:30 | 80 | 10–14 s | 2 | 60 s | 75 s |
| 2 | Getting Busy | 2:30 | 90 | 8.5–12 s | 3 | 50 s | 62 s |
| 3 | Lunch Rush | 2:45 | 130 | 7–9.5 s | 3 | 42 s | 52 s |
| 4 | Beach Rush | 3:00 | 180 | 6–8.5 s | 3 | 36 s | 45 s |
| 5 | Peak Hour | 3:00 | 195 | 5–7.5 s | 3 | 30 s | 38 s |

Seated patience covers waiting to order plus waiting for the order. Reading the menu and eating
don't count, and taking the order refills 20% of the meter.

### How the numbers were chosen

**Earning model.** The average menu price is 103 / 8 ≈ **12.9 coins**, so revenue is roughly
guests served × 12.9. Random orders add noise of about ±3 coins per guest.

**Capacity.** One guest occupies a table for about 25–30 s: walking over, reading the menu (2.5–4.5 s),
waiting for the waitress, preparation (3–6.5 s), eating (4–6 s), leaving and cleaning (1.8 s).
With three tables and one waitress, a skilled player tops out at around one guest every 11 s.

**Difficulty comes from demand, not luck.** From Level 3 on, guests arrive faster than even a
skilled player can serve them. Patience shrinks each level, so falling behind costs walk-outs.
Targets sit below what good play can earn, so the pressure is real but beatable.

### Simulation results

A scripted player drove the real game in headless Chrome at 2× speed, playing every level
twice per profile:

- **Skilled:** reacts in about 0.3 s (game time), seats guests immediately, takes several orders
  before each bar trip, and serves the least patient guest first.
- **Casual:** reacts in about 1.5 s, takes each ticket to the bar straight away, and serves tables
  in number order.

| Level | Target | Skilled revenue (served / lost) | Casual revenue (served / lost) |
|---|---|---|---|
| 1 | 80 | 133, 153 (12–12 / 0) — pass by 66–91% | 108, 113 (8 / 0) — pass |
| 2 | 90 | 171, 172 (13–14 / 0) — pass | 110, 100 (8 / 1) — pass by 11–22% |
| 3 | 130 | 175, 200 (14–15 / 0) — pass by 35–54% | 125, 111 (9–10 / 2) — near miss |
| 4 | 180 | 207, 205 (16 / 0) — pass by ~14% | 129, 137 (10 / 4–5) — fail |
| 5 | 195 | 212, 222 (16 / 2) — pass by 9–14% | 130, 127 (10 / 6) — fail |

So a newcomer clears Levels 1–2, gets close on Level 3 while learning to batch orders, and
needs efficient play for Levels 4–5. Level 5 has the smallest margin by design.

**Limitations of the simulation.** Each level was run twice per profile, which is a small sample.
The bots never misclick, but they also don't plan ahead (for example by walking to the bar before an
order is ready). Running several headless browsers at once, or at high speed, slows the bots and
understates earnings, so all runs were done one at a time at 2× speed. Treat these as starting values
and tune them with real playtest data.
