import StateMachine from '../systems/StateMachine.js';

export const OrderState = {
  TAKEN: 'taken', // the waitress holds the ticket
  PREPARING: 'preparing', // the bar is making it
  READY_FOR_PICKUP: 'readyForPickup',
  CARRIED: 'carried', // on the waitress's tray
  DELIVERED: 'delivered', // the guest is eating / drinking
  PAID: 'paid',
  CANCELLED: 'cancelled' // the guest ran out of patience before it arrived
};

const TRANSITIONS = {
  [OrderState.TAKEN]: [OrderState.PREPARING, OrderState.CANCELLED],
  [OrderState.PREPARING]: [OrderState.READY_FOR_PICKUP, OrderState.CANCELLED],
  [OrderState.READY_FOR_PICKUP]: [OrderState.CARRIED, OrderState.CANCELLED],
  [OrderState.CARRIED]: [OrderState.DELIVERED, OrderState.CANCELLED],
  [OrderState.DELIVERED]: [OrderState.PAID],
  [OrderState.PAID]: [],
  [OrderState.CANCELLED]: []
};

let nextOrderId = 1;

/** One guest's order: which menu item, for which table, and how far along it is. */
export default class Order {
  constructor(item, table, customer) {
    this.id = nextOrderId++;
    this.item = item;
    this.table = table;
    this.customer = customer;
    this.fsm = new StateMachine(`Order ${this.id}`, OrderState.TAKEN, TRANSITIONS);
  }
}
