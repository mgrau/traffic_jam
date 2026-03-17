import { BOARD_SIZE, type GameState, type Level, type MoveRange, type Vehicle } from './types';

export function cloneVehicles(vehicles: Vehicle[]): Vehicle[] {
  return vehicles.map((vehicle) => ({ ...vehicle }));
}

export function createInitialState(level: Level): GameState {
  const vehicles = cloneVehicles(level.vehicles);
  return {
    vehicles,
    moves: 0,
    won: isWinningState(vehicles)
  };
}

export function getVehicleAtIndex(vehicles: Vehicle[], index: number): Vehicle {
  const vehicle = vehicles[index];

  if (!vehicle) {
    throw new Error(`Vehicle ${index + 1} not found`);
  }

  return vehicle;
}

export function isWinningState(vehicles: Vehicle[]): boolean {
  const target = vehicles[0];

  if (!target) {
    throw new Error('Missing target vehicle');
  }

  return target.orientation === 'horizontal' && target.x + target.length === BOARD_SIZE;
}

export function buildOccupancyMap(vehicles: Vehicle[], ignoredIndex?: number): Map<string, number> {
  const occupancy = new Map<string, number>();

  for (const [index, vehicle] of vehicles.entries()) {
    if (index === ignoredIndex) {
      continue;
    }

    for (let offset = 0; offset < vehicle.length; offset += 1) {
      const x = vehicle.orientation === 'horizontal' ? vehicle.x + offset : vehicle.x;
      const y = vehicle.orientation === 'vertical' ? vehicle.y + offset : vehicle.y;
      occupancy.set(`${x},${y}`, index);
    }
  }

  return occupancy;
}

export function getMoveRange(vehicles: Vehicle[], index: number): MoveRange {
  const vehicle = getVehicleAtIndex(vehicles, index);
  const occupancy = buildOccupancyMap(vehicles, index);

  if (vehicle.orientation === 'horizontal') {
    let min = vehicle.x;
    let max = vehicle.x;

    while (min > 0 && !occupancy.has(`${min - 1},${vehicle.y}`)) {
      min -= 1;
    }

    while (
      max + vehicle.length < BOARD_SIZE &&
      !occupancy.has(`${max + vehicle.length},${vehicle.y}`)
    ) {
      max += 1;
    }

    return { min, max };
  }

  let min = vehicle.y;
  let max = vehicle.y;

  while (min > 0 && !occupancy.has(`${vehicle.x},${min - 1}`)) {
    min -= 1;
  }

  while (
    max + vehicle.length < BOARD_SIZE &&
    !occupancy.has(`${vehicle.x},${max + vehicle.length}`)
  ) {
    max += 1;
  }

  return { min, max };
}

export function moveVehicle(vehicles: Vehicle[], index: number, coordinate: number): Vehicle[] {
  const range = getMoveRange(vehicles, index);
  const nextCoordinate = Math.max(range.min, Math.min(range.max, coordinate));

  return vehicles.map((vehicle, currentIndex) => {
    if (currentIndex !== index) {
      return { ...vehicle };
    }

    if (vehicle.orientation === 'horizontal') {
      return { ...vehicle, x: nextCoordinate };
    }

    return { ...vehicle, y: nextCoordinate };
  });
}

export function validateVehicles(vehicles: Vehicle[]): void {
  const occupied = new Set<string>();

  if (vehicles.length === 0) {
    throw new Error('Expected at least one vehicle');
  }

  for (const [index, vehicle] of vehicles.entries()) {
    if (vehicle.length !== 2 && vehicle.length !== 3) {
      throw new Error(`Vehicle ${index + 1} has invalid length ${vehicle.length}`);
    }

    if (index === 0) {
      if (vehicle.orientation !== 'horizontal') {
        throw new Error('The first vehicle must be horizontal');
      }

      if (vehicle.length !== 2) {
        throw new Error('The first vehicle must be length 2');
      }

      if (vehicle.y !== 2) {
        throw new Error('The first vehicle must start on row 3');
      }
    }

    for (let offset = 0; offset < vehicle.length; offset += 1) {
      const x = vehicle.orientation === 'horizontal' ? vehicle.x + offset : vehicle.x;
      const y = vehicle.orientation === 'vertical' ? vehicle.y + offset : vehicle.y;

      if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) {
        throw new Error(`Vehicle ${index + 1} is out of bounds`);
      }

      const key = `${x},${y}`;

      if (occupied.has(key)) {
        throw new Error(`Vehicle ${index + 1} overlaps another vehicle at ${key}`);
      }

      occupied.add(key);
    }
  }
}
