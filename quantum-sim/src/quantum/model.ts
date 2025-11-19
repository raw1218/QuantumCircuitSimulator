// src/quantum/model.ts

export type GateKind = 'H' | 'X' | 'Y' | 'Z' | 'MEASURE' | 'CNOT';


// One cell in the circuit grid
export type GateCell = {
  kind: GateKind;
  row: number;
  col: number;
  
  //for multi gates like CNOT 
  hasTarget?: boolean;
  targetRow?: number;

} | null;

// Core circuit type: 2D grid
export type Circuit = {
  nQubits: number;
  nCols: number;
  grid: GateCell[][]; // grid[row][col]
};

export function createEmptyCircuit(nQubits: number, nCols: number): Circuit {
  return {
    nQubits,
    nCols,
    grid: Array.from({ length: nQubits }, () =>
      Array.from({ length: nCols }, () => null),
    ),
  };
}

export function getCell(
  circuit: Circuit,
  row: number,
  col: number,
): GateCell {
  const { nQubits, nCols, grid } = circuit;
  if (row < 0 || row >= nQubits || col < 0 || col >= nCols) return null;
  return grid[row][col];
}

export function setCell(
  circuit: Circuit,
  row: number,
  col: number,
  cell: GateCell,
): Circuit {
  const { nQubits, nCols } = circuit;
  if (row < 0 || row >= nQubits || col < 0 || col >= nCols) return circuit;

  const newGrid = circuit.grid.map((rowArr, r) =>
    rowArr.map((c, cIdx) => (r === row && cIdx === col ? cell : c)),
  );

  return { nQubits, nCols, grid: newGrid };
}

