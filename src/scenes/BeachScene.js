import Phaser from 'phaser';
import { LAYOUT, CUSTOMERS, TIMING, PATIENCE, SHIFT, GAME_WIDTH, DEPTH } from '../config.js';
import { pickRandomMenuItem, validateMenu } from '../data/menu.js';
import { LEVELS, validateLevels } from '../data/levels.js';
import Waitress from '../objects/Waitress.js';
import Customer, { CustomerState, PATIENCE_DRAINING_STATES } from '../objects/Customer.js';
import Table, { GlowColor } from '../objects/Table.js';
import BeachBar from '../objects/BeachBar.js';
import Order, { OrderState } from '../objects/Order.js';
import StateMachine from '../systems/StateMachine.js';
import Shift from '../systems/Shift.js';
import CameraController from '../systems/CameraController.js';
import { drawBeachWorld } from '../world/drawBeachWorld.js';
import Hud from '../ui/Hud.js';
import OffscreenIndicators, { AttentionKind } from '../ui/OffscreenIndicators.js';
import { createMenuIcon } from '../ui/icons.js';
import { showToast, sparkle, coinReward } from '../ui/effects.js';

const randomBetween = ({ min, max }) => Phaser.Math.Between(min, max);

export const GameState = {
  READY: 'ready', // level intro card is showing
  PLAYING: 'playing',
  LEVEL_COMPLETE: 'levelComplete',
  LEVEL_FAILED: 'levelFailed'
};

const GAME_TRANSITIONS = {
  [GameState.READY]: [GameState.PLAYING],
  [GameState.PLAYING]: [GameState.LEVEL_COMPLETE, GameState.LEVEL_FAILED],
  [GameState.LEVEL_COMPLETE]: [],
  [GameState.LEVEL_FAILED]: []
};

/**
 * The restaurant during one shift (one level).
 *
 * Taps only send the waitress somewhere; what she does is decided when she
 * arrives, based on the state at that moment. That way a change of mind
 * mid-walk, or a timer firing during a walk, can never trigger a stale action.
 *
 * The beach is wider than the screen. CameraController scrolls it (drag, swipe,
 * mouse wheel, or following the waitress) and turns presses into taps, so a
 * drag never triggers an action.
 *
 * Restarting or advancing a level restarts this scene, which destroys every
 * object, timer and tween from the previous shift. Only the total coin balance
 * (kept in the game registry) carries over.
 */
export default class BeachScene extends Phaser.Scene {
  constructor() {
    super('BeachScene');
  }

  init(data) {
    this.levelIndex = Phaser.Math.Clamp(data?.levelIndex ?? 0, 0, LEVELS.length - 1);
  }

  create() {
    this.reportConfigProblems();

    this.level = LEVELS[this.levelIndex];
    this.gameState = new StateMachine('Game', GameState.READY, GAME_TRANSITIONS);
    this.shift = new Shift(this, this.level);
    if (!this.registry.has('totalCoins')) this.registry.set('totalCoins', 0);

    drawBeachWorld(this);

    this.tables = LAYOUT.tableXs.map((x, i) => new Table(this, x, LAYOUT.tableFloorY, i + 1));
    this.bar = new BeachBar(this, this.tables.length);
    this.waitress = new Waitress(this, LAYOUT.waitressStart.x, LAYOUT.waitressStart.y);

    this.customers = []; // everyone currently in the scene
    this.queue = []; // customers in line, front first
    this.selectedCustomer = null;
    this.lowTimeWarned = false;

    this.hud = new Hud(this, this.level);
    this.indicators = new OffscreenIndicators(this);
    this.hud.setTotalCoins(this.registry.get('totalCoins'));
    this.refreshUi();

    this.cameraController = new CameraController(this, {
      target: this.waitress,
      isTweening: () => this.tweens.isTweening(this.waitress),
      canInteract: () => this.isPlaying,
      onTap: (x, y, screenX, screenY) => this.handleTap(x, y, screenX, screenY)
    });

    // Show the level intro; its Start button calls startShift()
    this.scene.launch('ShiftOverlay', { mode: 'intro', levelIndex: this.levelIndex });
  }

  get isPlaying() {
    return this.gameState.is(GameState.PLAYING);
  }

