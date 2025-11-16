// src/quantum/layout.ts

export const ROW_HEIGHT = 140; 
export const Y_OFFSET = 0;    
export const X_LABEL = 40;
export const X_WIRE = 120;
export const COL_WIDTH = 120; // distance between "time steps"
export const MAX_COLS = 6;
export const GATE_Y_OFFSET = 20;



export function rowY(row: number): number {
    return Y_OFFSET + row * ROW_HEIGHT;
}
export const colX = (col: number) => X_WIRE + col * COL_WIDTH;



// Snap a point in *flow coordinates* (flowX, flowY) to the nearest
// grid cell, clamping row to [0, nQubits-1] and col to [0, MAX_COLS-1].
export function snapToGrid(
    flowX: number,
    flowY: number,
    nQubits: number,
): { row: number; col: number; xSnapped: number; ySnapped: number } {
    // Approximate row/col based on your geometry
    const approxRow = Math.round((flowY - Y_OFFSET) / ROW_HEIGHT);
    const approxCol = Math.round((flowX - X_WIRE) / COL_WIDTH);

    const row = Math.max(0, Math.min(nQubits - 1, approxRow));
    const col = Math.max(0, Math.min(MAX_COLS - 1, approxCol));

    const xSnapped = colX(col);
    const ySnapped = rowY(row);

    return { row, col, xSnapped, ySnapped };
}