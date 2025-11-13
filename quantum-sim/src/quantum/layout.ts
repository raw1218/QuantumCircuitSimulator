// src/quantum/layout.ts

export const N_QUBITS = 3;

export const ROW_HEIGHT = 80;
export const Y_OFFSET = 120;
export const X_LABEL = 40;
export const X_WIRE = 120;
export const COL_WIDTH = 120; // distance between "time steps"
export const MAX_COLS = 6;
export const GATE_Y_OFFSET = 20;

export const rowY = (row: number) => Y_OFFSET + row * ROW_HEIGHT;
export const colX = (col: number) => X_WIRE + col * COL_WIDTH;

const clamp = (v: number, min: number, max: number) =>
    v < min ? min : v > max ? max : v;

export function snapToRow(y: number): { row: number; ySnapped: number } {
    let bestRow = 0;
    let bestDist = Infinity;

    for (let r = 0; r < N_QUBITS; r++) {
        const targetY = rowY(r);
        const dist = Math.abs(y - targetY);
        if (dist < bestDist) {
            bestDist = dist;
            bestRow = r;
        }
    }

    return { row: bestRow, ySnapped: rowY(bestRow) };
}

export function snapToCol(x: number): { col: number; xSnapped: number } {
    const rawCol = Math.round((x - X_WIRE) / COL_WIDTH);
    const col = clamp(rawCol, 0, MAX_COLS);
    return { col, xSnapped: colX(col) };
}
