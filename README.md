
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

The beach is wider than the screen: the bar is on the left, the three tables stand on the
deck in the middle, and guests line up on the right.

- **Look around:** drag or swipe sideways (mouse wheel or trackpad also works on desktop).
  A quick swipe keeps gliding; touch the screen to stop it.
- **The camera follows the waitress** whenever you send her somewhere. Dragging takes over
  the camera until your next tap that sends her walking.
- A drag never counts as a tap, so scrolling can't trigger an action by accident.
- **Off-screen requests** show as an arrow bubble at the left or right edge: **!** (ready to
  order), the dish (ready at the bar, or to deliver), a guest (free table for the line) or a
  broom (dirty table). Its colour follows the guest's patience, red pulses, and "+1" means
  more requests on that side. Tap it to glide the camera there; it never moves the waitress.

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
| World size, character/table/bar scale, camera feel | `WORLD`, `SCALE`, `CAMERA` in `src/config.js` |
| Scenery (sky, ocean, deck, decorations) | `src/world/drawBeachWorld.js` |
| Camera, drag/swipe and tap detection | `src/systems/CameraController.js` |
| Off-screen indicators (look) / which requests they show | `src/ui/OffscreenIndicators.js` / `attentionItems()` in `src/scenes/BeachScene.js` |

Both data files are validated at start-up; problems are reported in the browser console.

## Automated QA

```bash
npm run qa                    # all suites, about 3 minutes
npm run qa -- camera mobile   # only some suites: gameplay, camera, indicators, mobile
npm run qa:balance            # balance simulation, both bot profiles, all levels (~15 minutes)
npm run qa:balance -- --profile skilled --levels 4,5 --runs 3
```

The QA runner starts the Vite dev server and drives the game in headless Chrome with real mouse
and touch input. It needs Node 22 or newer and Chrome or Edge installed; there are no extra npm
packages. It exits with code 1 if any check fails.

| Suite | Covers |
|---|---|
| `gameplay` | Service loop, patience and walk-outs, shift timer, results, restart, level progression (v1.0 regression) |
| `camera` | World bounds, drag vs tap, swipe glide, wheel, following, fixed HUD, reachability, trip time, service after scrolling |
| `indicators` | Direction, priority and badge, hiding, tap-to-pan without moving the waitress, every request type |
| `mobile` | Three phone/tablet landscape sizes with emulated touch: scaling, swipe, flick, touch taps, indicators, no page scroll or zoom |

