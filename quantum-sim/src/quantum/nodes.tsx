// src/quantum/nodes.tsx
import React from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GateKind } from './model';
import { useCircuitContext } from './circuitCanvas';
import { COL_WIDTH, MAX_COLS } from './layout';
import { QubitVisualization } from './qubitVisualization';

// ===== Qubit label node (green box) =====
export function QubitLabelNode(props: NodeProps) {
    const label = (props.data as { label?: string }).label ?? 'q?';
    return (
        <div
            style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '2px solid #00ff99',
                background: '#111',
                color: '#00ff99',
                fontSize: 16,
                fontFamily: 'monospace',
            }}
        >
            {label}
        </div>
    );
}

// ===== Wire node (horizontal line) =====

const TOTAL_WIRE_WIDTH = COL_WIDTH * MAX_COLS;

export function WireNode(_: NodeProps) {
    const { runProgress } = useCircuitContext();
    const progress = runProgress ?? 0;

    return (
        <div
            style={{
                position: 'relative',
                width: `${TOTAL_WIRE_WIDTH}px`,
                height: 4,
            }}
        >
            {/* Full wire background (now white) */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    background: '#ffffff',
                    borderRadius: 999,
                }}
            />

            {/* Filled part showing run progress */}
            <div
                style={{
                    position: 'absolute',
                    inset: 0,
                    width: `${progress * 100}%`,
                    background: '#38bdf8',
                    borderRadius: 999,
                    // NOTE: no transition here, so reset snaps instantly
                    // transition: 'width 0.06s linear',
                }}
            />
        </div>
    );
}

// ===== Gate glyph (shared between canvas & palette) =====

type GateGlyphProps = {
    kind: GateKind | string;
    label?: string;
    selected?: boolean;
    isPreview?: boolean;
};

function gateStyleFor(kind: string | undefined) {
    switch (kind) {
        case 'H':
            return { bg: '#d0f0ff', border: '#3b82f6' };
        case 'X':
            return { bg: '#ffe4e6', border: '#ef4444' };
        case 'Y':
            return { bg: '#fef3c7', border: '#f59e0b' };
        case 'Z':
            return { bg: '#e5e7eb', border: '#4b5563' };
        case 'MEASURE':
            return { bg: '#dcfce7', border: '#16a34a' };
        case 'CNOT':
            return { bg: '#f5f3ff', border: '#8b5cf6' };
        default:
            return { bg: '#dddddd', border: '#ffffff' };
    }
}

export function GateGlyph({ kind, label, selected, isPreview }: GateGlyphProps) {
    const k = typeof kind === 'string' ? kind : '';
    const style = gateStyleFor(k);

    const borderWidth = selected && !isPreview ? 3 : 2;
    const boxShadow =
        selected && !isPreview ? '0 0 8px rgba(129, 230, 217, 0.9)' : 'none';

    const borderColor = isPreview ? '#22d3ee' : style.border;
    const bgColor = isPreview ? 'transparent' : style.bg;
    const borderStyle = isPreview ? 'dashed' : 'solid';
    const opacity = isPreview ? 0.7 : 1;

    // ❗ 40 → normal size, 60 wide for MEASURE
    const width = k === 'MEASURE' ? 70 : 40;
    const height = 40;

    // If MEASURE and no custom label, render "MEASURE"
    const text =
        k === 'MEASURE'
            ? (label ?? 'MEASURE')
            : (label ?? k ?? '');

    return (
        <div
            style={{
                width,
                height,
                borderRadius: 4,
                borderWidth,
                borderColor,
                borderStyle,
                background: bgColor,
                color: '#000',
                fontSize: 16, 
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow,
                opacity,
                whiteSpace: 'nowrap',
            }}
        >
            {text}
        </div>
    );
}


// ===== Gate node (used by ReactFlow) =====
type GateData = {
    label?: string;
    kind?: string;
    isPreview?: boolean;
    col?: number;            // 0-based column index
    row?: number;            // optional, for later
    measureOutcome?: 0 | 1;  // for later
};

export function GateNode(props: NodeProps) {
    const data = props.data as GateData;
    const kind = data.kind ?? '';
    const isPreview = !!data.isPreview;

    const { runProgress } = useCircuitContext();

    // text inside gate
    const innerLabel = data.label ?? kind ?? '';

    const gateCol =
        typeof data.col === 'number' && Number.isFinite(data.col)
            ? data.col
            : null;

    let isActive = false;

    if (!isPreview && runProgress != null && gateCol !== null && MAX_COLS > 0) {
        // current highlighted column 0..MAX_COLS-1
        const scanCol = Math.min(
            MAX_COLS - 1,
            Math.floor(runProgress * MAX_COLS)
        );

        isActive = scanCol >= gateCol;
        // If you want visibility:
         console.log('Gate timing', { id: props.id, kind, gateCol, runProgress, scanCol, isActive });
    }

    return (
        <div
            style={{
                position: 'relative',
                display: 'inline-block',
            }}
        >
            {/* Overlay when highlight is on this column */}
            {isActive && kind !== 'MEASURE' && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translate(-50%, -8px)',
                        pointerEvents: 'none',
                    }}
                >
                    {/* For now, just use qubit 0; later use data.row to choose the right one */}
                    <QubitVisualization index={0} size={50} />
                </div>
            )}

            {isActive && kind === 'MEASURE' && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translate(-50%, -6px)',
                        padding: '2px 6px',
                        borderRadius: 999,
                        border: '1px solid rgba(248, 250, 252, 0.4)',
                        background: 'rgba(15,23,42,0.95)',
                        color: '#4ade80',
                        fontSize: 10,
                        textAlign: 'center',
                        pointerEvents: 'none',
                    }}
                >
                    0 {/* hard-coded for now */}
                </div>
            )}

            <GateGlyph
                kind={kind}
                label={innerLabel}
                selected={props.selected}
                isPreview={isPreview}
            />
        </div>
    );
}
// ===== Node type map for ReactFlow =====

export const nodeTypes = {
    qubitLabel: QubitLabelNode,
    wire: WireNode,
    gate: GateNode,
};
