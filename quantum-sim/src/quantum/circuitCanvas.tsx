// src/CircuitCanvas.tsx

import { useEffect, useState, useRef, createContext, useContext} from 'react';
import type { DragEvent, MouseEvent } from 'react';
import { buildCircuitFromNodes } from './circuitBuilder';
import { setCell, createEmptyCircuit } from './model';
import { useQubitInputs } from './qubitInput'; 
import {
  Background,
  ReactFlow,
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

import { nodeTypes, GateGlyph, type GateData, GateNode } from './nodes';
import { initialEdges } from './scene';
import {
  GATE_Y_OFFSET,
  ROW_HEIGHT,
  Y_OFFSET,
  X_WIRE,
  COL_WIDTH,
  rowY,
  colX,
  snapToGrid,
    MAX_COLS,
    WIRE_GLOBAL_OFFSET_Y,
    WIRE_GLOBAL_OFFSET_X,
} from './layout';
import type { GateKind } from './model';
import { QubitInputsColumn } from "./qubitInputRender"; 
import { GlobalStateVisualizer } from './globalStateVisualizer';



/********************** CONTEXT *********************************/


function useCircuitState() {
    const { screenToFlowPosition } = useReactFlow();
    const [nQubits, setNQubits] = useState(2);
    const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(
        createRailNodes(3),
    );
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(initialEdges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    function addQubit() {
        setNQubits((n) => n + 1);
        // update nodes here if needed
    }
    // inside useCircuitState()
    const [runProgress, setRunProgress] = useState<number | null>(null);
    const [runMaxCols, setRunMaxCols] = useState<number>(0);

    const [currentCol, setCurrentCol] = useState<number | null>(null);
    const [isRunning, setIsRunning] = useState(false);

    const [selectedNodeKind, setSelectedNodeKind] = useState<GateKind | null>(null);
    const [isPlacingCNOTParter, setIsPlacingCNOTParter] = useState(false);
    const [CNOTPartnerRow, setCNOTPartnerRow] = useState<number | null>(null);
    const [CNOTPartnerCol, setCNOTPartnerCol] = useState<number | null>(null);



    const { qubitInputs, updateQubitInput, setQubitPreset } = useQubitInputs(nQubits);
    return {
        screenToFlowPosition,
        nQubits,
        setNQubits,
        nodes,
        setNodes,
        onNodesChangeBase,
        edges,
        setEdges,
        onEdgesChangeBase,
        addQubit,
        selectedNodeId,
        setSelectedNodeId,
        qubitInputs,
        updateQubitInput,
        setQubitPreset,
        runProgress,
        setRunProgress,
        runMaxCols,
        setRunMaxCols,
        currentCol,
        setCurrentCol,
        isRunning,
        setIsRunning,
        selectedNodeKind,
        setSelectedNodeKind,
        isPlacingCNOTParter,
        setIsPlacingCNOTParter,
        CNOTPartnerRow,
        setCNOTPartnerRow,
        CNOTPartnerCol,
        setCNOTPartnerCol,
    };
}

// Type is just "whatever useCircuitState returns"
type CircuitContextValue = ReturnType<typeof useCircuitState>;

// Real React context
const CircuitContext = createContext<CircuitContextValue | null>(null);

// Provider: creates ONE shared instance of the state
export function CircuitProvider({ children }: { children: React.ReactNode }) {
    const value = useCircuitState();
    return (
        <CircuitContext.Provider value={value}>
            {children}
        </CircuitContext.Provider>
    );
}

// This is now your "context hook"
export function useCircuitContext() {
    const ctx = useContext(CircuitContext);
    if (!ctx) {
        throw new Error('useCircuitContext must be used inside <CircuitProvider>');
    }
    return ctx;
}


/******************************* END CONTEXT **************************************** */

const GATE_PALETTE: GateKind[] = ['H', 'X', 'Y', 'Z', 'MEASURE', 'CNOT'];

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
  hasPartner?: boolean;
  partnerRow?: number | null;
  partnerCol?: number | null;
};

/* ──────────────────────────────────────────────────────────────
   Rail (label + wire) generator
   ────────────────────────────────────────────────────────────── */

export function createRailNodes(nQubits: number): Node[] {
    const nodes: Node[] = [];

    // 1) Invisible padding row above real wires
    nodes.push({
        id: 'padding-top',
        type: 'wire',
        position: {
            x: X_WIRE,
            y: rowY(0) - ROW_HEIGHT,
        },
        data: { isPadding: true },
        draggable: false,
        selectable: false,
    });

    // 2) Real rails — mark the first actual qubit wire as invisible
    for (let row = 0; row < nQubits; row++) {
        const y = rowY(row);

        nodes.push({
            id: `label-${row}`,
            type: 'qubitLabel',
            position: { x: 0, y },
            data: { label: `q${row}` },
            draggable: false,
        });

        nodes.push({
            id: `wire-${row}`,
            type: 'wire',
            position: { x: X_WIRE, y },
            data: row === 0 ? { isInvisibleTop: true } : {},
            draggable: false,
        });
    }

    return nodes;
}

/* ──────────────────────────────────────────────────────────────
   Hooks
   ────────────────────────────────────────────────────────────── */

function useDeleteSelectedGate() {
    const { setNodes, setEdges, selectedNodeId, setSelectedNodeId } =
        useCircuitContext();

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            console.log('keydown:', event.key, 'selectedNodeId =', selectedNodeId);

            if (!selectedNodeId) return;
            if (event.key !== 'Delete' && event.key !== 'Backspace') return;

            event.preventDefault();

            setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
            setEdges((eds) =>
                eds.filter(
                    (e) => e.source !== selectedNodeId && e.target !== selectedNodeId
                )
            );

            setSelectedNodeId(null);
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedNodeId, setNodes, setEdges, setSelectedNodeId]);
}

