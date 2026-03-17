export const BOARD_SIZE = 6;

export type VehicleOrientation = 'horizontal' | 'vertical';

export interface LevelVehicleInput {
  color: string;
  x: number;
  y: number;
  length: number;
  orientation: VehicleOrientation;
}

export interface LevelInput {
  id?: string;
  title: string;
  difficulty?: string;
  par?: number;
  vehicles: LevelVehicleInput[];
}

export interface Vehicle {
  color: string;
  x: number;
  y: number;
  length: 2 | 3;
  orientation: VehicleOrientation;
}

export interface Level {
  id: string;
  title: string;
  difficulty: string;
  par?: number;
  optimalMoves: number;
  vehicles: Vehicle[];
}

export interface GameState {
  vehicles: Vehicle[];
  moves: number;
  won: boolean;
}

export interface MoveRange {
  min: number;
  max: number;
}

export interface SerializedState {
  positions: string;
}
