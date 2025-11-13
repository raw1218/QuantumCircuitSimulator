// src/quantum/nodes.tsx
import type { NodeProps } from '@xyflow/react';
import type { GateKind } from './model';

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
export function WireNode() {
    return (
        <div
            style={{
                width: '600px',
                height: 0,
                borderTop: '2px solid #ffffff',
                pointerEvents: 'none',
            }}
        />
    );
}

// ===== Gate glyph (shared between canvas & palette) =====

type GateGlyphProps = {
    kind: GateKind | string;
    label?: string;
    selected?: boolean;
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

export function GateGlyph({ kind, label, selected }: GateGlyphProps) {
    const k = typeof kind === 'string' ? kind : '';
    const style = gateStyleFor(k);
    const text = label ?? k ?? '';

    const borderWidth = selected ? 3 : 2;
    const boxShadow = selected ? '0 0 8px rgba(129, 230, 217, 0.9)' : 'none';

    return (
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                border: `${borderWidth}px solid ${style.border}`,
                background: style.bg,
                color: '#000000',
                fontSize: 16,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow,
            }}
        >
            {text}
        </div>
    );
}

// ===== Gate node (used by ReactFlow) =====

type GateData = { label?: string; kind?: string };

export function GateNode(props: NodeProps) {
    const data = props.data as GateData;
    const kind = data.kind ?? '';
    const label = data.label ?? kind ?? '';

    return <GateGlyph kind={kind} label={label} selected={props.selected} />;
}

// ===== Node type map for ReactFlow =====

export const nodeTypes = {
    qubitLabel: QubitLabelNode,
    wire: WireNode,
    gate: GateNode,
};
