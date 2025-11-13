import { useEffect, useState, useRef } from 'react';
import type { DragEvent, MouseEvent } from 'react';
import {
    Background,
    ReactFlow,
    ReactFlowProvider,
    ViewportPortal,
    useReactFlow,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type NodeChange,
    type EdgeChange,
    type SelectionChange,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import { nodeTypes, GateGlyph } from './quantum/nodes';
import { initialEdges } from './quantum/scene';
import {
    GATE_Y_OFFSET,
    ROW_HEIGHT,
    Y_OFFSET,
    X_WIRE,
    COL_WIDTH,
    rowY,
    colX,
    snapToGrid,
} from './quantum/layout';
import type { GateKind } from './quantum/model';

const GATE_PALETTE: GateKind[] = ['H', 'X', 'Z', 'MEASURE'];

/* ──────────────────────────────────────────────────────────────
   Grid helpers
   ────────────────────────────────────────────────────────────── */

function gridFromNode(node: Node) {
    const row = Math.round((node.position.y + GATE_Y_OFFSET - Y_OFFSET) / ROW_HEIGHT);
    const col = Math.round((node.position.x - X_WIRE) / COL_WIDTH);
    return { row, col };
}

function isCellOccupied(
    nodes: Node[],
    row: number,
    col: number,
    ignoreId?: string,
): boolean {
    return nodes.some((n) => {
        if (n.type !== 'gate') return false;
        if (ignoreId && n.id === ignoreId) return false;
        const g = gridFromNode(n);
        return g.row === row && g.col === col;
    });
}

type PreviewGate = {
    row: number;
    col: number;
    kind: GateKind;
};

/* ──────────────────────────────────────────────────────────────
   Rail (label + wire) generator
   ────────────────────────────────────────────────────────────── */

function createRailNodes(nQubits: number): Node[] {
    const rails: Node[] = [];

    for (let i = 0; i < nQubits; i++) {
        const y = rowY(i);

        rails.push({
            id: `label-${i}`,
            type: 'qubitLabel',
            position: { x: 0, y },
            data: { label: `q${i}` },
            draggable: false,
            selectable: false,
        });

        rails.push({
            id: `wire-${i}`,
            type: 'wire',
            position: { x: X_WIRE, y },
            data: {},
            draggable: false,
            selectable: false,
        });
    }

    return rails;
}

/* ──────────────────────────────────────────────────────────────
   Hooks
   ────────────────────────────────────────────────────────────── */

function useDeleteSelectedGate(
    selectedNodeId: string | null,
    setNodes: ReturnType<typeof useNodesState<Node>>[1],
    setEdges: ReturnType<typeof useEdgesState<Edge>>[1],
    clearSelection: () => void,
) {
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (!selectedNodeId) return;
            if (event.key !== 'Delete' && event.key !== 'Backspace') return;

            event.preventDefault();
            setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
            setEdges((eds) =>
                eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
            );
            clearSelection();
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedNodeId, setNodes, setEdges, clearSelection]);
}

/* ──────────────────────────────────────────────────────────────
   Presentational components
   ────────────────────────────────────────────────────────────── */

type GhostPreviewProps = {
    previewGate: PreviewGate | null;
};

function GhostPreview({ previewGate }: GhostPreviewProps) {
    if (!previewGate) return null;

    return (
        <ViewportPortal>
            <div
                style={{
                    position: 'absolute',
                    transform: `translate(${colX(previewGate.col)}px, ${rowY(previewGate.row) - GATE_Y_OFFSET
                        }px)`,
                    pointerEvents: 'none',
                }}
            >
                <GateGlyph kind={previewGate.kind} isPreview />
            </div>
        </ViewportPortal>
    );
}