/* ──────────────────────────────────────────────────────────────
   Presentational components
   ────────────────────────────────────────────────────────────── */

type GhostPreviewProps = {
  previewGate: PreviewGate | null;
};


function GhostPreview({ previewGate }: GhostPreviewProps) {
    const {
        isPlacingCNOTParter,
        CNOTPartnerRow,
        CNOTPartnerCol,
    } = useCircuitContext();

    if (!previewGate) return null;

    // Are we previewing the *second* half of a CNOT pair?
    const isCnotPreview = previewGate.kind === 'CNOT';
    const hasPartner =
        isCnotPreview &&
        isPlacingCNOTParter &&
        typeof CNOTPartnerRow === 'number' &&
        typeof CNOTPartnerCol === 'number';

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
                <GateGlyph
                    kind={previewGate.kind}
                    isPreview
                    // partner info for preview line
                    hasPartner={hasPartner}
                    row={previewGate.row}
                    col={previewGate.col}
                    partnerRow={hasPartner ? CNOTPartnerRow! : undefined}
                    partnerCol={hasPartner ? CNOTPartnerCol! : undefined}
                />
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
    const { selectedNodeKind, setSelectedNodeKind } = useCircuitContext();

    return (
        <div
            style={{
                left: 0,
                right: 0,
                bottom: 0,
                padding: '8px 16px',
                background: 'rgba(5, 7, 9, 0.9)',
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

            {palette.map((kind) => {
                const isSelected = selectedNodeKind === kind;

                return (
                    <div
                        key={kind}
                        draggable
                        onClick={() =>
                            setSelectedNodeKind((prev) => (prev === kind ? null : kind))
                        }
                        onDragStart={(event) => onDragStart(kind, event)}
                        onDragEnd={onDragEnd}
                        style={{
                            cursor: 'grab',
                            userSelect: 'none',
                            padding: 4,
                            borderRadius: 6,
                            border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                            background: isSelected
                                ? 'rgba(56, 189, 248, 0.1)'
                                : 'transparent',
                            transform: isSelected ? 'scale(1.15)' : 'scale(1.0)',
                            transformOrigin: 'center center',
                            transition:
                                'transform 0.12s ease-out, border-color 0.12s ease-out, background-color 0.12s ease-out',
                        }}
                    >
                        <GateGlyph kind={kind} />
                    </div>
                );
            })}
        </div>
    );
}

/* ──────────────────────────────────────────────────────────────
   Main canvas
   ────────────────────────────────────────────────────────────── */


type RunHighlightProps = {
    currentCol: number | null;
    maxCols: number;
    nQubits: number;
};

function RunHighlightOverlay({ currentCol, maxCols, nQubits }: RunHighlightProps) {
    if (currentCol === null || maxCols <= 0) return null;

    // We'll use colX to find the x-position of the current column.
    const xStart = colX(0);
    const xEnd = colX(currentCol);

    // Height of the whole area is whatever the parent gives; we just use rowY for each rail.
    return (
        <svg
            style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
            }}
        >
            {Array.from({ length: nQubits }).map((_, r) => {
                const y = rowY(r);

                return (
                    <line
                        key={r}
                        x1={xStart}
                        y1={y}
                        x2={xEnd}
                        y2={y}
                        stroke="#38bdf8"
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={0.9}
                    />
                );
            })}
        </svg>
    );
}



