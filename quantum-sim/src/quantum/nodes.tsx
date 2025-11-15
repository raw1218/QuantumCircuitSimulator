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
    const text = label ?? k ?? '';

    // Make preview VERY obvious
    const borderWidth = selected && !isPreview ? 3 : 2;
    const boxShadow =
        selected && !isPreview ? '0 0 8px rgba(129, 230, 217, 0.9)' : 'none';

    // Preview style: dashed cyan border, transparent fill, low opacity
    const borderColor = isPreview ? '#22d3ee' : style.border;
    const bgColor = isPreview ? 'transparent' : style.bg;
    const borderStyle = isPreview ? 'dashed' as const : 'solid' as const;
    const opacity = isPreview ? 0.7 : 1;

    return (
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                borderWidth,
                borderColor,
                borderStyle,
                background: bgColor,
                color: '#000000',
                fontSize: 16,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                boxShadow,
                opacity,
            }}
        >
            {text}
        </div>
    );
}

// ===== Gate node (used by ReactFlow) =====

type GateData = { label?: string; kind?: string; isPreview?: boolean };

export function GateNode(props: NodeProps) {
    const data = props.data as GateData;
    const kind = data.kind ?? '';
    const label = data.label ?? kind ?? '';
    const isPreview = !!data.isPreview;

    if (isPreview) {
        console.log('Rendering PREVIEW gate node', { id: props.id, kind, label });
    }

    return (
        <GateGlyph
            kind={kind}
            label={label}
            selected={props.selected}
            isPreview={isPreview}
        />
    );
}

// ===== Node type map for ReactFlow =====

export const nodeTypes = {
    qubitLabel: QubitLabelNode,
    wire: WireNode,
    gate: GateNode,
};