  update(time, delta) {
    // The camera runs on real time, even when gameplay is sped up for testing
    this.cameraController.update(delta);

    // Characters further down the screen are drawn in front
    this.waitress.setDepth(this.waitress.y);
    this.customers.forEach(customer => customer.setDepth(customer.y));

    if (!this.isPlaying) return;

    // Scene time can be sped up (timeScale), so scale patience with it
    this.drainPatience(delta * this.time.timeScale);

    const camera = this.cameras.main;
    this.indicators.update(this.attentionItems(camera.scrollX, this.cameraController.viewWidth), camera.scrollX, this.cameraController.viewWidth);

    const remaining = this.shift.remainingMs;
    this.hud.setTime(remaining);
    if (!this.lowTimeWarned && remaining <= SHIFT.lowTimeWarningMs) {
      this.lowTimeWarned = true;
      showToast(this, GAME_WIDTH / 2, 150, `${Math.round(SHIFT.lowTimeWarningMs / 1000)} seconds left!`, '#ffcc80', {
        fixed: true
      });
    }
  }

  reportConfigProblems() {
    const problems = [...validateMenu(), ...validateLevels(LEVELS, LAYOUT.queueSpots.length)];
    if (problems.length) console.error('[config] problems found:\n' + problems.join('\n'));
  }

  // ---------------------------------------------------------------------------
  // Shift lifecycle
  // ---------------------------------------------------------------------------

  /** Called by the intro card's Start button. */
  startShift() {
    if (!this.gameState.transition(GameState.PLAYING)) return;
    this.shift.start(() => this.endShift());
    this.scheduleArrivals();
    this.refreshUi();
  }

  endShift() {
    const summary = this.shift.summary();
    const next = summary.succeeded ? GameState.LEVEL_COMPLETE : GameState.LEVEL_FAILED;
    if (!this.gameState.transition(next)) return; // the results screen can only appear once

    // Bank the shift's revenue into the total balance
    const totalCoins = this.registry.get('totalCoins') + summary.revenue;
    this.registry.set('totalCoins', totalCoins);

    // Freeze the beach (timers, tweens, patience) and show the results
    this.hud.setTime(0);
    this.indicators.hide();
    this.scene.pause();
    this.scene.launch('ShiftOverlay', {
      mode: 'results',
      levelIndex: this.levelIndex,
      summary,
      totalCoins,
      earned: summary.revenue
    });
  }

  // ---------------------------------------------------------------------------
  // UI refresh: HUD, hint line and table glows
  // ---------------------------------------------------------------------------

  refreshUi() {
    const carried = this.waitress.carrying;
    const anyoneWaiting = this.queue.some(c => c.isWaiting);
    const freeTable = this.tables.some(t => t.isAvailable);

    this.tables.forEach(table => {
      if (carried?.table === table) table.setGlow(GlowColor.DELIVER);
      else if (anyoneWaiting && table.isAvailable) table.setGlow(GlowColor.SEAT);
      else table.setGlow(null);
    });

    const { shift } = this;
    this.hud.setStats(shift.served, shift.lost);
    this.hud.setRevenue(shift.revenue, shift.target);
    this.hud.setTime(shift.remainingMs);
    this.hud.setHint(this.currentHint(carried, anyoneWaiting, freeTable));
  }

