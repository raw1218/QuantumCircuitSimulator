// src/quantum/model.ts

export type GateKind = 'H' | 'X' | 'Y' | 'Z' | 'MEASURE' | 'CNOT';

export type GateSpec = {
    id: string;
    kind: GateKind;
    row: number;
    col: number;
    ctrlRow?: number;
};

export type Circuit = {
    nQubits: number;
    gates: GateSpec[];
};

export const sampleCircuit: Circuit = {
    nQubits: 3,
    gates: [
        { id: 'g-H-q0c0', kind: 'H', row: 0, col: 0 },
        { id: 'g-X-q0c2', kind: 'X', row: 0, col: 2 },
        { id: 'g-Z-q2c1', kind: 'Z', row: 2, col: 1 },
        { id: 'g-M-q1c3', kind: 'MEASURE', row: 1, col: 3 },
    ],
};
