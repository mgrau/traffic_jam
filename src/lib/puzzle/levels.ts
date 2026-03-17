import { parse } from 'yaml';
import { solveMinimumMoves } from './solver';
import { validateVehicles } from './game';
import type { Level, LevelInput, Vehicle } from './types';

const levelFiles = import.meta.glob('../../../levels/*.yaml', {
  eager: true,
  query: '?raw',
  import: 'default'
}) as Record<string, string>;

const namedVehicleColors: Record<string, string> = {
  red: '#d9485f',
  orange: '#f59e0b',
  'light orange': '#fdba74',
  'dark orange': '#ea580c',
  yellow: '#facc15',
  'dark yellow': '#ca8a04',
  green: '#84cc16',
  'light green': '#86efac',
  'dark green': '#166534',
  'forest green': '#2f855a',
  'forrest green': '#2f855a',
  blue: '#3b82f6',
  'light blue': '#7dd3fc',
  'dark blue': '#1d4ed8',
  cyan: '#06b6d4',
  pink: '#f472b6',
  lavender: '#c4b5fd',
  purple: '#8b5cf6',
  silver: '#cbd5e1'
};

function normalizeColorName(color: string): string {
  return color.trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function resolveVehicleColor(color: string): string {
  const namedColor = namedVehicleColors[normalizeColorName(color)];
  return namedColor ?? color;
}

function normalizeVehicle(vehicle: LevelInput['vehicles'][number]): Vehicle {
  return {
    color: resolveVehicleColor(vehicle.color),
    x: vehicle.x,
    y: vehicle.y,
    length: vehicle.length as 2 | 3,
    orientation: vehicle.orientation
  };
}

function normalizeLevel(path: string, source: string): Level {
  const parsed = parse(source) as LevelInput;

  if (!parsed?.title || !Array.isArray(parsed.vehicles)) {
    throw new Error(`Invalid level file: ${path}`);
  }

  const id = parsed.id ?? path.split('/').pop()?.replace(/\.yaml$/, '') ?? 'level';
  const vehicles = parsed.vehicles.map(normalizeVehicle);
  validateVehicles(vehicles);

  const optimalMoves = solveMinimumMoves(vehicles.map((vehicle) => ({ ...vehicle })));

  return {
    id,
    title: parsed.title,
    difficulty: parsed.difficulty ?? '',
    par: parsed.par,
    optimalMoves,
    vehicles
  };
}

export const levelLoadErrors: string[] = [];

export const levels = Object.entries(levelFiles)
  .flatMap(([path, source]) => {
    try {
      return [normalizeLevel(path, source)];
    } catch (error) {
      levelLoadErrors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  })
  .sort((left, right) => left.id.localeCompare(right.id));
