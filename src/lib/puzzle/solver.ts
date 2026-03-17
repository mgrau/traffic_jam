import { getMoveRange, isWinningState, moveVehicle } from './game';
import type { Vehicle } from './types';

function serializeVehicles(vehicles: Vehicle[]): string {
  return vehicles.map((vehicle) => `${vehicle.x},${vehicle.y}`).join('|');
}

export function solveMinimumMoves(vehicles: Vehicle[]): number {
  const queue: Array<{ vehicles: Vehicle[]; moves: number }> = [{ vehicles, moves: 0 }];
  const visited = new Set<string>([serializeVehicles(vehicles)]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (isWinningState(current.vehicles)) {
      return current.moves;
    }

    for (const [index, vehicle] of current.vehicles.entries()) {
      const range = getMoveRange(current.vehicles, index);
      const start = vehicle.orientation === 'horizontal' ? vehicle.x : vehicle.y;

      for (let coordinate = range.min; coordinate <= range.max; coordinate += 1) {
        if (coordinate === start) {
          continue;
        }

        const nextVehicles = moveVehicle(current.vehicles, index, coordinate);
        const key = serializeVehicles(nextVehicles);

        if (visited.has(key)) {
          continue;
        }

        visited.add(key);
        queue.push({ vehicles: nextVehicles, moves: current.moves + 1 });
      }
    }
  }

  throw new Error('Level is unsolvable');
}