  /**
   * Everything that needs the player right now, for the off-screen indicators.
   * Requests from impatient guests are the most urgent; cleaning comes last.
   * `viewLeft`/`viewWidth` describe the visible part of the world.
   *
   * Each item's `x` is where the player would look (a table's speech bubble,
   * above the guest), used to decide whether it is on screen; `panX` is where
   * the camera centres when its indicator is tapped.
   */
  attentionItems(viewLeft, viewWidth) {
    const items = [];
    const carried = this.waitress.carrying;
    const urgencyOf = patience => 1 - patience;

    this.tables.forEach(table => {
      const customer = table.customer;
      const label = `T${table.number}`;
      const bubbleX = table.x + table.bubble.x * table.scaleX;
      const base = { x: bubbleX, panX: (bubbleX + table.x) / 2, label };
      if (customer?.fsm.is(CustomerState.READY_TO_ORDER)) {
        items.push({ ...base, key: `order-${table.number}`, kind: AttentionKind.ORDER, patience: customer.patience, urgency: urgencyOf(customer.patience) });
      } else if (carried && customer?.order === carried && customer.fsm.is(CustomerState.WAITING_FOR_ORDER)) {
        items.push({ ...base, key: `deliver-${table.number}`, kind: AttentionKind.DELIVER, item: carried.item, patience: customer.patience, urgency: urgencyOf(customer.patience) });
      } else if (table.isDirty) {
        items.push({ ...base, key: `clean-${table.number}`, kind: AttentionKind.CLEAN, patience: null, urgency: 0 });
      }
    });

    // A finished order the waitress could pick up now
    const ready = this.bar.readyOrders[0];
    if (ready && this.waitress.handsFree) {
      items.push({ key: 'pickup', kind: AttentionKind.PICKUP, x: this.bar.messagePoint.x, label: 'Bar', item: ready.item, patience: ready.customer.patience, urgency: urgencyOf(ready.customer.patience) });
    }

    // Guests are waiting and no free table is on screen: point at the nearest free one
    const waiting = this.queue.filter(c => c.isWaiting);
    const free = this.tables.filter(t => t.isAvailable);
    const isVisible = x => x >= viewLeft && x <= viewLeft + viewWidth;
    if (waiting.length && free.length && !free.some(t => isVisible(t.x))) {
      const center = viewLeft + viewWidth / 2;
      const table = free.reduce((a, b) => (Math.abs(b.x - center) < Math.abs(a.x - center) ? b : a));
      const patience = Math.min(...waiting.map(c => c.patience));
      items.push({ key: `seat-${table.number}`, kind: AttentionKind.SEAT, x: table.x, label: `T${table.number}`, patience, urgency: urgencyOf(patience) });
    }
    return items;
  }

  /** The most useful next step for the player, in priority order. */
  currentHint(carried, anyoneWaiting, freeTable) {
    if (!this.isPlaying) return '';
    if (carried) return `Deliver the ${carried.item.name} to Table ${carried.table.number}`;

    const ready = this.bar.readyOrders[0];
    if (ready) return `${ready.item.name} for Table ${ready.table.number} is ready at the bar`;

    if (this.waitress.tickets.length) return 'Take the order to the beach bar';

    const ordering = this.tables.find(t => t.customer?.fsm.is(CustomerState.READY_TO_ORDER));
    if (ordering) return `Table ${ordering.number} is ready to order`;

    const dirty = this.tables.find(t => t.isDirty);
    if (dirty) return `Tap Table ${dirty.number} to clean it`;

    if (anyoneWaiting && freeTable) return 'Tap an empty table to seat a guest';
    if (anyoneWaiting) return 'All tables are busy - guests are waiting';
    return 'Tap the sand to move';
  }

  // ---------------------------------------------------------------------------
  // Arrivals and the waiting line
  // ---------------------------------------------------------------------------

  scheduleArrivals() {
    const { level } = this;

    // Opening wave
    for (let i = 0; i < level.initialCustomers; i++) {
      this.time.delayedCall(CUSTOMERS.firstArrivalMs + i * CUSTOMERS.initialIntervalMs, () => this.spawnCustomer());
    }

    // Then keep guests coming until the shift ends
    const openingWaveMs = CUSTOMERS.firstArrivalMs + level.initialCustomers * CUSTOMERS.initialIntervalMs;
    this.time.delayedCall(openingWaveMs + randomBetween(level.arrivalIntervalMs), () => this.continuousArrival());
  }

  continuousArrival() {
    if (!this.isPlaying) return;

    const lineHasRoom = this.queue.length < this.level.maxQueue;
    if (lineHasRoom) this.spawnCustomer();

    const delay = lineHasRoom ? randomBetween(this.level.arrivalIntervalMs) : CUSTOMERS.retryWhenLineFullMs;
    this.time.delayedCall(delay, () => this.continuousArrival());
  }

  spawnCustomer() {
    if (!this.isPlaying || this.queue.length >= this.level.maxQueue) return;

    const { x, y } = LAYOUT.spawnPoint;
    const customer = new Customer(this, x, y);
    this.customers.push(customer);
    this.queue.push(customer);
    this.moveQueueForward();
  }

