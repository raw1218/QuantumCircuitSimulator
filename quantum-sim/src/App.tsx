// src/App.tsx
import { useRef, useState, useEffect } from 'react';
import type { DragEvent } from 'react';
import {
    ReactFlow,
    Background,
    useNodesState,
    useEdgesState,
    ReactFlowProvider,
    useReactFlow,
    type Node,
    type Edge,
    type NodeChange,
    type EdgeChange,
    type SelectionChange,
} from '@xyflow/react';

import { nodeTypes, GateGlyph } from './quantum/nodes';
import { initialNodes, initialEdges } from './quantum/scene';
import { snapToRow, snapToCol, GATE_Y_OFFSET } from './quantum/layout';
import type { GateKind } from './quantum/model';

const GATE_PALETTE: GateKind[] = ['H', 'X', 'Z', 'MEASURE'];

function CircuitCanvas() {
    const reactFlowWrapper = useRef<HTMLDivElement | null>(null);
    const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(initialNodes);
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(initialEdges);
    const { screenToFlowPosition } = useReactFlow();

    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Wrap default node changes to keep selection in sync (optional but safe)
    const onNodesChange = (changes: NodeChange[]) => {
        onNodesChangeBase(changes);
    };

    const onEdgesChange = (changes: EdgeChange[]) => {
        onEdgesChangeBase(changes);
    };

    // Track selection from ReactFlow
    const handleSelectionChange = (params: SelectionChange) => {
        const gateNode = params.nodes.find((n) => n.type === 'gate');
        setSelectedNodeId(gateNode ? gateNode.id : null);
    };

    // Delete selected gate when pressing Delete / Backspace
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!selectedNodeId) return;

            if (event.key === 'Delete' || event.key === 'Backspace') {
                event.preventDefault();
                setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
                setEdges((eds) =>
                    eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
                );
                setSelectedNodeId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedNodeId, setNodes, setEdges]);

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const kind =
            (event.dataTransfer.getData('text/plain') as GateKind) ||
            (event.dataTransfer.getData('application/gate-kind') as GateKind);

        if (!kind) return;
        if (!reactFlowWrapper.current) return;

        const bounds = reactFlowWrapper.current.getBoundingClientRect();

        const position = screenToFlowPosition({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
        });

        const { ySnapped } = snapToRow(position.y + GATE_Y_OFFSET);
        const { xSnapped } = snapToCol(position.x);

        const newId = `gate-${kind}-${Date.now()}`;

        const newNode: Node = {
            id: newId,
            position: { x: xSnapped, y: ySnapped - GATE_Y_OFFSET },
            data: { kind, label: kind },
            type: 'gate',
            draggable: true,
            selected: true,   // <-- NEW
        };

        // Insert node + deselect all others
        setNodes((nds) =>
            nds
                .map((n) => ({ ...n, selected: false })) // clear old selections
                .concat(newNode)
        );

        // Track selected node id
        setSelectedNodeId(newId);
    };


    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
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
            {/* ReactFlow canvas wrapper */}
            <div
                ref={reactFlowWrapper}
                style={{ width: '100%', height: '100%' }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onSelectionChange={handleSelectionChange}
                    onNodeDragStop={(_, node) => {
                        if (node.type !== 'gate') return;

                        const { x, y } = node.position;
                        const { ySnapped } = snapToRow(y + GATE_Y_OFFSET);
                        const { xSnapped } = snapToCol(x);

                        setNodes((nds) =>
                            nds.map((n) =>
                                n.id === node.id
                                    ? {
                                        ...n,
                                        position: { x: xSnapped, y: ySnapped - GATE_Y_OFFSET },
                                    }
                                    : n,
                            ),
                        );
                    }}
                    fitView
                    elementsSelectable={true}   // allow selecting gates
                    panOnScroll
                    zoomOnScroll={false}
                    zoomOnDoubleClick={false}
                    zoomOnPinch={false}
                >
                    <Background color="#333" gap={24} />
                </ReactFlow>
            </div>

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
                            event.dataTransfer.setData('text/plain', kind);
                            event.dataTransfer.setData('application/gate-kind', kind);
                            event.dataTransfer.effectAllowed = 'move';
                        }}
                        style={{
                            cursor: 'grab',
                            userSelect: 'none',
                        }}
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
