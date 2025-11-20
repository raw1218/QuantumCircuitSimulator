// src/quantum/nodes.tsx
import React , {type ReactElement} from 'react';
import type { NodeProps } from '@xyflow/react';
import type { GateKind } from './model';
import { useCircuitContext } from './circuitCanvas';
import { COL_WIDTH, MAX_COLS, ROW_HEIGHT } from './layout';
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

export function WireNode(props: NodeProps) {
    const { runProgress } = useCircuitContext();
    const progress = runProgress ?? 0;
    if (props.data.isPadding)
        return (
            <div
                style={{
                    width: `${TOTAL_WIRE_WIDTH}px`,
                    height: 4,
                }}
            />
        );
        
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
type GateGlyphProps = {
    kind: GateKind | string;
    label?: string;
    selected?: boolean;
    isPreview?: boolean;

    // partner info (optional)
    hasPartner?: boolean;
    row?: number;
    col?: number;
    partnerRow?: number;
    partnerCol?: number;
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

export function GateGlyph({
    kind,
    label,
    selected,
    isPreview,
    hasPartner,
    row,
    col,
    partnerRow,
    partnerCol,
}: GateGlyphProps) {
    const k = typeof kind === 'string' ? kind : '';
    const style = gateStyleFor(k);

    const borderWidth = selected && !isPreview ? 3 : 2;
    const boxShadow =
        selected && !isPreview ? '0 0 8px rgba(129, 230, 217, 0.9)' : 'none';

    const borderColor = isPreview ? '#22d3ee' : style.border;
    const bgColor = isPreview ? 'transparent' : style.bg;
    const borderStyle = isPreview ? 'dashed' : 'solid';
    const opacity = isPreview ? 0.7 : 1;

    const width = k === 'MEASURE' ? 70 : 40;
    const height = 40;

    const text =
        k === 'MEASURE'
            ? (label ?? 'MEASURE')
            : (label ?? k ?? '');

    // ─────────────────────────────────────────────
    // Partner connector (line + arrow) based on grid data
    // ─────────────────────────────────────────────
    const hasValidPartner =
        !!hasPartner &&
        typeof row === 'number' &&
        typeof col === 'number' &&
        typeof partnerRow === 'number' &&
        typeof partnerCol === 'number' &&
        (partnerRow !== row || partnerCol !== col);

    let connector: ReactElement | null = null;

    if (hasValidPartner) {
        const dx = (partnerCol! - col!) * COL_WIDTH;
        const dy = (partnerRow! - row!) * ROW_HEIGHT;

        const length = Math.sqrt(dx * dx + dy * dy);
        const angleDeg = Math.atan2(dy, dx) * (180 / Math.PI);

        const lineColor = isPreview ? '#22d3ee' : '#8b5cf6';

        // Outer rotated container (behind the gate box)
        const connectorStyle: React.CSSProperties = {
            position: 'absolute',
            left: width / 2,
            top: height / 2,
            width: length,
            height: 0,
            transformOrigin: '0 50%',
            transform: `rotate(${angleDeg}deg)`,
            pointerEvents: 'none',
            zIndex: 0,
        };

        const lineStyle: React.CSSProperties = {
            position: 'absolute',
            left: 0,
            top: -1,
            width: '100%',
            height: 2,
            background: lineColor,
            borderRadius: 999,
        };

        const arrowStyle: React.CSSProperties = {
            position: 'absolute',
            left: '50%',
            top: -5, // center vertically over the line
            width: 0,
            height: 0,
            borderRight: `7px solid ${lineColor}`,      // pointing "right" in local space
            borderTop: '4px solid transparent',
            borderBottom: '4px solid transparent',
        };

        connector = (
            <div style={connectorStyle}>
                <div style={lineStyle} />
                <div style={arrowStyle} />
            </div>
        );
    }

    return (
        <div
            style={{
                position: 'relative',
                width,
                height,
                // this wrapper has no background; the box is a child so the line can sit behind it
                overflow: 'visible',
            }}
        >
            {/* line + arrow BEHIND */}
            {connector}

            {/* foreground gate box */}
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    width: '100%',
                    height: '100%',
                    borderRadius: 4,
                    borderWidth,
                    borderColor,
                    borderStyle,
                    background: bgColor,
                    color: '#000',
                    fontSize: 16,
                    fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    boxShadow,
                    opacity,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {text}
            </div>
        </div>
    );
}

export type GateData = {
    label?: string;
    kind?: string;
    isPreview?: boolean;
    col?: number;            // 0-based column index
    row?: number;
    measureOutcome?: 0 | 1;
    hasPartner?: boolean;
    partnerRow?: number;
    partnerCol?: number;
};

export function GateNode(props: NodeProps) {
    const data = props.data as GateData;
    const kind = data.kind ?? '';
    const isPreview = !!data.isPreview;

    const innerLabel = data.label ?? kind ?? '';

    const { runProgress } = useCircuitContext();

    const gateCol =
        typeof data.col === 'number' && Number.isFinite(data.col)
            ? data.col
            : null;

    // Measurement bit pushed in from CircuitCanvas / backend
    const measurementBit = data.measureOutcome;
    console.log('GateNode measurementBit:', measurementBit);

    // By default, show the bubble only for MEASURE gates that actually have a result
    let showMeasurementBubble =
        kind === 'MEASURE' &&
        measurementBit !== null &&
        measurementBit !== undefined &&
        !isPreview;

    // Optional: gate the bubble on the sweep reaching this column
    if (
        showMeasurementBubble &&
        runProgress != null &&
        gateCol !== null &&
        MAX_COLS > 0
    ) {
        const scanCol = Math.min(
            MAX_COLS - 1,
            Math.floor(runProgress * MAX_COLS),
        );
        showMeasurementBubble = scanCol >= gateCol;
    }

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            {showMeasurementBubble && (
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
                        pointerEvents: 'none',
                    }}
                >
                    {measurementBit}
                </div>
            )}

            <GateGlyph
                kind={kind}
                label={innerLabel}
                selected={props.selected}
                isPreview={isPreview}
                hasPartner={data.hasPartner}
                row={data.row}
                col={data.col}
                partnerRow={data.partnerRow}
                partnerCol={data.partnerCol}
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
