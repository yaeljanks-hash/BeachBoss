import Phaser from 'phaser';
import { GAME_WIDTH, LAYOUT, CUSTOMERS, DEPTH } from '../config.js';
import Waitress from '../objects/Waitress.js';
import Customer, { CustomerState } from '../objects/Customer.js';
import Table from '../objects/Table.js';

export default class BeachScene extends Phaser.Scene {
  constructor() {
    super('BeachScene');
  }

  create() {
    this.drawBackground();

    this.tables = LAYOUT.tableXs.map((x, i) => new Table(this, x, LAYOUT.tableFloorY, i + 1));
    this.waitress = new Waitress(this, LAYOUT.waitressStart.x, LAYOUT.waitressStart.y);

    this.customers = [];
    this.queue = []; // customers in line, front first
    this.selectedCustomer = null;

    this.createHud();
    this.scheduleArrivals();

    this.input.on('pointerdown', this.handleTap, this);
  }

  update() {
    // Characters further down the screen are drawn in front
    this.waitress.setDepth(this.waitress.y);
    this.customers.forEach(customer => customer.setDepth(customer.y));
  }

  // ---------------------------------------------------------------------------
  // Scene setup
  // ---------------------------------------------------------------------------

  drawBackground() {
    this.cameras.main.setBackgroundColor('#87CEEB');

    // Sun
    this.add.circle(860, 70, 34, 0xfff176);

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

    // Beach bar
    this.add.rectangle(130, 350, 180, 130, 0xa66b43);
    this.add.text(130, 350, 'BEACH BAR', { fontSize: '20px', color: '#ffffff' }).setOrigin(0.5);

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

  createHud() {
    this.hudText = this.add
      .text(GAME_WIDTH / 2, 92, '', { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(1, 1, '#1b4f72', 2)
      .setDepth(DEPTH.hud);
    this.updateHud();
  }

  updateHud() {
    const waiting = this.queue.filter(c => c.isWaiting).length;
    const seated = this.tables.filter(t => t.isOccupied).length;

    const hint = waiting > 0 ? 'Tap an empty table to seat a guest' : 'Tap the sand to move';
    this.hudText.setText(`${hint}   ·   Waiting: ${waiting}   Seated: ${seated}/${this.tables.length}`);

    this.tables.forEach(table => table.setHint(waiting > 0 && !table.isOccupied));
  }

  // ---------------------------------------------------------------------------
  // Customers
  // ---------------------------------------------------------------------------

  scheduleArrivals() {
    for (let i = 0; i < CUSTOMERS.count; i++) {
      this.time.delayedCall(CUSTOMERS.firstArrivalMs + i * CUSTOMERS.arrivalIntervalMs, () =>
        this.spawnCustomer()
      );
    }
  }

  spawnCustomer() {
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
        customer.state = CustomerState.WAITING;
        customer.faceRight();
        this.updateHud();
      });
    });
  }

  selectCustomer(customer) {
    this.selectedCustomer?.setSelected(false);
    this.selectedCustomer = customer === this.selectedCustomer ? null : customer;
    this.selectedCustomer?.setSelected(true);
  }

  seatCustomer(customer, table) {
    this.queue = this.queue.filter(c => c !== customer);
    if (this.selectedCustomer === customer) this.selectCustomer(customer); // clears selection

    table.reserve(customer);
    customer.state = CustomerState.WALKING_TO_TABLE;
    customer.walkTo(table.seatSpot.x, table.seatSpot.y, () => {
      customer.sit();
      table.showIndicator();
      this.updateHud();
    });

    this.waitress.walkTo(table.serviceSpot.x, table.serviceSpot.y);
    this.moveQueueForward();
    this.updateHud();
  }

  // ---------------------------------------------------------------------------
  // Input
  // ---------------------------------------------------------------------------

  handleTap(pointer) {
    const x = pointer.worldX;
    const y = pointer.worldY;

    const customer = this.queue.find(c => c.isWaiting && c.containsPoint(x, y));
    if (customer) {
      this.selectCustomer(customer);
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
    if (table.isOccupied) {
      this.waitress.walkTo(table.serviceSpot.x, table.serviceSpot.y);
      return;
    }

    // Seat the selected guest, or whoever is at the front of the line
    const guest = this.selectedCustomer ?? this.queue.find(c => c.isWaiting);
    if (guest) {
      this.seatCustomer(guest, table);
    } else {
      this.waitress.walkTo(table.serviceSpot.x, table.serviceSpot.y);
      this.showToast(table.x, table.y - 90, 'No guests waiting');
    }
  }

  /** Short floating message that drifts up and fades out. */
  showToast(x, y, message) {
    const text = this.add
      .text(x, y, message, { fontSize: '16px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setShadow(1, 1, '#000000', 3)
      .setDepth(DEPTH.hud);

    this.tweens.add({
      targets: text,
      y: y - 30,
      alpha: 0,
      duration: 1100,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }
}