Options (environment variables): `CHROME_PATH` (browser to use), `QA_PORT` (dev server port,
default 4180), `QA_URL` (test a dev server that is already running), `QA_SCREENSHOTS` (folder for
screenshots; `qa-output` is git-ignored). Browser profiles go to the system temp folder, so a run
leaves nothing in the repo.
Some steps use the dev-only `window.beachBoss` hook to fast-forward (for example lowering a
guest's patience); the tests mark those steps `[hook]`.

The tests don't replace playing on a real phone: feel, readability and fun still need people.

## World and camera

| | Size (game units) |
|---|---|
| Screen (viewport) | 960 × 540, scaled to fit any screen (16:9, letterboxed if needed) |
| World | 2400 × 540 (2.5 screens wide; no vertical scrolling) |
| Restaurant deck | x 30–1480: bar 70–340, tables at x 620 / 950 / 1280 |
| Waiting area | x 1600–1780, entrance arch at 1910–2100, open beach beyond |

- Characters, tables and the bar keep their original artwork, scaled up 1.5×. Walking speeds
  are scaled to match (waitress 520, guests 240 units/s), so the longest service trip
  (bar → Table 3) takes 2.09 s, against 2.03 s in v1.0. A first, roomier layout
  (2560 wide, tables 380 apart) made trips about 25% longer and cost a skilled player 3–4
  guests per shift, which failed Levels 4 and 5, so the deck was tightened.
- The scenery is drawn once and baked into images. Drawn live, its ~35,000 drawing
  commands per frame held headless Chrome to 37 FPS; baked, it runs at a steady 60.
- The waitress walks in a lane in front of all furniture (y 470–528). Every spot she uses
  (the bar counter and each table's service spot) is inside that lane, so she can never walk
  through a table. Seated guests walk along the front and then step up to their stool.
- Camera: a press that moves less than 12 units is a tap; anything further is a drag. While
  following, the camera keeps the waitress at least 170 units from the screen edges and, on a
  long walk, keeps her near the trailing edge so the way ahead is visible. The camera is
  clamped to the world, so it never shows empty space.
- The HUD, the "seconds left" warning and the "Target reached!" banner are fixed to the
  screen. Coins fly from the guest to the fixed coin counter.

## Level balance

| Level | Name | Shift | Target | Arrivals every | Line | Patience in line | Patience seated |
|---|---|---|---|---|---|---|---|
| 1 | Easy Introduction | 2:30 | 80 | 10–14 s | 2 | 60 s | 75 s |
| 2 | Getting Busy | 2:30 | 90 | 8.5–12 s | 3 | 50 s | 62 s |
| 3 | Lunch Rush | 2:45 | 130 | 7–9.5 s | 3 | 42 s | 52 s |
| 4 | Beach Rush | 3:00 | 180 | 6–8.5 s | 3 | 36 s | 45 s |
| 5 | Peak Hour | 3:00 | 185 | 5–7.5 s | 3 | 30 s | 38 s |

Level 5's target was 195 in v1.0; it was lowered to 185 for the wider 2.0 world (see below).

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

**v1.0** (small beach, Level 5 target 195):

| Level | Target | Skilled revenue (served / lost) | Casual revenue (served / lost) |
|---|---|---|---|
| 1 | 80 | 133, 153 (12–12 / 0) — pass by 66–91% | 108, 113 (8 / 0) — pass |
| 2 | 90 | 171, 172 (13–14 / 0) — pass | 110, 100 (8 / 1) — pass by 11–22% |
| 3 | 130 | 175, 200 (14–15 / 0) — pass by 35–54% | 125, 111 (9–10 / 2) — near miss |
| 4 | 180 | 207, 205 (16 / 0) — pass by ~14% | 129, 137 (10 / 4–5) — fail |
| 5 | 195 | 212, 222 (16 / 2) — pass by 9–14% | 130, 127 (10 / 6) — fail |

So a newcomer clears Levels 1–2, gets close on Level 3 while learning to batch orders, and
needs efficient play for Levels 4–5. Level 5 has the smallest margin by design.

**Beach Boss 2.0 world (Phase 1).** The same bots replayed every level in the wide, scrolling
world (one run each; Level 5 skilled twice):

| Level | Target | Skilled (served / lost) | Casual (served / lost) |
|---|---|---|---|
| 1 | 80 | 154 (12 / 0) — pass | 102 (7 / 0) — pass |
| 2 | 90 | 151 (12 / 0) — pass | 90 (7 / 1) — pass, exactly on target |
| 3 | 130 | 172 (13 / 0) — pass | 96 (8 / 2) — fail |
| 4 | 180 | 192 (15 / 0) — pass | 126 (10 / 4) — fail |
| 5 | 195 | 183, 206 (15 / 1–2) — fail, pass | 125 (9 / 7) — fail |

The difficulty curve keeps its shape, but players serve about one guest fewer per shift than in
v1.0, which made Level 5 a coin-flip for the skilled bot.

**Level 5 target lowered to 185.** Three more runs per profile at the new target:

| Profile | Revenue (served / lost) | Result |
|---|---|---|
| Skilled | 204, 159, 205 (15 / 1–2) | 2 of 3 pass |
| Casual | 125, 128, 97 (9 / 6–7) | 0 of 3 |

The skilled bot serves exactly 15 guests in every Level 5 run, so passing depends on which dishes
the guests happen to order (revenue ranged from 159 to 206 for the same 15 guests). Using the menu's
price spread (average 12.9, standard deviation about 2.9), 15 random orders reach 185 about 75% of
the time, against about 45% for 195. Level 5 is now achievable for good play while staying the
hardest level; a newcomer still can't clear it.

**Limitations of the simulation.** Each level was run twice per profile, which is a small sample.
The bots never misclick, but they also don't plan ahead (for example by walking to the bar before an
order is ready). Running several headless browsers at once, or at high speed, slows the bots and
understates earnings, so all runs were done one at a time at 2× speed. Treat these as starting values
and tune them with real playtest data.