type GatePaletteProps = {
    palette: GateKind[];
    onDragStart: (kind: GateKind, event: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
};

function GatePalette({ palette, onDragStart, onDragEnd }: GatePaletteProps) {
    return (
        <div
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '8px 16px',
                background: 'rgba(5, 7, 9, 0.9)',
                borderTop: '1px solid #222',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
            }}
        >
            <span
                style={{
                    color: '#aaa',
                    fontSize: 14,
                    fontFamily: 'system-ui, sans-serif',
                    marginRight: 8,
                }}
            >
                Drag a gate onto a wire (click to select, Delete to remove):
            </span>

            {palette.map((kind) => (
                <div
                    key={kind}
                    draggable
                    onDragStart={(event) => onDragStart(kind, event)}
                    onDragEnd={onDragEnd}
                    style={{ cursor: 'grab', userSelect: 'none' }}
                >
                    <GateGlyph kind={kind} />
                </div>
            ))}
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   Main canvas
   ────────────────────────────────────────────────────────────── */

function CircuitCanvas() {
    const { screenToFlowPosition } = useReactFlow();

    const [nQubits, setNQubits] = useState(3);

    const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(
        createRailNodes(3),
    );
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(initialEdges);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [previewGate, setPreviewGate] = useState<PreviewGate | null>(null);
    const [dragKind, setDragKind] = useState<GateKind | null>(null);

    const dragStartPosRef = useRef<Record<string, { x: number; y: number }>>({});

    const onNodesChange = (changes: NodeChange[]) => onNodesChangeBase(changes);
    const onEdgesChange = (changes: EdgeChange[]) => onEdgesChangeBase(changes);

    const handleSelectionChange = (params: SelectionChange) => {
        const gateNode = params.nodes.find((n) => n.type === 'gate');
        setSelectedNodeId(gateNode ? gateNode.id : null);
    };

    useDeleteSelectedGate(
        selectedNodeId,
        setNodes,
        setEdges,
        () => setSelectedNodeId(null),
    );

    // Rebuild rails when nQubits changes; drop gates on removed rails
    useEffect(() => {
        setNodes((prev) => {
            const gateNodes = prev.filter((n) => n.type === 'gate');

            const filteredGates = gateNodes.filter((g) => {
                const { row } = gridFromNode(g);
                return row < nQubits;
            });

            const rails = createRailNodes(nQubits);
            return [...rails, ...filteredGates];
        });
    }, [nQubits, setNodes]);

    /* ------- palette drag (external) ------- */

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const kind: GateKind | null =
            dragKind ||
            ((event.dataTransfer.getData('text/plain') as GateKind) ||
                (event.dataTransfer.getData('application/gate-kind') as GateKind));

        if (!kind) {
            setPreviewGate(null);
            setDragKind(null);
            return;
        }

        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

        // snap + clamp (both row & col) with layout helper
        const { row, col, xSnapped, ySnapped } = snapToGrid(
            pos.x,
            pos.y + GATE_Y_OFFSET,
            nQubits,
        );

        const newId = `gate-${kind}-${Date.now()}`;

        setNodes((nds) => {
            if (isCellOccupied(nds, row, col)) {
                return nds;
            }

            const newNode: Node = {
                id: newId,
                type: 'gate',
                position: { x: xSnapped, y: ySnapped - GATE_Y_OFFSET },
                data: { kind, label: kind },
                draggable: true,
                selected: true,
            };

            const cleared = nds.map((n) => ({ ...n, selected: false }));
            return cleared.concat(newNode);
        });

        setSelectedNodeId(newId);
        setPreviewGate(null);
        setDragKind(null);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        if (!dragKind) return;

        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

        const { row, col } = snapToGrid(pos.x, pos.y + GATE_Y_OFFSET, nQubits);

        if (isCellOccupied(nodes, row, col)) {
            setPreviewGate(null);
        } else {
            setPreviewGate({ row, col, kind: dragKind });
        }
    };

    const handleDragLeave = () => {
        setPreviewGate(null);
    };

    /* ------- node drag (internal) ------- */

    const handleNodeDragStart = (_: MouseEvent, node: Node) => {
        if (node.type !== 'gate') return;

        dragStartPosRef.current[node.id] = { ...node.position };

        const data = node.data as any;
        const kind = data?.kind as GateKind | undefined;
        if (!kind) {
            setPreviewGate(null);
            return;
        }

        const flowX = node.position.x;
        const flowY = node.position.y + GATE_Y_OFFSET;
        const { row, col } = snapToGrid(flowX, flowY, nQubits);

        if (isCellOccupied(nodes, row, col, node.id)) {
            setPreviewGate(null);
        } else {
            setPreviewGate({ row, col, kind });
        }
    };

    const handleNodeDrag = (_: MouseEvent, node: Node) => {
        if (node.type !== 'gate') return;

        const data = node.data as any;
        const kind = data?.kind as GateKind | undefined;
        if (!kind) {
            setPreviewGate(null);
            return;
        }

        const flowX = node.position.x;
        const flowY = node.position.y + GATE_Y_OFFSET;
        const { row, col } = snapToGrid(flowX, flowY, nQubits);

        if (isCellOccupied(nodes, row, col, node.id)) {
            setPreviewGate(null);
        } else {
            setPreviewGate((prev) => {
                if (prev && prev.row === row && prev.col === col && prev.kind === kind) {
                    return prev;
                }
                return { row, col, kind };
            });
        }
    };

    const handleNodeDragStop = (_: MouseEvent, node: Node) => {
        if (node.type !== 'gate') {
            setPreviewGate(null);
            return;
        }

        const flowX = node.position.x;
        const flowY = node.position.y + GATE_Y_OFFSET;
        const { row, col, xSnapped, ySnapped } = snapToGrid(flowX, flowY, nQubits);

        setNodes((nds) => {
            const occupied = isCellOccupied(nds, row, col, node.id);
            const startPos = dragStartPosRef.current[node.id];

            if (occupied && startPos) {
                return nds.map((n) =>
                    n.id === node.id ? { ...n, position: { ...startPos } } : n,
                );
            }

            return nds.map((n) =>
                n.id === node.id
                    ? {
                        ...n,
                        position: { x: xSnapped, y: ySnapped - GATE_Y_OFFSET },
                    }
                    : n,
            );
        });

        setPreviewGate(null);
    };

    /* ------- palette handlers wired to component ------- */

    const handlePaletteDragStart = (kind: GateKind, event: DragEvent<HTMLDivElement>) => {
        setDragKind(kind);
        event.dataTransfer.setData('text/plain', kind);
        event.dataTransfer.setData('application/gate-kind', kind);
        event.dataTransfer.effectAllowed = 'move';
    };

    const handlePaletteDragEnd = () => {
        setDragKind(null);
        setPreviewGate(null);
    };

    /* ------- render ------- */

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                background: '#050709',
                position: 'relative',
                overflow: 'hidden',
            }}
        >
            {/* Qubit count controls */}
            <div
                style={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    background: 'rgba(0,0,0,0.5)',
                    padding: '6px 10px',
                    borderRadius: 6,
                    color: '#fff',
                    fontFamily: 'system-ui',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    zIndex: 10,
                }}
            >
                <button
                    onClick={() => setNQubits((n) => Math.max(1, n - 1))}
                    style={{
                        padding: '2px 6px',
                        fontSize: 14,
                        cursor: 'pointer',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#ddd',
                    }}
                >
                    –
                </button>

                <span>{nQubits} qubits</span>

                <button
                    onClick={() => setNQubits((n) => Math.min(4, n + 1))}
                    style={{
                        padding: '2px 6px',
                        fontSize: 14,
                        cursor: 'pointer',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#ddd',
                    }}
                >
                    +
                </button>
            </div>

            {/* ReactFlow canvas */}
            <div
                style={{ width: '100%', height: '100%' }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onSelectionChange={handleSelectionChange}
                    onNodeDragStart={handleNodeDragStart}
                    onNodeDrag={handleNodeDrag}
                    onNodeDragStop={handleNodeDragStop}
                    fitView
                    elementsSelectable
                    panOnScroll={false}
                    zoomOnScroll={false}
                    zoomOnDoubleClick={false}
                    zoomOnPinch={false}
                    panOnDrag={false}
                >
                    <Background color="#333" gap={24} />
                </ReactFlow>
            </div>

            <GhostPreview previewGate={previewGate} />

            <GatePalette
                palette={GATE_PALETTE}
                onDragStart={handlePaletteDragStart}
                onDragEnd={handlePaletteDragEnd}
            />
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   Root
   ────────────────────────────────────────────────────────────── */

export default function App() {
    return (
        <ReactFlowProvider>
            <CircuitCanvas />
        </ReactFlowProvider>
    );
}
