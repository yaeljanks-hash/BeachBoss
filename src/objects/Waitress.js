import Character from './Character.js';
import { SPEED } from '../config.js';
import { drawNotepad } from '../ui/icons.js';

const COLORS = {
  skin: 0xf5c9a0,
  hair: 0x5a3020,
  dress: 0xff6f61,
  apron: 0xffffff,
  scrunchie: 0x26c6da,
  shoes: 0x3b2a20,
  tray: 0xb0bec5,
  eye: 0x222222,
  blush: 0xff9aa2,
  mouth: 0x7a3b2e
};

/**
 * The player character: an original cartoon waitress drawn with Phaser graphics.
 *
 * She can hold any number of order tickets but only one item on her tray. An
 * "activity" is something she does while standing still (like wiping a table);
 * walking anywhere cancels it.
 */
export default class Waitress extends Character {
  constructor(scene, x, y) {
    super(scene, x, y, SPEED.waitress);

    this.carrying = null; // Order on the tray
    this.tickets = []; // Orders taken but not yet handed to the bar
    this.activity = null; // { cancel() } while busy at a spot

    this.trayItem = scene.add.container(22, -41);
    this.figure.add([this.drawArt(scene), this.trayItem]);

    this.ticketBadge = this.createTicketBadge(scene);
    this.add(this.ticketBadge);
  }

  walkTo(x, y, onArrive) {
    this.cancelActivity();
    super.walkTo(x, y, onArrive);
  }

  // --- Carrying -------------------------------------------------------------

  get handsFree() {
    return this.carrying === null;
  }

  carry(order, icon) {
    this.carrying = order;
    this.trayItem.add(icon.setScale(0.75));
  }

  /** Hand over whatever is on the tray and return it. */
  dropCarried() {
    const order = this.carrying;
    this.carrying = null;
    this.trayItem.removeAll(true);
    return order;
  }

  // --- Tickets --------------------------------------------------------------

  addTicket(order) {
    this.tickets.push(order);
    this.refreshTicketBadge();
  }

  /** Throw away one ticket (its guest has left). */
  removeTicket(order) {
    this.tickets = this.tickets.filter(t => t !== order);
    this.refreshTicketBadge();
  }

  /** Hand all tickets to the bar. */
  takeTickets() {
    const tickets = this.tickets;
    this.tickets = [];
    this.refreshTicketBadge();
    return tickets;
  }

  refreshTicketBadge() {
    const count = this.tickets.length;
    this.ticketBadge.setVisible(count > 0);
    this.ticketCountText.setText(count > 1 ? `x${count}` : '');
  }

  createTicketBadge(scene) {
    const g = scene.add.graphics();
    drawNotepad(g);
    this.ticketCountText = scene.add
      .text(10, 2, '', { fontSize: '12px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0, 0.5)
      .setShadow(1, 1, '#000000', 2);
    return scene.add.container(0, -92, [g, this.ticketCountText]).setVisible(false);
  }

  // --- Activities -----------------------------------------------------------

  startActivity(cancel) {
    this.cancelActivity();
    this.activity = { cancel };
  }

  /** Mark the current activity as finished (no cancel callback). */
  finishActivity() {
    this.activity = null;
  }

  cancelActivity() {
    const activity = this.activity;
    this.activity = null;
    activity?.cancel();
  }

  drawArt(scene) {
    const g = scene.add.graphics();
    const c = COLORS;

    // Ponytail (drawn first so it sits behind the head)
    g.fillStyle(c.hair);
    g.fillEllipse(-15, -57, 10, 18);
    g.fillStyle(c.scrunchie);
    g.fillCircle(-11, -63, 3);

    // Legs and shoes
    g.fillStyle(c.skin);
    g.fillRect(-7, -18, 5, 16);
    g.fillRect(2, -18, 5, 16);
    g.fillStyle(c.shoes);
    g.fillEllipse(-3, -2, 9, 5);
    g.fillEllipse(6, -2, 9, 5);

    // Back arm
    g.fillStyle(0xe3b48c);
    g.fillRoundedRect(-8, -44, 6, 20, 3);

    // Dress
    g.fillStyle(c.dress);
    g.fillPoints(
      [
        { x: -9, y: -47 },
        { x: 9, y: -47 },
        { x: 15, y: -16 },
        { x: -15, y: -16 }
      ],
      true
    );

    // Apron with strings
    g.fillStyle(c.apron);
    g.fillRoundedRect(-3, -37, 14, 18, 3);
    g.lineStyle(1.5, c.apron);
    g.lineBetween(-3, -35, -9, -33);

    // Front arm holding a tray
    g.fillStyle(c.skin);
    g.fillRoundedRect(2, -44, 6, 12, 3);
    g.fillRoundedRect(4, -36, 16, 5, 2);
    g.fillStyle(c.tray);
    g.fillRoundedRect(12, -40, 20, 3, 1);

    // Neck and head
    g.fillStyle(c.skin);
    g.fillRect(-3, -51, 6, 5);
    g.fillCircle(0, -61, 12);

    // Hair cap and fringe
    g.fillStyle(c.hair);
    g.beginPath();
    g.arc(0, -61, 13, Math.PI, 0);
    g.fillPath();
    g.fillEllipse(-6, -62, 14, 14);

    // Face
    g.fillStyle(c.eye);
    g.fillCircle(6, -61, 1.8);
    g.fillStyle(c.blush, 0.7);
    g.fillCircle(7, -56, 2.5);
    g.lineStyle(1.5, c.mouth);
    g.beginPath();
    g.arc(5, -57, 3, 0.3, Math.PI - 0.6);
    g.strokePath();

    return g;
  }
}
