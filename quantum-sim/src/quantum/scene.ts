// src/quantum/scene.ts
import type { Node, Edge } from '@xyflow/react';
import {
    N_QUBITS,
    rowY,
    colX,
    X_LABEL,
    X_WIRE,
    GATE_Y_OFFSET,
} from './layout';
import { sampleCircuit, type Circuit, type GateSpec } from './model';

function buildRailNodes(circ: Circuit): Node[] {
    const nodes: Node[] = [];

    for (let q = 0; q < circ.nQubits; q++) {
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

function gateSpecToNode(g: GateSpec): Node {
    const x = colX(g.col);
    const y = rowY(g.row) - GATE_Y_OFFSET;

    return {
        id: g.id,
        position: { x, y },
        data: { kind: g.kind, label: g.kind },
        type: 'gate',
        draggable: true,
    };
}

function buildGateNodes(circ: Circuit): Node[] {
    return circ.gates.map(gateSpecToNode);
}

export const initialNodes: Node[] = [
    ...buildRailNodes(sampleCircuit),
    ...buildGateNodes(sampleCircuit),
];

export const initialEdges: Edge[] = [];
