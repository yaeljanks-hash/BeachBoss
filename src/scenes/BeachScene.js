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
import Hud from '../ui/Hud.js';
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

    this.drawBackground();

    this.tables = LAYOUT.tableXs.map((x, i) => new Table(this, x, LAYOUT.tableFloorY, i + 1));
    this.bar = new BeachBar(this, this.tables.length);
    this.waitress = new Waitress(this, LAYOUT.waitressStart.x, LAYOUT.waitressStart.y);

    this.customers = []; // everyone currently in the scene
    this.queue = []; // customers in line, front first
    this.selectedCustomer = null;
    this.lowTimeWarned = false;

    this.hud = new Hud(this, this.level);
    this.hud.setTotalCoins(this.registry.get('totalCoins'));
    this.refreshUi();

    this.input.on('pointerdown', this.handleTap, this);

    // Show the level intro; its Start button calls startShift()
    this.scene.launch('ShiftOverlay', { mode: 'intro', levelIndex: this.levelIndex });
  }

  get isPlaying() {
    return this.gameState.is(GameState.PLAYING);
  }

  update(time, delta) {
    // Characters further down the screen are drawn in front
    this.waitress.setDepth(this.waitress.y);
    this.customers.forEach(customer => customer.setDepth(customer.y));

    if (!this.isPlaying) return;

    // Scene time can be sped up (timeScale), so scale patience with it
    this.drainPatience(delta * this.time.timeScale);

    const remaining = this.shift.remainingMs;
    this.hud.setTime(remaining);
    if (!this.lowTimeWarned && remaining <= SHIFT.lowTimeWarningMs) {
      this.lowTimeWarned = true;
      showToast(this, GAME_WIDTH / 2, 150, `${Math.round(SHIFT.lowTimeWarningMs / 1000)} seconds left!`, '#ffcc80');
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
  // Scene setup
  // ---------------------------------------------------------------------------

  drawBackground() {
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Sun (kept clear of the HUD panels)
    this.add.circle(730, 52, 30, 0xfff176);

    // Ocean with a few wave lines
    this.add.rectangle(480, 230, 960, 250, 0x35b9cc);
    const waves = this.add.graphics();
    waves.lineStyle(3, 0xffffff, 0.35);
    [[150, 180], [420, 240], [700, 200], [300, 300], [820, 290]].forEach(([x, y]) => {
      waves.beginPath();
      waves.arc(x, y, 14, Math.PI * 1.15, Math.PI * 1.85);
      waves.strokePath();
    });

    // Sand
    this.add.rectangle(480, 475, 960, 230, 0xf4d79b);

    // Game title
    this.add
      .text(480, 55, 'BEACH BOSS', { fontSize: '42px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);

    // Waiting area: a mat on the sand and a small sign
    const { queueSpots } = LAYOUT;
    const front = queueSpots[0];
    const back = queueSpots[queueSpots.length - 1];
    this.add.rectangle((front.x + back.x) / 2, front.y + 2, front.x - back.x + 60, 16, 0xd84315, 0.35);
    const signX = front.x + 58;
    this.add.rectangle(signX, 485, 4, 50, 0x6b4129);
    this.add.rectangle(signX, 460, 70, 22, 0x8b5a3c);
    this.add
      .text(signX, 460, 'WAIT HERE', { fontSize: '11px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
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
        customer.faceRight();
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
    showToast(this, customer.x, customer.y - 120, 'Left unhappy', '#ff8a80');

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
      exitPath = [{ x: LAYOUT.spawnPoint.x - 20, y: customer.y }];
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
      showToast(this, this.waitress.x, this.waitress.y - 110, 'Order wasted', '#ffcc80');
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

    // The guest walks over on their own; the waitress carries on with her job
    customer.walkTo(table.seatSpot.x, table.seatSpot.y, () => this.onCustomerSeated(customer, table));

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
    sparkle(this, table.x - 28, table.y - 70);
    showToast(this, table.x - 40, table.y - 110, 'Yum!', '#fff59d');

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
    sparkle(this, customer.x, customer.y - 60, [0xffd54f, 0xffffff, 0xffb300]);
    coinReward(this, { x: customer.x, y: customer.y - 95 }, amount, this.hud.coinTarget, () =>
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
      .setScale(0);
    sparkle(this, GAME_WIDTH / 2 - 110, 170, [0xb9f6ca, 0xffffff, 0xffd54f]);
    sparkle(this, GAME_WIDTH / 2 + 110, 170, [0xb9f6ca, 0xffffff, 0xffd54f]);
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
      showToast(this, bar.x + 90, bar.y - 10, tickets.length > 1 ? 'Orders placed!' : 'Order placed!');
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
      showToast(this, bar.x + 90, bar.y - 10, message);
    }
    this.refreshUi();
  }

  onOrderReady(order) {
    showToast(this, this.bar.x + 90, this.bar.y - 10, `${order.item.name} ready!`, '#c8e6c9');
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
        sparkle(this, table.x, table.y - 60);
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

  handleTap(pointer) {
    if (!this.isPlaying) return;

    const x = pointer.worldX;
    const y = pointer.worldY;

    const customer = this.queue.find(c => c.isWaiting && c.containsPoint(x, y));
    if (customer) {
      this.selectCustomer(customer);
      return;
    }

    if (this.bar.containsPoint(x, y)) {
      const spot = this.bar.serviceSpot;
      this.waitress.walkTo(spot.x, spot.y, () => this.onBarArrival());
      return;
    }

    const table = this.tables.find(t => t.containsPoint(x, y));
    if (table) {
      this.handleTableTap(table);
      return;
    }

    const { minX, maxX, minY, maxY } = LAYOUT.walkArea;
    this.waitress.walkTo(Phaser.Math.Clamp(x, minX, maxX), Phaser.Math.Clamp(y, minY, maxY));
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
    this.waitress.walkTo(table.serviceSpot.x, table.serviceSpot.y, () => this.onTableArrival(table));
  }

  /** Decide what the waitress does at a table, based on its state right now. */
  onTableArrival(table) {
    if (!this.isPlaying) return;

    const say = message => showToast(this, table.x, table.y - 100, message);
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
