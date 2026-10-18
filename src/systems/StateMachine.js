/**
 * Minimal finite state machine.
 *
 * `transitions` maps each state to the states it may move to. Any other move is
 * rejected (and logged), which keeps late timers or double taps from pushing an
 * object into an inconsistent state.
 */
export default class StateMachine {
  constructor(name, initial, transitions) {
    this.name = name;
    this.current = initial;
    this.transitions = transitions;
  }

  get state() {
    return this.current;
  }

  is(...states) {
    return states.includes(this.current);
  }

  can(next) {
    return (this.transitions[this.current] ?? []).includes(next);
  }

  /** Move to `next` if allowed. Returns true on success. */
  transition(next) {
    if (!this.can(next)) {
      console.warn(`[${this.name}] ignored invalid transition ${this.current} -> ${next}`);
      return false;
    }
    this.current = next;
    return true;
  }
}
