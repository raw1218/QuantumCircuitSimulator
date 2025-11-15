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

import { nodeTypes, GateGlyph } from './nodes';
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
} from './layout';
import type { GateKind } from './model';
import { QubitInputsColumn } from "./qubitInputRender"; 



/********************** CONTEXT *********************************/


function useCircuitState() {
    const { screenToFlowPosition } = useReactFlow();
    const [nQubits, setNQubits] = useState(3);
    const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node>(
        createRailNodes(3),
    );
    const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(initialEdges);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    function addQubit() {
        setNQubits((n) => n + 1);
        // update nodes here if needed
    }

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
  if (!previewGate) return null;

  return (
    <ViewportPortal>
      <div
        style={{
          position: 'absolute',
          transform: `translate(${colX(previewGate.col)}px, ${
            rowY(previewGate.row) - GATE_Y_OFFSET
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

export function CircuitCanvas() {
  const {screenToFlowPosition, nQubits, setNQubits, nodes, setNodes, onNodesChangeBase, edges, setEdges, onEdgesChangeBase, selectedNodeId, setSelectedNodeId } = useCircuitContext(); 
  const [previewGate, setPreviewGate] = useState<PreviewGate | null>(null);
  const [dragKind, setDragKind] = useState<GateKind | null>(null);

  const dragStartPosRef = useRef<Record<string, { x: number; y: number }>>({});

  const onNodesChange = (changes: NodeChange[]) => onNodesChangeBase(changes);
  const onEdgesChange = (changes: EdgeChange[]) => onEdgesChangeBase(changes);

  const handleSelectionChange = (params: SelectionChange) => {
    const gateNode = params.nodes.find((n) => n.type === 'gate');
      setSelectedNodeId(gateNode ? gateNode.id : null);
      console.log('Selection changed, selectedNodeId =', selectedNodeId);
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

  /* ------- palette handlers ------- */

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

  console.log('Raw circuit object:', circuit);
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
            {/* Two-column layout: left inputs, right canvas */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '260px 1fr', // left panel width, right fills
                    width: '100%',
                    height: '100%',
                }}
            >
                {/* Left column: per-qubit input panel */}
                <QubitInputsColumn />

                {/* Right column: ReactFlow canvas + overlays */}
                <div
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                    }}
                >
                    {/* Qubit count + Run controls (overlay inside right pane) */}
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

                        <button
                            onClick={handleRun}
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

                    {/* Ghost preview overlay (if it uses absolute/fixed itself) */}
                    <GhostPreview previewGate={previewGate} />
                </div>
            </div>

            {/* Bottom gate palette spanning full width of the outer container */}
            <GatePalette
                palette={GATE_PALETTE}
                onDragStart={handlePaletteDragStart}
                onDragEnd={handlePaletteDragEnd}
            />
        </div>
    );

}