type LeftPanelProps = {
    probs: number[];
};

function LeftPanel({ probs }: LeftPanelProps) {
    return (
        <div
            style={{
                width: '100%',
                height: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                background: '#020617',
                borderRight: '1px solid #111827',
                display: 'flex',
                flexDirection: 'column',
                overflowY: 'auto',   // 👈 scroll when it overflows
                minHeight: 0,        // 👈 important inside flex/grid
            }}
        >
            <QubitInputsColumn probs={probs} />
        </div>
    );
}
function BottomPanel({
    nQubits,
    onDecQubits,
    onIncQubits,
    onRun,
    onPaletteDragStart,
    onPaletteDragEnd,
}: BottomPanelProps) {
    return (
        <div
            style={{
                width: '100%',
                background: 'rgba(5,7,9,0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '8px 16px',
                borderTop: '1px solid #222',
                boxSizing: 'border-box',
            }}
        >
            <GatePalette
                palette={GATE_PALETTE}
                onDragStart={onPaletteDragStart}
                onDragEnd={onPaletteDragEnd}
            />

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: 'rgba(0,0,0,0.5)',
                    padding: '6px 10px',
                    borderRadius: 6,
                    color: '#fff',
                }}
            >
                <button
                    onClick={onDecQubits}
                    style={{
                        padding: '2px 6px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#ddd',
                        cursor: 'pointer',
                    }}
                >
                    –
                </button>

                <span>{nQubits} qubits</span>

                <button
                    onClick={onIncQubits}
                    style={{
                        padding: '2px 6px',
                        background: '#222',
                        border: '1px solid #444',
                        color: '#ddd',
                        cursor: 'pointer',
                    }}
                >
                    +
                </button>

                <button
                    onClick={onRun}
                    style={{
                        marginLeft: 8,
                        padding: '2px 10px',
                        fontSize: 14,
                        cursor: 'pointer',
                        background: '#16a34a',
                        border: '1px solid #22c55e',
                        color: '#f9fafb',
                        borderRadius: 4,
                    }}
                >
                    Run
                </button>
            </div>
        </div>
    );
}



