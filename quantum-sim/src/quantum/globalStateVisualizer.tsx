// GlobalStateVisualizer.tsx
import React from 'react';
import { useCircuitContext } from './circuitCanvas';
import { MAX_COLS, COL_WIDTH, X_WIRE } from './layout';

type GlobalStateVisualizerProps = {
    probs: number[];
    title?: string;
};

type GlobalStateColumnProps = {
    col: number;
    title: string;
    labels: string[];
    normalized: number[];
};

/**
 * Single column / entry for one circuit column's global state.
 */
export const GlobalStateColumn: React.FC<GlobalStateColumnProps> = ({
    col,
    title,
    labels,
    normalized,
}) => {
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

            {/* Probability bars */}
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
 * Whole row of entries; uses context and renders columns.
 */
export const GlobalStateVisualizer: React.FC<GlobalStateVisualizerProps> = ({
    probs,
    title = 'Global state',
}) => {
    const { nQubits, currentCol, runMaxCols } = useCircuitContext();
    console.log('GlobalStateVisualizer render. currentCol = ', currentCol);

    // No qubits, no table
    if (nQubits <= 0) return null;

    // 🔥 If we're not running, hide the whole global-state band
    if (currentCol == null) return null;

    const dim = 1 << nQubits; // 2^nQubits

    // Clamp probs to correct dimension
    const clamped = probs.slice(0, dim);
    while (clamped.length < dim) {
        clamped.push(0);
    }

    // Normalize so we don't care if backend is slightly off
    const sum = clamped.reduce(
        (s, p) => s + (Number.isFinite(p) ? Math.max(0, p) : 0),
        0,
    );
    const norm = sum > 0 ? sum : 1;
    const normalized = clamped.map((p) =>
        Number.isFinite(p) ? Math.max(0, p) / norm : 0,
    );

    const labels = Array.from({ length: dim }, (_, i) =>
        `|${i.toString(2).padStart(nQubits, '0')}⟩`,
    );

    // How many columns exist in the circuit?
    const numCols =
        (typeof runMaxCols === 'number' && runMaxCols > 0
            ? runMaxCols
            : MAX_COLS) || 1;

    const colIndices = Array.from({ length: numCols }, (_, i) => i);
    console.log('numCols = ', numCols, { currentCol, colIndices });

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
                    console.log('currentCol', { currentCol, col, isActive });

                    // Only render the active column; others are completely empty placeholders
                    if (!isActive) {
                        return <div key={col} />;
                    }

                    return (
                        <GlobalStateColumn
                            key={col}
                            col={col}
                            title={title}
                            labels={labels}
                            normalized={normalized}
                        />
                    );
                })}
            </div>
        </div>
    );
};
