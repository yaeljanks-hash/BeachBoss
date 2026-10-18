// Difficulty settings for each level (one level = one shift). Rebalance here;
// gameplay code only reads from this list. See "Level balance" in README.md for
// how these numbers were chosen and validated.
//
// Fields:
//   id, name, description   shown on the level intro card
//   shiftDurationMs         length of the shift
//   revenueTarget           coins needed by the end of the shift to pass
//   initialCustomers        guests in the opening wave
//   arrivalIntervalMs       {min, max} gap between later arrivals (random within range)
//   maxQueue                how many guests can wait in line (1 to 3)
//   patience.waitingMs      time a guest will wait in line before leaving
//   patience.seatedMs       time a seated guest will wait to order + be served
//                           (reading the menu and eating don't count)

export const LEVELS = [
  {
    id: 1,
    name: 'Easy Introduction',
    description: 'A quiet morning on the beach. Take your time and learn the ropes.',
    shiftDurationMs: 150000,
    revenueTarget: 80,
    initialCustomers: 2,
    arrivalIntervalMs: { min: 10000, max: 14000 },
    maxQueue: 2,
    patience: { waitingMs: 60000, seatedMs: 75000 }
  },
  {
    id: 2,
    name: 'Getting Busy',
    description: 'Word is spreading. Guests arrive a little more often.',
    shiftDurationMs: 150000,
    revenueTarget: 90,
    initialCustomers: 3,
    arrivalIntervalMs: { min: 8500, max: 12000 },
    maxQueue: 3,
    patience: { waitingMs: 50000, seatedMs: 62000 }
  },
  {
    id: 3,
    name: 'Lunch Rush',
    description: 'Hungry beachgoers everywhere. Keep every table moving.',
    shiftDurationMs: 165000,
    revenueTarget: 130,
    initialCustomers: 3,
    arrivalIntervalMs: { min: 7000, max: 9500 },
    maxQueue: 3,
    patience: { waitingMs: 42000, seatedMs: 52000 }
  },
  {
    id: 4,
    name: 'Beach Rush',
    description: 'The beach is packed. Take orders in batches to keep up.',
    shiftDurationMs: 180000,
    revenueTarget: 180,
    initialCustomers: 3,
    arrivalIntervalMs: { min: 6000, max: 8500 },
    maxQueue: 3,
    patience: { waitingMs: 36000, seatedMs: 45000 }
  },
  {
    id: 5,
    name: 'Peak Hour',
    description: 'The busiest hour of the summer. Only a true Beach Boss can keep up!',
    shiftDurationMs: 180000,
    revenueTarget: 195,
    initialCustomers: 3,
    arrivalIntervalMs: { min: 5000, max: 7500 },
    maxQueue: 3,
    patience: { waitingMs: 30000, seatedMs: 38000 }
  }
];

/**
 * Check the level list for values that would break gameplay. Returns a list of
 * problems; empty means OK.
 */
export function validateLevels(levels = LEVELS, maxQueueSpots = 3) {
  const problems = [];
  const positive = ['shiftDurationMs', 'revenueTarget', 'initialCustomers'];

  levels.forEach((level, i) => {
    const label = `level ${level.id ?? i + 1}`;
    positive.forEach(key => {
      if (!(level[key] > 0)) problems.push(`${label}: ${key} must be a positive number`);
    });
    const { min, max } = level.arrivalIntervalMs ?? {};
    if (!(min > 0 && max >= min)) problems.push(`${label}: arrivalIntervalMs needs 0 < min <= max`);
    if (!(level.maxQueue >= 1 && level.maxQueue <= maxQueueSpots))
      problems.push(`${label}: maxQueue must be between 1 and ${maxQueueSpots}`);
    if (!(level.patience?.waitingMs > 0 && level.patience?.seatedMs > 0))
      problems.push(`${label}: patience.waitingMs and patience.seatedMs must be positive`);
  });

  if (levels.length === 0) problems.push('no levels defined');
  return problems;
}
