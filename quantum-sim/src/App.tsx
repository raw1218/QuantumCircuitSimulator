import { useEffect, useState, useRef } from 'react';
import type { DragEvent } from 'react';
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
import { initialNodes, initialEdges } from './quantum/scene';
import {
    snapToRow,
    snapToCol,
    GATE_Y_OFFSET,
    ROW_HEIGHT,
    Y_OFFSET,
    X_WIRE,
    COL_WIDTH,
    rowY,
    colX,
} from './quantum/layout';
import type { GateKind } from './quantum/model';

const GATE_PALETTE: GateKind[] = ['H', 'X', 'Z', 'MEASURE'];

// === grid helpers ===

function rowFromSnappedY(ySnapped: number): number {
    return Math.round((ySnapped - Y_OFFSET) / ROW_HEIGHT);
}

function colFromSnappedX(xSnapped: number): number {
    return Math.round((xSnapped - X_WIRE) / COL_WIDTH);
}

function gridFromNode(node: Node) {
    const row = Math.round((node.position.y + GATE_Y_OFFSET - Y_OFFSET) / ROW_HEIGHT);
    const col = Math.round((node.position.x - X_WIRE) / COL_WIDTH);
    return { row, col };
}

function isCellOccupied(nodes: Node[], row: number, col: number, ignoreId?: string) {
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

// === main canvas ===

function CircuitCanvas() {
    const { screenToFlowPosition } = useReactFlow();

    const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(initialEdges);

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [previewGate, setPreviewGate] = useState<PreviewGate | null>(null);
    const [dragKind, setDragKind] = useState<GateKind | null>(null);

    // for existing node drag: remember original position so we can revert
    const dragStartPosRef = useRef<Record<string, { x: number; y: number }>>({});

    const onNodesChange = (changes: NodeChange[]) => {
        onNodesChangeBase(changes);
    };
    const onEdgesChange = (changes: EdgeChange[]) => {
        onEdgesChangeBase(changes);
    };

    const handleSelectionChange = (params: SelectionChange) => {
        const gateNode = params.nodes.find((n) => n.type === 'gate');
        setSelectedNodeId(gateNode ? gateNode.id : null);
    };

    // delete selected gate on Delete / Backspace
    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (!selectedNodeId) return;
            if (event.key !== 'Delete' && event.key !== 'Backspace') return;

            event.preventDefault();
            setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
            setEdges((eds) =>
                eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
            );
            setSelectedNodeId(null);
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedNodeId, setNodes, setEdges]);

    // ------- palette drag (external) -------

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

        // React Flow docs: use client coords directly with screenToFlowPosition
        const pos = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const { ySnapped } = snapToRow(pos.y + GATE_Y_OFFSET);
        const { xSnapped } = snapToCol(pos.x);

        const row = rowFromSnappedY(ySnapped);
        const col = colFromSnappedX(xSnapped);

        const newId = `gate-${kind}-${Date.now()}`;

        setNodes((nds) => {
            if (isCellOccupied(nds, row, col)) {
                // occupied → no new node
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

        if (!dragKind) {
            // not dragging from palette
            return;
        }

        const pos = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const { ySnapped } = snapToRow(pos.y + GATE_Y_OFFSET);
        const { xSnapped } = snapToCol(pos.x);

        const row = rowFromSnappedY(ySnapped);
        const col = colFromSnappedX(xSnapped);

        if (isCellOccupied(nodes, row, col)) {
            setPreviewGate(null);
        } else {
            setPreviewGate({ row, col, kind: dragKind });
        }
    };

    const handleDragLeave = () => {
        setPreviewGate(null);
    };

    // ------- node drag (internal) -------

    const handleNodeDragStart = (_: React.MouseEvent, node: Node) => {
        if (node.type !== 'gate') return;

        // remember original position
        dragStartPosRef.current[node.id] = { ...node.position };
        console.log(`node = ${node.id}, startPos = ${dragStartPosRef.current[node.id]}`);

        const data = node.data as any;
        const kind = data?.kind as GateKind | undefined;
        if (!kind) {
            setPreviewGate(null);
            return;
        }

        const { ySnapped } = snapToRow(node.position.y + GATE_Y_OFFSET);
        const { xSnapped } = snapToCol(node.position.x);
        const row = rowFromSnappedY(ySnapped);
        const col = colFromSnappedX(xSnapped);

        if (isCellOccupied(nodes, row, col, node.id)) {
            setPreviewGate(null);
        } else {
            setPreviewGate({ row, col, kind });
        }
    };

    const handleNodeDrag = (_: React.MouseEvent, node: Node) => {
        if (node.type !== 'gate') return;

        const data = node.data as any;
        const kind = data?.kind as GateKind | undefined;
        if (!kind) {
            setPreviewGate(null);
            return;
        }

        const { ySnapped } = snapToRow(node.position.y + GATE_Y_OFFSET);
        const { xSnapped } = snapToCol(node.position.x);
        const row = rowFromSnappedY(ySnapped);
        const col = colFromSnappedX(xSnapped);

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

    const handleNodeDragStop = (_: React.MouseEvent, node: Node) => {
        if (node.type !== 'gate') {
            setPreviewGate(null);
            return;
        }

        const { ySnapped } = snapToRow(node.position.y + GATE_Y_OFFSET);
        const { xSnapped } = snapToCol(node.position.x);
        const row = rowFromSnappedY(ySnapped);
        const col = colFromSnappedX(xSnapped);

        setNodes((nds) => {
            const occupied = isCellOccupied(nds, row, col, node.id);

            // original position we saved when drag started
            const startPos = dragStartPosRef.current[node.id];
            console.log(`id = ${node.id} occupied = ${occupied}, startPos =, ${ startPos }`);

            if (occupied && startPos) {
                // revert to original cell
                return nds.map((n) =>
                    n.id === node.id ? { ...n, position: { ...startPos } } : n,
                );
            }

            // otherwise snap to new snapped position
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

            {/* Ghost preview gate, in FLOW coordinates via ViewportPortal */}
            {previewGate && (
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
            )}

            {/* Bottom gate palette */}
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

                {GATE_PALETTE.map((kind) => (
                    <div
                        key={kind}
                        draggable
                        onDragStart={(event) => {
                            setDragKind(kind);
                            event.dataTransfer.setData('text/plain', kind);
                            event.dataTransfer.setData('application/gate-kind', kind);
                            event.dataTransfer.effectAllowed = 'move';
                        }}
                        onDragEnd={() => {
                            setDragKind(null);
                            setPreviewGate(null);
                        }}
                        style={{ cursor: 'grab', userSelect: 'none' }}
                    >
                        <GateGlyph kind={kind} />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function App() {
    return (
        <ReactFlowProvider>
            <CircuitCanvas />
        </ReactFlowProvider>
    );
}
