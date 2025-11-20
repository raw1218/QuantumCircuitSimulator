// src/globalStateVisualizer.tsx
import React from 'react';
import { useCircuitContext } from './circuitCanvas';
import { MAX_COLS, COL_WIDTH, X_WIRE } from './layout';
import type { GlobalStateVector } from './backend/simulation';

type BasisEntry = {
    label: string;
    real: number;
    imaginary: number;
    probability: number;
};

type GlobalStateVisualizerProps = {
    // one global state (amplitude vector) per column of the circuit
    statesPerColumn: GlobalStateVector[] | null;
    title?: string;
};

type GlobalStateColumnProps = {
    col: number;
    title: string;
    entries?: BasisEntry[];
};

// assumes:
// type BasisEntry = { label: string; real: number; imaginary: number; probability: number };
// type GlobalStateColumnProps = { col: number; title: string; entries?: BasisEntry[] };

export const GlobalStateColumn: React.FC<GlobalStateColumnProps> = ({
    col,
    title,
    entries,
}) => {
    const safeEntries = entries ?? [];

    // build labels + raw probs from entries
    const labels = safeEntries.map((e) => e.label);
    const rawProbs = safeEntries.map((e) =>
        Number.isFinite(e.probability) ? Math.max(0, e.probability) : 0,
    );

    // normalize like the old `normalized` array
    const total = rawProbs.reduce((s, p) => s + p, 0);
    const norm = total > 0 ? total : 1;
    const normalized = rawProbs.map((p) => p / norm);

    return (
        <div
            style={{
                background: 'rgba(15, 23, 42, 0.95)',
                borderRadius: 8,
                border: '1px solid rgba(148, 163, 184, 0.4)',
                padding: '6px 6px',
                color: '#e5e7eb',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 10,
                minWidth: COL_WIDTH - 4,
                maxWidth: COL_WIDTH - 4,
                opacity: 1,
                transform: 'scale(1.0)',
                transition: 'opacity 0.12s linear, transform 0.12s linear',
                boxSizing: 'border-box',
            }}
        >
            {/* Header: title + col index */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 4,
                }}
            >
                <span
                    style={{
                        fontSize: 9,
                        opacity: 0.85,
                    }}
                >
                    {title}
                </span>
                <span
                    style={{
                        fontSize: 9,
                        opacity: 0.75,
                        fontFamily: 'monospace',
                    }}
                >
                    c{col}
                </span>
            </div>

            {/* Probability bars (same look as original) */}
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                }}
            >
                {normalized.map((p, idx) => (
                    <div
                        key={idx}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                        }}
                    >
                        <span
                            style={{
                                width: 34,
                                fontFamily: 'monospace',
                                fontSize: 9,
                            }}
                        >
                            {labels[idx]}
                        </span>

                        <div
                            style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 999,
                                background: 'rgba(30, 64, 175, 0.3)',
                                overflow: 'hidden',
                            }}
                        >
                            <div
                                style={{
                                    width: `${(p * 100).toFixed(1)}%`,
                                    height: '100%',
                                    borderRadius: 999,
                                    background:
                                        p > 0
                                            ? 'linear-gradient(90deg, #38bdf8, #a855f7)'
                                            : 'transparent',
                                    transition: 'width 0.15s linear',
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
/**
 * Reverse the lowest nQubits bits of index.
 * For n=3: 0b011 (3) -> 0b110 (6), etc.
 */
export function reverseBits(index: number, nQubits: number): number {
    let result = 0;
    for (let q = 0; q < nQubits; q++) {
        const bit = (index >> q) & 1;
        if (bit) {
            const destPos = nQubits - 1 - q;
            result |= 1 << destPos;
        }
    }
    return result;
}

/**
 * Convert a GlobalStateVector into per-basis entries with
 * label, real, imaginary, and normalized probability.
 */
function buildEntriesFromState(
    state: GlobalStateVector,
    nQubits: number,
): BasisEntry[] {
    const dim = 1 << nQubits;
    const amps = state.amplitudes;

    const entries: BasisEntry[] = [];
    let sumProb = 0;

    for (let i = 0; i < dim; i++) {
        // 🔁 Map the display index i (binary label) to the simulator index j
        const j = reverseBits(i, nQubits);

        const amp = amps[j] ?? { real: 0, imaginary: 0 };
        const real = amp.real;
        const imaginary = amp.imaginary;
        const rawProb = real * real + imaginary * imaginary;
        const probability = Number.isFinite(rawProb) ? Math.max(0, rawProb) : 0;
        sumProb += probability;

        // Keep the original binary-counting label
        const label = `|${i.toString(2).padStart(nQubits, '0')}⟩`;

        entries.push({
            label,
            real,
            imaginary,
            probability,
        });
    }

    const norm = sumProb > 0 ? sumProb : 1;
    return entries.map((e) => ({
        ...e,
        probability: e.probability / norm,
    }));
}

/**
 * Whole row of entries; uses context and renders columns.
 * Shows all columns up to currentCol (matching the sweep animation).
 */
export const GlobalStateVisualizer: React.FC<GlobalStateVisualizerProps> = ({
    statesPerColumn,
    title = 'Global state',
}) => {
    const { nQubits, currentCol, runMaxCols } = useCircuitContext();

    if (nQubits <= 0) return null;
    if (currentCol == null) return null;
    if (!statesPerColumn || statesPerColumn.length === 0) return null;

    const numCols =
        (typeof runMaxCols === 'number' && runMaxCols > 0
            ? runMaxCols
            : MAX_COLS) || 1;

    const colIndices = Array.from({ length: numCols }, (_, i) => i);

    return (
        <div
            style={{
                width: '100%',
                overflowX: 'auto',
            }}
        >
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${numCols}, ${COL_WIDTH}px)`,
                    columnGap: 4,
                    marginLeft: X_WIRE, // line up with column 0 x-position
                    paddingTop: 4,
                    paddingBottom: 4,
                }}
            >
                {colIndices.map((col) => {
                    const isActive = currentCol >= col;
                    if (!isActive) {
                        // placeholder to keep grid alignment
                        return <div key={col} />;
                    }

                    const state = statesPerColumn[col];
                    if (!state) {
                        return (
                            <GlobalStateColumn
                                key={col}
                                col={col}
                                title={title}
                                entries={[]}
                            />
                        );
                    }

                    const entries = buildEntriesFromState(state, nQubits);

                    return (
                        <GlobalStateColumn
                            key={col}
                            col={col}
                            title={title}
                            entries={entries}
                        />
                    );
                })}
            </div>
        </div>
    );
};
