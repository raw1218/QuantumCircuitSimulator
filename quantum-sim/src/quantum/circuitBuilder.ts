// src/quantum/circuitBuilder.ts
import type { Node } from '@xyflow/react';
import {
  ROW_HEIGHT,
  Y_OFFSET,
  X_WIRE,
  COL_WIDTH,
  MAX_COLS,
  GATE_Y_OFFSET,
} from './layout';
import {
  type Circuit,
  type GateKind,
  createEmptyCircuit,
  setCell,
} from './model';

// Must match how gates are positioned/snapped in circuitCanvas
function gridFromNode(node: Node): { row: number; col: number } {
  const row = Math.round((node.position.y + GATE_Y_OFFSET - Y_OFFSET) / ROW_HEIGHT);
  const col = Math.round((node.position.x - X_WIRE) / COL_WIDTH);
  return { row, col };
}

export function buildCircuitFromNodes(
  nodes: Node[],
  nQubits: number,
  nCols?: number,
): Circuit {
  const gateNodes = nodes.filter((n) => n.type === 'gate');

  // infer cols if not provided
  let inferredCols = 0;
  for (const n of gateNodes) {
    const { col } = gridFromNode(n);
    if (col > inferredCols) inferredCols = col;
  }
  const totalCols = Math.max(1, Math.min((nCols ?? inferredCols + 1), MAX_COLS));

  let circuit = createEmptyCircuit(nQubits, totalCols);

  for (const node of gateNodes) {
    const data = node.data as { kind?: GateKind } | undefined;
    const kind = data?.kind;
    if (!kind) continue;

    const { row, col } = gridFromNode(node);
    if (row < 0 || row >= nQubits || col < 0 || col >= totalCols) continue;

    circuit = setCell(circuit, row, col, { kind });
  }

  return circuit;
}