export function CircuitCanvas() {
    const { screenToFlowPosition, nQubits, setNQubits, nodes, setNodes, onNodesChangeBase, edges, setEdges, onEdgesChangeBase, selectedNodeId, setSelectedNodeId, qubitInputs, runProgress, setRunProgress, currentCol, setCurrentCol, isRunning, setIsRunning, runMaxCols, setRunMaxCols, selectedNodeKind, setSelectedNodeKind, isPlacingCNOTParter, setIsPlacingCNOTParter, CNOTPartnerRow, setCNOTPartnerRow, CNOTPartnerCol,setCNOTPartnerCol} = useCircuitContext();
    const [previewGate, setPreviewGate] = useState<PreviewGate | null>(null);


    const dragStartPosRef = useRef<Record<string, { x: number; y: number }>>({});

    const onNodesChange = (changes: NodeChange[]) => onNodesChangeBase(changes);
    const onEdgesChange = (changes: EdgeChange[]) => onEdgesChangeBase(changes);

    const handleSelectionChange = (params: SelectionChange) => {
        const gateNode = params.nodes.find((n) => n.type === 'gate');
        setSelectedNodeId(gateNode ? gateNode.id : null);
    };

    useDeleteSelectedGate();

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


    /* Logic For Placing Nodes */
    const placeNodeAt = (kind: GateKind | null, row: number, col: number) => {
        if (!kind) return;
        const xSnapped = colX(col);
        const ySnapped = rowY(row);
        const newId = `gate-${kind}-${Date.now()}`;

        let node_has_partner = false;
        let reset_at_end = true;

        if (kind == 'CNOT') {
            console.log('Placed CNOT. isPlacingCnot partner = ', isPlacingCNOTParter);
            if (!isPlacingCNOTParter) {
                setIsPlacingCNOTParter(true);
                setSelectedNodeKind('CNOT');
                setCNOTPartnerRow(row);
                setCNOTPartnerCol(col);
                console.log('setSelectedNode Kind to ', selectedNodeKind);
                reset_at_end = false;
            }
            else {
                setIsPlacingCNOTParter(false);
                node_has_partner = true;
                console.log('placing parter, row = ', CNOTPartnerRow, ' col = ', CNOTPartnerCol);
            }
        }


        setNodes((nds) => {
            if (isCellOccupied(nds, row, col)) {
                return nds;
            }
            const newNode: Node = {
                id: newId,
                type: 'gate',
                position: { x: xSnapped, y: ySnapped - GATE_Y_OFFSET },
                data: {
                    kind,
                    label: kind,
                    col,   
                    row,  
                    hasPartner: node_has_partner,
                    partnerRow: node_has_partner ? CNOTPartnerRow! : undefined,
                    partnerCol: node_has_partner ? CNOTPartnerCol! : undefined,
                 
                },
                draggable: true,
                selected: true,
            };
            const cleared = nds.map((n) => ({ ...n, selected: false }));
            return cleared.concat(newNode);
        });




        if (reset_at_end) {
            setSelectedNodeKind(null);
            setPreviewGate(null);
        }
    }


    // ------- click-to-place using selectedNodeKind ------- //

    const handleCanvasMouseMove = (event: MouseEvent<HTMLDivElement>) => {
        // Only show a preview if we have a selected gate kind
        if (!selectedNodeKind) {
            setPreviewGate(null);
            return;
        }

        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

        const { row, col } = snapToGrid(
            pos.x,
            pos.y + GATE_Y_OFFSET,
            nQubits,
        );

        if (isCellOccupied(nodes, row, col)) {
            setPreviewGate(null);
        } else {
            setPreviewGate({ row, col, kind: selectedNodeKind, hasPartner: isPlacingCNOTParter ? true : false, partnerRow : CNOTPartnerRow, partnerCol : CNOTPartnerCol });
        }
    };

    const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
        if (!selectedNodeKind) return;

        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

        const { row, col } = snapToGrid(
            pos.x,
            pos.y + GATE_Y_OFFSET,
            nQubits,
        );

        if (isCellOccupied(nodes, row, col)) {
            return;
        }

        // Use your existing helper
        placeNodeAt(selectedNodeKind, row, col);
    };


    /* ------- palette drag (external) ------- */

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();

        const kind: GateKind | null =
            selectedNodeKind ||
            ((event.dataTransfer.getData('text/plain') as GateKind) ||
                (event.dataTransfer.getData('application/gate-kind') as GateKind));

        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
        const { row, col, xSnapped, ySnapped } = snapToGrid(
            pos.x,
            pos.y + GATE_Y_OFFSET,
            nQubits,
        );

        placeNodeAt(kind, row, col);
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';

        if (!selectedNodeKind) return;

        const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

        const { row, col } = snapToGrid(pos.x, pos.y + GATE_Y_OFFSET, nQubits);

        if (isCellOccupied(nodes, row, col)) {
            setPreviewGate(null);
        } else {
            setPreviewGate({ row, col, kind: selectedNodeKind });
        }
    };

    const handleDragLeave = () => {
        setPreviewGate(null);
    };




    /* ------- node drag (internal) ------- */

    const handleNodeDragStart = (_: MouseEvent, node: Node) => {
        if (node.type !== 'gate') return;

        dragStartPosRef.current[node.id] = { ...node.position };

        const data = node.data as { kind?: GateKind } | undefined;
        const kind = data?.kind;
        if (!kind) {
            setPreviewGate(null);
            return;
        }
        setSelectedNodeKind(kind);

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

        const data = node.data as { kind?: GateKind } | undefined;
        const kind = data?.kind;
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
        const occupied = isCellOccupied(nodes, row, col, node.id);
        console.log('in handleNodeDragStop:', { row, col, occupied }); 
        if (occupied) {
            const startPos = dragStartPosRef.current[node.id]
            const { row, col, xSnapped, ySnapped } = snapToGrid(startPos.x, startPos.y, nQubits);
            setNodes((nds) => nds.filter((n) => n.id !== node.id)); // delete the dragged node 
            placeNodeAt(selectedNodeKind, row, col);
        }
        else {
            setNodes((nds) => nds.filter((n) => n.id !== node.id)); // delete the dragged node 
            placeNodeAt(selectedNodeKind, row, col);
        }

    };

    /* ------- palette handlers ------- */

    const handlePaletteDragStart = (kind: GateKind, event: DragEvent<HTMLDivElement>) => {
        setSelectedNodeKind(kind);
        event.dataTransfer.setData('text/plain', kind);
        event.dataTransfer.setData('application/gate-kind', kind);
        event.dataTransfer.effectAllowed = 'move';
    };

    const handlePaletteDragEnd = () => {
        setPreviewGate(null);
    };

    /* ------- Run button ------- */

    function buildCircuitFromNodes(
        nodes: Node[],
        nQubits: number,
        nCols?: number,
    ): Circuit {
        const gateNodes = nodes.filter((n) => n.type === 'gate');

        // infer cols if not provided
        let inferredCols = 0;
        for (const n of gateNodes) {
            const { col } = gridFromNode(n);
            if (col > inferredCols) inferredCols = col;
        }
        const totalCols = Math.max(1, Math.min((nCols ?? inferredCols + 1), MAX_COLS));

        let circuit = createEmptyCircuit(nQubits, totalCols);

        for (const node of gateNodes) {
            const data = node.data as { kind?: GateKind } | undefined;
            const kind = data?.kind;
            if (!kind) continue;

            const { row, col } = gridFromNode(node);
            if (row < 0 || row >= nQubits || col < 0 || col >= totalCols) continue;

            circuit = setCell(circuit, row, col, { kind });
        }

        return circuit;
    }

    const handleRun = () => {
        const circuit = buildCircuitFromNodes(nodes, nQubits);

        console.log('=== Quantum circuit ===');
        console.log(`nQubits = ${circuit.nQubits}, nCols = ${circuit.nCols}`);
        console.log('Grid (row x col):');

        circuit.grid.forEach((row, r) => {
            const prettyRow = row
                .map((cell) => {
                    if (!cell) return '.';
                    const k = cell.kind;
                    return k.length > 0 ? k[0] : '?';
                })
                .join('  ');

            console.log(`q${r}: ${prettyRow}`);
        });

        console.log('\n=== Initial qubit states (from Bloch inputs) ===');
        qubitInputs.forEach((input, idx) => {
            const { theta, phi } = input;

            const alpha = Math.cos(theta / 2);
            const betaReal = Math.sin(theta / 2) * Math.cos(phi);
            const betaImag = Math.sin(theta / 2) * Math.sin(phi);

            const fmt = (x: number) => Number(x.toFixed(4));

            console.log(
                `q${idx}: |ψ⟩ = ${fmt(alpha)}·|0⟩ + (${fmt(betaReal)} ${betaImag >= 0 ? '+' : '-'
                } ${fmt(Math.abs(betaImag))}i)·|1⟩`
            );
        });

        console.log('\nRaw circuit object:', circuit);

        // ===== Start the animation =====
        setRunMaxCols(circuit.nCols);
        setRunProgress(0);
        setIsRunning(true);
    };

    useEffect(() => {
        if (!isRunning || runMaxCols <= 0) return;

        const durationMs = 2000; // total time to sweep left → right (tweak)
        const start = performance.now();

        const tick = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);

            // keep runProgress in sync
            setRunProgress(t);

            // compute current column from progress and push to context
            const scanCol = Math.min(
                MAX_COLS - 1,
                Math.floor(t* MAX_COLS)
            );
            setCurrentCol(scanCol);

            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                setIsRunning(false);
            }
        };

        const id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [isRunning, runMaxCols, setRunProgress, setCurrentCol, setIsRunning]);
    /* ------- render ------- */

    // Tweakable offsets for the controls + global-state band (in graph coords)
    const GLOBAL_BAND_OFFSET_X = -50;    // negative = shift left, positive = shift right
    const GLOBAL_BAND_OFFSET_Y = -220;
    const dim = 1 << nQubits;
    const mockProbs = Array.from({ length: dim }, (_, i) => {
        if (currentCol == null) return i === 0 ? 1 : 0;
        const idx = currentCol % dim;
        return i === idx ? 1 : 0;
    });