  /** Send every customer in line to their current spot. */
  moveQueueForward() {
    this.queue.forEach((customer, i) => {
      const spot = LAYOUT.queueSpots[i];
      customer.walkTo(spot.x, spot.y, () => {
        if (customer.fsm.is(CustomerState.ARRIVING)) {
          customer.fsm.transition(CustomerState.WAITING);
          customer.showPatience(true);
        }
        customer.faceLeft(); // towards the restaurant
        this.refreshUi();
      });
    });
  }

  selectCustomer(customer) {
    this.selectedCustomer?.setSelected(false);
    this.selectedCustomer = customer === this.selectedCustomer ? null : customer;
    this.selectedCustomer?.setSelected(true);
  }

  // ---------------------------------------------------------------------------
  // Patience
  // ---------------------------------------------------------------------------

  drainPatience(deltaMs) {
    // Copy the list: a guest running out of patience changes the line
    [...this.customers].forEach(customer => {
      const meter = PATIENCE_DRAINING_STATES[customer.fsm.state];
      if (meter && customer.drainPatience(deltaMs, this.level.patience[meter])) {
        this.customerLeavesUnhappy(customer);
      }
    });
  }

  /** A guest ran out of patience: they leave without paying. */
  customerLeavesUnhappy(customer) {
    const table = this.tables.find(t => t.customer === customer);
    if (!customer.fsm.transition(CustomerState.LEAVING)) return;

    this.shift.recordLost();
    customer.becomeUnhappy();
    if (this.selectedCustomer === customer) this.selectedCustomer = null;
    const above = customer.pointAbove(110);
    showToast(this, above.x, above.y, 'Left unhappy', '#ff8a80');

    let exitPath;
    if (table) {
      // Seated: throw away their order wherever it is, and free the table
      this.discardOrder(customer.order);
      table.release();
      customer.stand();
      exitPath = [
        { x: customer.x, y: LAYOUT.exitLaneY },
        { x: LAYOUT.exitX, y: LAYOUT.exitLaneY }
      ];
    } else {
      // In line: step out and walk back the way they came
      this.queue = this.queue.filter(c => c !== customer);
      this.moveQueueForward();
      exitPath = [{ x: LAYOUT.spawnPoint.x + 20, y: customer.y }];
    }

    customer.walkPath(exitPath, () => this.removeCustomer(customer));
    this.refreshUi();
  }

  /** Cancel an order that will never be delivered, wherever it currently is. */
  discardOrder(order) {
    if (!order || !order.fsm.transition(OrderState.CANCELLED)) return;
    this.waitress.removeTicket(order);
    this.bar.discardOrder(order);
    if (this.waitress.carrying === order) {
      this.waitress.dropCarried();
      const above = this.waitress.pointAbove(105);
      showToast(this, above.x, above.y, 'Order wasted', '#ffcc80');
    }
  }

  removeCustomer(customer) {
    this.customers = this.customers.filter(c => c !== customer);
    customer.stopWalking();
    customer.destroy();
  }

  // ---------------------------------------------------------------------------
  // Customer lifecycle
  // ---------------------------------------------------------------------------

  seatCustomer(customer, table) {
    if (!customer.isWaiting || !table.isAvailable) return;

    table.reserve(customer);
    customer.fsm.transition(CustomerState.WALKING_TO_TABLE);
    this.queue = this.queue.filter(c => c !== customer);
    if (this.selectedCustomer === customer) this.selectCustomer(customer); // clears selection

    // The guest walks over on their own, in front of the furniture and then up
    // to the stool; the waitress carries on with her job
    const { seatSpot } = table;
    customer.walkPath([{ x: seatSpot.x, y: LAYOUT.guestWalkY }, seatSpot], () => this.onCustomerSeated(customer, table));

    this.moveQueueForward();
    this.refreshUi();
  }

  onCustomerSeated(customer, table) {
    if (!customer.fsm.transition(CustomerState.SEATED)) return;
    table.occupy();
    customer.sit();
    customer.setPatience(1); // the seated meter starts full
    table.bubble.showThinking();

    // Read the menu for a moment, then call the waitress over
    this.time.delayedCall(randomBetween(TIMING.browseMenuMs), () => {
      if (!customer.fsm.transition(CustomerState.READY_TO_ORDER)) return;
      table.bubble.showReadyToOrder();
      this.refreshUi();
    });
    this.refreshUi();
  }

