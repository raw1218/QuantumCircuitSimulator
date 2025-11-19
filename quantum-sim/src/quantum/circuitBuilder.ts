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
  type GateCell,
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
            const data = node.data as { kind?: GateKind, hasPartner?: boolean, partnerRow?: number} | undefined;
            const kind = data?.kind;
            if (!kind) continue;

            const { row, col } = gridFromNode(node);
            if (row < 0 || row >= nQubits || col < 0 || col >= totalCols) continue;

            circuit = setCell(circuit, row, col, { kind: kind, row: row, col: col, hasTarget: data?.hasPartner, targetRow: data?.partnerRow });
        }

        return circuit;
    }




// Pretty-print a single gate cell
function formatGateCell(cell: GateCell): string {
    if (!cell) return '·'; // empty cell placeholder

    const { kind, hasTarget, targetRow } = cell;

    // Normal 1-qubit gates → just show the kind
    if (kind !== 'CNOT') {
        return kind;
    }

    // CNOT formatting
    if (hasTarget && typeof targetRow === 'number') {
        return `C(control → ${targetRow})`;
    } else {
        // Lonely control dot (the visual endpoint without target)
        return 'C(?)';
    }
}


export function printCircuit(circuit: Circuit): void {
    const { nQubits, nCols, grid } = circuit;

    console.log("=== Gate List (raw nodes) ===");

    for (let row = 0; row < nQubits; row++) {
        for (let col = 0; col < nCols; col++) {
            const cell = grid[row][col];
            if (!cell) continue;

            console.log(
                `Gate @ (row=${row}, col=${col}): { ` +
                `kind: ${cell.kind}, ` +
                `hasTarget: ${cell.hasTarget ?? false}, ` +
                `targetRow: ${cell.targetRow ?? 'null'} ` +
                `}`
            );
        }
    }

    console.log("\n=== Circuit Grid ===");

    let lines: string[] = [];

    for (let row = 0; row < nQubits; row++) {
        let line = `q${row} |`;

        for (let col = 0; col < nCols; col++) {
            const cell = grid[row][col];
            const cellStr = formatGateCell(cell);
            line += ` ${cellStr.padEnd(10, ' ')} `;
        }

        lines.push(line);
    }

    console.log(lines.join("\n"));
}