const GLOBAL_BAND_HEIGHT = 140; // tweak to match your GlobalStateVisualizer height

return (
  <div
    style={{
      width: '100vw',
      height: '100vh',
      background: '#050709',
      display: 'flex',
      flexDirection: 'column',
    }}
  >
    {/* MAIN AREA: fills remaining height above bottom panel */}
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        width: '100%',
        minHeight: 0,
      }}
    >
      {/* LEFT: Inputs (scrollable) */}
      <LeftPanel probs={mockProbs} />

      {/* RIGHT: reserved band + ReactFlow */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: 0,
        }}
      >

        {/* ReactFlow fills the rest */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
          }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onMouseMove={handleCanvasMouseMove}
          onClick={handleCanvasClick}
          onMouseLeave={() => setPreviewGate(null)}
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
            autoPanOnNodeDrag={false}
            autoPanOnConnect={false}
          >
            <Background color="#333" gap={24} />

            {/* GLOBAL STATE BAND: overlay, lined up with columns, above everything */}
            <ViewportPortal>
              <div
                style={{
                  position: 'absolute',
                  // keep using your graph-space offsets so it lines with colX/rowY
                  top: GLOBAL_BAND_OFFSET_Y,
                  left: GLOBAL_BAND_OFFSET_X,
                  pointerEvents: 'none',
                  margin: '10px',
                }}
              >
                <div
                  style={{
                    borderRadius: 6,
                    padding: '4px 6px',
                    pointerEvents: 'auto',
                  }}
                >
                  <GlobalStateVisualizer probs={mockProbs} />
                </div>
              </div>
            </ViewportPortal>

            <GhostPreview previewGate={previewGate} />
          </ReactFlow>
        </div>
      </div>
    </div>

    {/* BOTTOM: sits below, not overlapping */}
    <BottomPanel
      nQubits={nQubits}
      onDecQubits={() => setNQubits((n) => Math.max(1, n - 1))}
      onIncQubits={() => setNQubits((n) => Math.min(3, n + 1))}
      onRun={handleRun}
      onPaletteDragStart={handlePaletteDragStart}
      onPaletteDragEnd={handlePaletteDragEnd}
    />
  </div>
);
}