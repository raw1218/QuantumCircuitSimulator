// src/CircuitCanvas.tsx

import { useEffect, useState, useRef, createContext, useContext} from 'react';
import type { DragEvent, MouseEvent } from 'react';
import {printCircuit, buildCircuitFromNodes } from './circuitBuilder';
import { setCell, createEmptyCircuit, type Circuit} from './model';
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
  //type SelectionChange,
} from '@xyflow/react';
import {
    simulateCircuitByColumn,
    type GlobalStateVector,
    type ComplexAmplitude,
    complexMultiply,
} from './backend/simulation';
//temp
type SelectionChange = any;
type BottomPanelProps = any;




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

    const [globalStatesPerColumn, setGlobalStatesPerColumn] = useState<GlobalStateVector[] | null>(null);


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
        globalStatesPerColumn,
        setGlobalStatesPerColumn,
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
    const {
        nodes,
        setNodes,
        setEdges,
        selectedNodeId,
        setSelectedNodeId,
    } = useCircuitContext();

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if (!selectedNodeId) return;
            if (event.key !== 'Delete' && event.key !== 'Backspace') return;

            event.preventDefault();

            // Always delete the selected node
            const idsToDelete = new Set<string>([selectedNodeId]);

            // Try to find the selected gate node
            const selectedNode = nodes.find(
                (n) => n.id === selectedNodeId && n.type === 'gate',
            );

            if (selectedNode) {
                const data = selectedNode.data as {
                    kind?: GateKind;
                    row?: number;
                    col?: number;
                    hasPartner?: boolean;
                    partnerRow?: number;
                    partnerCol?: number;
                };

                if (data?.kind === 'CNOT') {
                    // Case 1: this node *stores* its partner info (the "second" CNOT)
                    if (
                        data.hasPartner &&
                        typeof data.partnerRow === 'number' &&
                        typeof data.partnerCol === 'number'
                    ) {
                        const partner = nodes.find((n) => {
                            if (n.type !== 'gate') return false;
                            const d = n.data as any;
                            return (
                                d?.kind === 'CNOT' &&
                                d?.row === data.partnerRow &&
                                d?.col === data.partnerCol
                            );
                        });

                        if (partner) {
                            idsToDelete.add(partner.id);
                        }
                    }
                    // Case 2: this is the "first" CNOT (no partnerRow/partnerCol),
                    // so we scan for a gate that points *to* this one's row/col.
                    else if (
                        typeof data.row === 'number' &&
                        typeof data.col === 'number'
                    ) {
                        const partner = nodes.find((n) => {
                            if (n.type !== 'gate') return false;
                            const d = n.data as any;
                            return (
                                d?.kind === 'CNOT' &&
                                d?.hasPartner &&
                                typeof d.partnerRow === 'number' &&
                                typeof d.partnerCol === 'number' &&
                                d.partnerRow === data.row &&
                                d.partnerCol === data.col
                            );
                        });

                        if (partner) {
                            idsToDelete.add(partner.id);
                        }
                    }
                }
            }

            // Remove selected node + partner (if found)
            setNodes((nds) => nds.filter((n) => !idsToDelete.has(n.id)));

            // Remove any edges connected to either node
            setEdges((eds) =>
                eds.filter(
                    (e) =>
                        !idsToDelete.has(e.source) &&
                        !idsToDelete.has(e.target),
                ),
            );

            setSelectedNodeId(null);
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedNodeId, nodes, setNodes, setEdges, setSelectedNodeId]);
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

function amplitudeProbSquared(amp: ComplexAmplitude): number {
    return amp.real * amp.real + amp.imaginary * amp.imaginary;
}

// Given a global state and a qubit index, figure out whether that qubit
// is effectively 0 or 1 after collapse.
function inferMeasuredBitForQubit(
    state: GlobalStateVector,
    qubitIndex: number,
): 0 | 1 {
    const dim = state.amplitudes.length;
    let sum0 = 0;
    let sum1 = 0;

    for (let basis = 0; basis < dim; basis++) {
        const prob = amplitudeProbSquared(state.amplitudes[basis]);
        if (((basis >> qubitIndex) & 1) === 1) {
            sum1 += prob;
        } else {
            sum0 += prob;
        }
    }

    // After collapse, one of these will be ~1 and the other ~0
    return sum1 > sum0 ? 1 : 0;
}

