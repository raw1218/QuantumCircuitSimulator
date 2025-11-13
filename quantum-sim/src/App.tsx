import {
    ReactFlow,
    Background,
    type Node,
    type Edge,
    type NodeProps,
    useNodesState,
    useEdgesState,
} from '@xyflow/react';

// === Custom node types ===

// Green label node for each qubit
function QubitLabelNode(props: NodeProps) {
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

// Wire node: just a horizontal line
function WireNode() {
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

// Gate node: little white box (placeholder gate)
function GateNode(props: NodeProps) {
    const label = (props.data as { label?: string }).label ?? '';
    return (
        <div
            style={{
                width: 40,
                height: 40,
                borderRadius: 4,
                border: '2px solid #ffffff',
                background: '#dddddd',
                color: '#000000',
                fontSize: 16,
                fontFamily: 'monospace',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            {label}
        </div>
    );
}

const nodeTypes = {
    qubitLabel: QubitLabelNode,
    wire: WireNode,
    gate: GateNode,
};

// === Layout constants ===
const N_QUBITS = 3;
const ROW_HEIGHT = 80;
const Y_OFFSET = 120;
const X_LABEL = 40;
const X_WIRE = 120;
const COL_WIDTH = 120; // distance between "time steps"

// Helpers: grid positions
const rowY = (row: number) => Y_OFFSET + row * ROW_HEIGHT;
const colX = (col: number) => X_WIRE + col * COL_WIDTH;

// Snap helpers
const clamp = (v: number, min: number, max: number) =>
    v < min ? min : v > max ? max : v;

function snapToRow(y: number): { row: number; ySnapped: number } {
    let bestRow = 0;
    let bestDist = Infinity;
    for (let r = 0; r < N_QUBITS; r++) {
        const targetY = rowY(r);
        const dist = Math.abs(y - targetY);
        if (dist < bestDist) {
            bestDist = dist;
            bestRow = r;
        }
    }
    return { row: bestRow, ySnapped: rowY(bestRow) };
}

function snapToCol(x: number): { col: number; xSnapped: number } {
    // Convert x to a column index relative to X_WIRE
    const rawCol = Math.round((x - X_WIRE) / COL_WIDTH);
    const col = clamp(rawCol, 0, 6); // allow up to e.g. 7 columns for now
    return { col, xSnapped: colX(col) };
}

// === Initial node builders ===

function buildRailNodes(): Node[] {
    const nodes: Node[] = [];

    for (let q = 0; q < N_QUBITS; q++) {
        const y = rowY(q);

        nodes.push({
            id: `q${q}-label`,
            position: { x: X_LABEL, y: y - 15 },
            data: { label: `q${q}` },
            type: 'qubitLabel',
            draggable: false,
        });

        nodes.push({
            id: `q${q}-wire`,
            position: { x: X_WIRE, y },
            data: {},
            type: 'wire',
            draggable: false,
        });
    }

    return nodes;
}

function buildGateNodes(): Node[] {
    const nodes: Node[] = [];

    const row = 0; // q0
    const col = 1; // second "time" column
    const x = colX(col);
    const y = rowY(row) - 20;

    nodes.push({
        id: `gate-${row}-${col}`,
        position: { x, y },
        data: { label: '' },
        type: 'gate',
        draggable: true,
    });

    return nodes;
}

const initialNodes: Node[] = [...buildRailNodes(), ...buildGateNodes()];
const initialEdges: Edge[] = [];

export default function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, , onEdgesChange] = useEdgesState(initialEdges);

    return (
        <div
            style={{
                width: '100vw',
                height: '100vh',
                background: '#050709',
            }}
        >
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDragStop={(_, node) => {
                    if (node.type !== 'gate') return;

                    const { x, y } = node.position;
                    const { ySnapped } = snapToRow(y + 20); // +20 to account for gate offset
                    const { xSnapped } = snapToCol(x);

                    setNodes((nds) =>
                        nds.map((n) =>
                            n.id === node.id
                                ? {
                                    ...n,
                                    position: { x: xSnapped, y: ySnapped - 20 },
                                }
                                : n,
                        ),
                    );
                }}
                fitView
                elementsSelectable={false}
                panOnScroll
                zoomOnScroll={false}
                zoomOnDoubleClick={false}
                zoomOnPinch={false}
            >
                <Background color="#333" gap={24} />
            </ReactFlow>
        </div>
    );
}