  takeOrder(table) {
    const customer = table.customer;
    if (!customer.fsm.transition(CustomerState.WAITING_FOR_ORDER)) return;

    const order = new Order(pickRandomMenuItem(Phaser.Math.RND), table, customer);
    customer.order = order;
    customer.setPatience(customer.patience + PATIENCE.orderTakenRefill);
    this.waitress.addTicket(order);
    table.bubble.showOrder(order.item);
  }

  deliverOrder(table) {
    const customer = table.customer;
    const order = this.waitress.carrying;
    if (customer.order !== order || !customer.fsm.can(CustomerState.EATING)) return;
    if (!order.fsm.transition(OrderState.DELIVERED)) return;

    customer.fsm.transition(CustomerState.EATING);
    customer.showPatience(false); // patience doesn't matter while eating
    this.waitress.dropCarried();
    table.bubble.hide();
    table.showServedItem(order.item);
    const item = table.pointAbove(70, -28);
    sparkle(this, item.x, item.y);
    const above = table.pointAbove(110, -40);
    showToast(this, above.x, above.y, 'Yum!', '#fff59d');

    // Consume the item, then pay
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TIMING.consumeMs[order.item.category] ?? TIMING.consumeMs.food,
      onUpdate: tween => table.setConsumedProgress(tween.getValue()),
      onComplete: () => this.payForOrder(order)
    });
  }

  payForOrder(order) {
    // The PAID transition can only happen once, so coins can't be awarded twice
    if (!this.isPlaying || !order.fsm.transition(OrderState.PAID)) return;

    const { customer, table } = order;
    const amount = order.item.price;
    const justReachedTarget = this.shift.addRevenue(amount);

    table.clearServedItem();
    const chest = customer.pointAbove(60);
    sparkle(this, chest.x, chest.y, [0xffd54f, 0xffffff, 0xffb300]);
    coinReward(this, customer.pointAbove(95), amount, this.hud.coinTarget, () =>
      this.hud.setRevenue(this.shift.revenue, this.shift.target, true)
    );
    if (justReachedTarget) this.celebrateTarget();

    this.time.delayedCall(TIMING.leaveDelayMs, () => this.customerLeaves(customer, table));
    this.refreshUi();
  }

  customerLeaves(customer, table) {
    if (!customer.fsm.transition(CustomerState.LEAVING)) return;

    customer.stand();
    table.vacate();
    customer.walkPath(
      [
        { x: customer.x, y: LAYOUT.exitLaneY },
        { x: LAYOUT.exitX, y: LAYOUT.exitLaneY }
      ],
      () => this.removeCustomer(customer)
    );
    this.refreshUi();
  }

  celebrateTarget() {
    const banner = this.add
      .text(GAME_WIDTH / 2, 170, 'Target reached!', { fontSize: '30px', color: '#b9f6ca', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setStroke('#1b5e20', 5)
      .setDepth(DEPTH.hud)
      .setScrollFactor(0)
      .setScale(0);
    const colors = [0xb9f6ca, 0xffffff, 0xffd54f];
    sparkle(this, GAME_WIDTH / 2 - 110, 170, colors, { fixed: true });
    sparkle(this, GAME_WIDTH / 2 + 110, 170, colors, { fixed: true });
    this.tweens.add({ targets: banner, scale: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: banner, alpha: 0, y: 150, delay: 1600, duration: 500, onComplete: () => banner.destroy() });
  }

  // ---------------------------------------------------------------------------
  // Bar and cleaning
  // ---------------------------------------------------------------------------

  onBarArrival() {
    const { waitress, bar } = this;
    let didSomething = false;

    // Hand over any tickets
    const tickets = waitress.takeTickets();
    const rejected = tickets.filter(order => !bar.startPreparing(order, () => this.onOrderReady(order)));
    rejected.forEach(order => waitress.addTicket(order));
    if (tickets.length > rejected.length) {
      didSomething = true;
      showToast(this, bar.messagePoint.x, bar.messagePoint.y, tickets.length > 1 ? 'Orders placed!' : 'Order placed!');
    }

    // Pick up a finished order if her hands are free
    if (waitress.handsFree && bar.hasReadyOrder) {
      const order = bar.takeReadyOrder();
      if (order.fsm.transition(OrderState.CARRIED)) {
        waitress.carry(order, createMenuIcon(this, order.item));
        didSomething = true;
      }
    }

    if (!didSomething) {
      let message = 'Nothing to pick up';
      if (!waitress.handsFree && bar.hasReadyOrder) message = 'Hands full - deliver first!';
      else if (bar.slots.some(s => s.order)) message = 'Still preparing...';
      showToast(this, bar.messagePoint.x, bar.messagePoint.y, message);
    }
    this.refreshUi();
  }

  onOrderReady(order) {
    const { x, y } = this.bar.messagePoint;
    showToast(this, x, y, `${order.item.name} ready!`, '#c8e6c9');
    this.refreshUi();
  }

  startCleaning(table) {
    if (!table.startCleaning()) return;

    const tween = this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: TIMING.cleaningMs,
      onUpdate: t => table.setCleaningProgress(t.getValue()),
      onComplete: () => {
        this.waitress.finishActivity();
        if (!table.finishCleaning()) return;
        const top = table.pointAbove(60);
        sparkle(this, top.x, top.y);
        this.refreshUi();
      }
    });

    // Walking away mid-wipe cancels the job; the table stays dirty
    this.waitress.startActivity(() => {
      tween.destroy();
      table.cancelCleaning();
      this.refreshUi();
    });
    this.refreshUi();
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  /** Send the waitress somewhere, and have the camera follow her there. */
  sendWaitress(x, y, onArrive) {
    this.waitress.walkTo(x, y, onArrive);
    this.cameraController.follow(x);
  }

  /** A tap (not a drag) at world point (x, y), from CameraController. */
  handleTap(x, y, screenX, screenY) {
    if (!this.isPlaying) return;

    // Off-screen indicators sit on top of the world: they only move the camera
    const request = this.indicators.hitTest(screenX, screenY);
    if (request) {
      this.cameraController.panTo(request.panX ?? request.x);
      return;
    }

    const customer = this.queue.find(c => c.isWaiting && c.containsPoint(x, y));
    if (customer) {
      this.selectCustomer(customer);
      return;
    }

    if (this.bar.containsPoint(x, y)) {
      const spot = this.bar.serviceSpot;
      this.sendWaitress(spot.x, spot.y, () => this.onBarArrival());
      return;
    }

    const table = this.tables.find(t => t.containsPoint(x, y));
    if (table) {
      this.handleTableTap(table);
      return;
    }

    const { minX, maxX, minY, maxY } = LAYOUT.walkArea;
    this.sendWaitress(Phaser.Math.Clamp(x, minX, maxX), Phaser.Math.Clamp(y, minY, maxY));
  }

  handleTableTap(table) {
    // Seating happens on tap (the guest walks over on their own)
    if (table.isAvailable) {
      const guest = this.selectedCustomer ?? this.queue.find(c => c.isWaiting);
      if (guest) {
        this.seatCustomer(guest, table);
        return;
      }
    }

    // Everything else happens once the waitress gets there
    this.sendWaitress(table.serviceSpot.x, table.serviceSpot.y, () => this.onTableArrival(table));
  }

  /** Decide what the waitress does at a table, based on its state right now. */
  onTableArrival(table) {
    if (!this.isPlaying) return;

    const above = table.pointAbove(100);
    const say = message => showToast(this, above.x, above.y, message);
    const customer = table.customer;
    const carried = this.waitress.carrying;

    if (table.isDirty) {
      this.startCleaning(table);
      return;
    }

    if (!customer) {
      if (table.isAvailable) say('No guests waiting');
      return;
    }

    switch (customer.fsm.state) {
      case CustomerState.WALKING_TO_TABLE:
      case CustomerState.SEATED:
        say('Still reading the menu...');
        break;

      case CustomerState.READY_TO_ORDER:
        this.takeOrder(table);
        break;

      case CustomerState.WAITING_FOR_ORDER:
        if (carried && carried === customer.order) this.deliverOrder(table);
        else if (carried) say(`That's for Table ${carried.table.number}!`);
        else if (customer.order.fsm.is(OrderState.TAKEN)) say('Take the order to the bar first');
        else if (customer.order.fsm.is(OrderState.READY_FOR_PICKUP)) say('Pick it up at the bar');
        else say('Being prepared...');
        break;

      case CustomerState.EATING:
        say('Enjoying it!');
        break;

      default:
        break;
    }
    this.refreshUi();
  }
}