function computeMeasurementResults(
    circuit: Circuit,
    statesPerColumn: GlobalStateVector[],
): Record<string, 0 | 1> {
    const results: Record<string, 0 | 1> = {};
    const { nQubits, nCols, grid } = circuit;
    const cols = Math.min(nCols, statesPerColumn.length);

    for (let col = 0; col < cols; col++) {
        const state = statesPerColumn[col];
        if (!state) continue;

        for (let row = 0; row < nQubits; row++) {
            const cell = grid[row][col];
            if (!cell || cell.kind !== 'MEASURE') continue;

            const bit = inferMeasuredBitForQubit(state, row);
            results[`${row}:${col}`] = bit;
        }
    }

    return results;
}


export function CircuitCanvas() {
    const { screenToFlowPosition, nQubits, setNQubits, nodes, setNodes, onNodesChangeBase, edges, setEdges, onEdgesChangeBase, selectedNodeId, setSelectedNodeId, qubitInputs, runProgress, setRunProgress, currentCol, setCurrentCol, isRunning, setIsRunning, runMaxCols, setRunMaxCols, selectedNodeKind, setSelectedNodeKind, isPlacingCNOTParter, setIsPlacingCNOTParter, CNOTPartnerRow, setCNOTPartnerRow, CNOTPartnerCol,setCNOTPartnerCol, globalStatesPerColumn, setGlobalStatesPerColumn } = useCircuitContext();
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

    // ---- CNOT flow: first vs. second half ----
    if (kind === 'CNOT') {
        if (!isPlacingCNOTParter) {
            // First CNOT in the pair
            setIsPlacingCNOTParter(true);
            setSelectedNodeKind('CNOT');
            setCNOTPartnerRow(row);
            setCNOTPartnerCol(col);
            // don't clear selected gate or preview yet;
            // we expect a partner next.
            reset_at_end = false;
        } else {
            // Second (partner) CNOT
            setIsPlacingCNOTParter(false);
            node_has_partner = true;
        }
    }

    setNodes((nds) => {
        let base = nds;

        // If we were EXPECTING a CNOT partner but the user is placing
        // something else, delete the lonely first CNOT.
        if (
            isPlacingCNOTParter &&
            kind !== 'CNOT' &&
            CNOTPartnerRow != null &&
            CNOTPartnerCol != null
        ) {
            base = base.filter((n) => {
                if (n.type !== 'gate') return true;
                const data = n.data as {
                    kind?: GateKind;
                    row?: number;
                    col?: number;
                    hasPartner?: boolean;
                };

                // Only target the unpaired CNOT we stored as the "partner origin"
                if (data.kind !== 'CNOT') return true;
                if (data.hasPartner) return true; // don't touch already paired ones

                const sameCell =
                    data.row === CNOTPartnerRow && data.col === CNOTPartnerCol;

                // remove that one
                return !sameCell;
            });
        }

        // Don't place if the (possibly cleaned) grid cell is occupied
        if (isCellOccupied(base, row, col)) {
            return base;
        }

        const newNode: Node<GateData> = {
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
            draggable: kind !== 'CNOT',   // 👈 CNOTs are fixed in place
            selected: true,
        };

        const cleared: Node<GateData>[] = base.map<Node<GateData>>((n) => ({
            ...n,
            selected: false,
        }));

        return [...cleared, newNode];
    });

    // If we bailed out of CNOT partner placement by placing something else,
    // clean up that state.
    if (isPlacingCNOTParter && kind !== 'CNOT') {
        setIsPlacingCNOTParter(false);
        setCNOTPartnerRow(null);
        setCNOTPartnerCol(null);
    }

    if (reset_at_end) {
        setSelectedNodeKind(null);
        setPreviewGate(null);
    }
};


    // ------- click-to-place using selectedNodeKind ------- //

   const handleCanvasMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    // Only show a preview if we have a selected gate kind
    if (!selectedNodeKind) {
        setPreviewGate(null);
        return;
    }

    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    let { row, col } = snapToGrid(
        pos.x,
        pos.y + GATE_Y_OFFSET,
        nQubits,
    );

    // If we're placing the *partner* of a CNOT, force the column
    if (
        selectedNodeKind === 'CNOT' &&
        isPlacingCNOTParter &&
        typeof CNOTPartnerCol === 'number'
    ) {
        col = CNOTPartnerCol;
    }

    if (isCellOccupied(nodes, row, col)) {
        setPreviewGate(null);
    } else {
        setPreviewGate({
            row,
            col,
            kind: selectedNodeKind,
            hasPartner: isPlacingCNOTParter ? true : false,
            partnerRow: CNOTPartnerRow,
            partnerCol: CNOTPartnerCol,
        });
    }
};


const handleCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!selectedNodeKind) return;

    const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });

    let { row, col } = snapToGrid(
        pos.x,
        pos.y + GATE_Y_OFFSET,
        nQubits,
    );

    // Force same column when placing CNOT partner
    if (
        selectedNodeKind === 'CNOT' &&
        isPlacingCNOTParter &&
        typeof CNOTPartnerCol === 'number'
    ) {
        col = CNOTPartnerCol;
    }

    if (isCellOccupied(nodes, row, col)) {
        return;
    }

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


    function buildInitialGlobalStateFromInputs(
        nQubits: number,
        qubitInputs: { theta: number; phi: number }[],
    ): GlobalStateVector {
        const dimension = (1 << nQubits);

        // Precompute single-qubit states α|0> + β|1> for each qubit
        const localStates = Array.from({ length: nQubits }, (_, q) => {
            const input = qubitInputs[q] ?? { theta: 0, phi: 0 };
            const theta = input.theta;
            const phi = input.phi;

            const alphaReal = Math.cos(theta / 2);
            const alphaImag = 0;

            const betaMag = Math.sin(theta / 2);
            const betaReal = (betaMag * Math.cos(phi));
            const betaImag = (betaMag * Math.sin(phi));

            const alpha: ComplexAmplitude = { real: alphaReal, imaginary: alphaImag };
            const beta: ComplexAmplitude = { real: betaReal, imaginary: betaImag };

            return { alpha, beta };
        });

        const amplitudes: ComplexAmplitude[] = new Array(dimension);

        // Tensor product over qubits
        for (let index = 0; index < dimension; index++) {
            // start with amplitude 1 + 0i
            let amp: ComplexAmplitude = { real: 1, imaginary: 0 };

            for (let q = 0; q < nQubits; q++) {
                const bit = ((index >> q) & 1);
                const { alpha, beta } = localStates[q];
                const factor = (bit === 0) ? alpha : beta;
                amp = complexMultiply(amp, factor);
            }

            amplitudes[index] = amp;
        }

        return {
            numberOfQubits: nQubits,
            amplitudes,
        };
    }

    /* ------- Run button ------- */


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

        printCircuit(circuit);

        // 🧠 Build initial global state from the Bloch inputs
        const initialState = buildInitialGlobalStateFromInputs(nQubits, qubitInputs);

        const statesPerColumn = simulateCircuitByColumn(circuit, initialState);

        // Compute measurement results: key is `${row}:${col}` → 0 | 1
        const measurementResults = computeMeasurementResults(circuit, statesPerColumn);

        // Push measurement results into MEASURE nodes
        setNodes(prev =>
            prev.map(n => {
                if (n.type !== 'gate') return n;
                const data = n.data as GateData;

                if (data.kind !== 'MEASURE') {
                    return n;
                }

                const row = data.row ?? 0;
                const col = data.col ?? 0;
                const key = `${row}:${col}`;
                const bit = measurementResults[key];

                if (bit === undefined) {
                    // No result (e.g. measurement not reached), leave it blank
                    return {
                        ...n,
                        data: {
                            ...data,
                            measureOutcome: null,
                        },
                    };
                }

                return {
                    ...n,
                    data: {
                        ...data,
                        measureOutcome: bit,
                    },
                };
            }),
        );

        // Store in context for the visualizer
        setGlobalStatesPerColumn(statesPerColumn);

        // ===== Start the animation =====
        setRunMaxCols(circuit.nCols);
        setRunProgress(0);
        setCurrentCol(0);
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
                {globalStatesPerColumn && (
    <GlobalStateVisualizer statesPerColumn={globalStatesPerColumn} />
            )}
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