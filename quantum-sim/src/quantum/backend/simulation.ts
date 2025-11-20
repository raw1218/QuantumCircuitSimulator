import {type Circuit, type GateCell, type GateKind} from '../model';


export interface ComplexAmplitude {
    real: number;
    imaginary: number;
}

/** Helper to build a ComplexAmplitude */
function c(real: number, imaginary: number = 0): ComplexAmplitude {
    return { real, imaginary };
}

// a + b
export function complexAdd(a: ComplexAmplitude, b: ComplexAmplitude): ComplexAmplitude {
    return {
        real: (a.real + b.real),
        imaginary: (a.imaginary + b.imaginary),
    };
}

// a * b   ( (a + ib)(c + id) = (ac − bd) + i(ad + bc) )
export function complexMultiply(a: ComplexAmplitude, b: ComplexAmplitude): ComplexAmplitude {
    return {
        real: ((a.real * b.real) - (a.imaginary * b.imaginary)),
        imaginary: ((a.real * b.imaginary) + (a.imaginary * b.real)),
    };
}

export interface ComplexMatrix {
    rows: number;
    cols: number;
    data: ComplexAmplitude[][];  // matrix[row][col]
}


export function multiplyMatrices(A: ComplexMatrix, B: ComplexMatrix): ComplexMatrix {
    if (A.cols !== B.rows) {
        throw new Error(
            `Matrix dimension mismatch: A is ${A.rows}x${A.cols}, B is ${B.rows}x${B.cols}`
        );
    }

    const m = A.rows;
    const n = A.cols;  // also B.rows
    const p = B.cols;

    // initialize result as m × p all-zero complex matrix
    const result: ComplexMatrix = {
        rows: m,
        cols: p,
        data: Array.from({ length: m }, () =>
            Array.from({ length: p }, () => c(0, 0))
        ),
    };

    for (let i = 0; i < m; i++) {
        for (let j = 0; j < p; j++) {
            let sum = c(0, 0);

            for (let k = 0; k < n; k++) {
                const product = complexMultiply(
                    A.data[i][k],
                    B.data[k][j]
                );

                sum = complexAdd(sum, product);
            }

            result.data[i][j] = sum;
        }
    }

    return result;
}





export interface GlobalStateVector {
    numberOfQubits: number;
    amplitudes: ComplexAmplitude[];
}




/** Hadamard Gate (H) */
export const HadamardGate: ComplexMatrix = {
    rows: 2,
    cols: 2,
    data: [
        [ c(1 / Math.sqrt(2)),  c(1 / Math.sqrt(2)) ],
        [ c(1 / Math.sqrt(2)),  c(-1 / Math.sqrt(2)) ]
    ],
};

/** Pauli-X Gate */
export const XGate: ComplexMatrix = {
    rows: 2,
    cols: 2,
    data: [
        [ c(0), c(1) ],
        [ c(1), c(0) ]
    ],
};

/** Pauli-Y Gate */
export const YGate: ComplexMatrix = {
    rows: 2,
    cols: 2,
    data: [
        [ c(0),     c(0, -1) ],   // -i
        [ c(0, 1),  c(0)     ]    // +i
    ],
};

/** Pauli-Z Gate */
export const ZGate: ComplexMatrix = {
    rows: 2,
    cols: 2,
    data: [
        [ c(1),  c(0) ],
        [ c(0),  c(-1) ]
    ],
};




export interface MeasurementResult {
    qubitIndex: number;
    resultBit: 0 | 1;
    probabilityZero: number;
    probabilityOne: number;
}


export function measureQubit(
    globalState: GlobalStateVector,
    qubitIndex: number,
): MeasurementResult {
    const numberOfQubits = globalState.numberOfQubits;
    const amplitudes = globalState.amplitudes;

    if ((qubitIndex < 0) || (qubitIndex >= numberOfQubits)) {
        throw new Error(
            `measureQubit: qubitIndex ${qubitIndex} is out of range for ${numberOfQubits} qubits`,
        );
    }

    const dimension = (1 << numberOfQubits);
    if (amplitudes.length !== dimension) {
        throw new Error(
            `measureQubit: amplitudes length ${amplitudes.length} does not match 2^${numberOfQubits} = ${dimension}`,
        );
    }

    const bitMask = (1 << qubitIndex);

    // 1) Compute P(0) and P(1)
    let probabilityZero = 0;
    let probabilityOne = 0;

    for (let index = 0; index < dimension; index++) {
        const amplitude = amplitudes[index];
        const real = amplitude.real;
        const imaginary = amplitude.imaginary;

        const probability = ((real * real) + (imaginary * imaginary));

        const bitValue = ((index & bitMask) === 0) ? 0 : 1;

        if (bitValue === 0) {
            probabilityZero = (probabilityZero + probability);
        } else {
            probabilityOne = (probabilityOne + probability);
        }
    }

    const totalProbability = (probabilityZero + probabilityOne);
    const safeTotal = (totalProbability === 0) ? 1 : totalProbability;

    probabilityZero = (probabilityZero / safeTotal);
    probabilityOne = (probabilityOne / safeTotal);

    // 2) Draw random outcome
    const r = Math.random();
    const resultBit: 0 | 1 = (r < probabilityZero) ? 0 : 1;

    // 3) Collapse: zero amplitudes inconsistent with resultBit, track norm^2
    let normSquared = 0;

    for (let index = 0; index < dimension; index++) {
        const bitValue = ((index & bitMask) === 0) ? 0 : 1;

        if (bitValue !== resultBit) {
            amplitudes[index] = { real: 0, imaginary: 0 };
        } else {
            const amplitude = amplitudes[index];
            const real = amplitude.real;
            const imaginary = amplitude.imaginary;

            normSquared = (normSquared + ((real * real) + (imaginary * imaginary)));
        }
    }

    const norm = (normSquared === 0) ? 1 : Math.sqrt(normSquared);
    const inverseNorm = (1 / norm);

    // 4) Renormalize remaining amplitudes
    for (let index = 0; index < dimension; index++) {
        const amplitude = amplitudes[index];
        const real = amplitude.real;
        const imaginary = amplitude.imaginary;

        amplitudes[index] = {
            real: (real * inverseNorm),
            imaginary: (imaginary * inverseNorm),
        };
    }


    console.log(`Measured qubit ${qubitIndex}: result=${resultBit}, P(0)=${probabilityZero.toFixed(4)}, P(1)=${probabilityOne.toFixed(4)}`);
    return {
        qubitIndex,
        resultBit,
        probabilityZero,
        probabilityOne,
    };
}

export function applySingleQubitGateToGlobalState(
    globalState: GlobalStateVector,
    qubitIndex: number,
    matrix: ComplexMatrix,
): void {
    const numberOfQubits = globalState.numberOfQubits;
    const amplitudes = globalState.amplitudes;

    if ((matrix.rows !== 2) || (matrix.cols !== 2)) {
        throw new Error("applySingleQubitGateToGlobalState: matrix must be 2x2");
    }

    if ((qubitIndex < 0) || (qubitIndex >= numberOfQubits)) {
        throw new Error(
            `applySingleQubitGateToGlobalState: qubitIndex ${qubitIndex} is out of range for ${numberOfQubits} qubits`,
        );
    }

    const dimension = (1 << numberOfQubits);
    const bitMask = (1 << qubitIndex);

    const m00 = matrix.data[0][0];
    const m01 = matrix.data[0][1];
    const m10 = matrix.data[1][0];
    const m11 = matrix.data[1][1];

    // For each basis index where this qubit is 0, pair it with the index
    // where this qubit is 1, and apply the 2x2 unitary to [a0; a1].
    for (let index = 0; index < dimension; index++) {
        if ((index & bitMask) !== 0) {
            // Only handle each pair once (when qubit bit is 0)
            continue;
        }

        const pairIndex = (index | bitMask); // same bits but qubitIndex set to 1

        const a0 = amplitudes[index];      // amplitude with qubit = 0
        const a1 = amplitudes[pairIndex];  // amplitude with qubit = 1

        // new0 = m00 * a0 + m01 * a1
        const new0_part0 = complexMultiply(m00, a0);
        const new0_part1 = complexMultiply(m01, a1);
        const new0 = complexAdd(new0_part0, new0_part1);

        // new1 = m10 * a0 + m11 * a1
        const new1_part0 = complexMultiply(m10, a0);
        const new1_part1 = complexMultiply(m11, a1);
        const new1 = complexAdd(new1_part0, new1_part1);

        amplitudes[index] = {
            real: new0.real,
            imaginary: new0.imaginary,
        };

        amplitudes[pairIndex] = {
            real: new1.real,
            imaginary: new1.imaginary,
        };
    }
}


export function applyCNOTToGlobalState(
    globalState: GlobalStateVector,
    controlQubit: number,
    targetQubit: number,
): void {
    const numberOfQubits = globalState.numberOfQubits;
    const oldAmplitudes = globalState.amplitudes;

    if ((controlQubit < 0) || (controlQubit >= numberOfQubits)) {
        throw new Error(
            `applyCNOTToGlobalState: controlQubit ${controlQubit} is out of range for ${numberOfQubits} qubits`,
        );
    }
    if ((targetQubit < 0) || (targetQubit >= numberOfQubits)) {
        throw new Error(
            `applyCNOTToGlobalState: targetQubit ${targetQubit} is out of range for ${numberOfQubits} qubits`,
        );
    }
    if (controlQubit === targetQubit) {
        throw new Error("applyCNOTToGlobalState: control and target must be different qubits");
    }

    const dimension = (1 << numberOfQubits);
    const bitControl = (1 << controlQubit);
    const bitTarget = (1 << targetQubit);

    const newAmplitudes: ComplexAmplitude[] = new Array(dimension);

    for (let index = 0; index < dimension; index++) {
        const amplitude = oldAmplitudes[index];
        const controlBitIsOne = ((index & bitControl) !== 0);

        let newIndex = index;
        if (controlBitIsOne) {
            // flip target bit when control bit is 1
            newIndex = (index ^ bitTarget);
        }

        newAmplitudes[newIndex] = {
            real: amplitude.real,
            imaginary: amplitude.imaginary,
        };
    }

    globalState.amplitudes = newAmplitudes;
}


/** Carry out the Actual Simulation */

/* helper: map GateKind → 2×2 matrix (for 1-qubit gates only) */
function getMatrixForGateKind(kind: GateKind): ComplexMatrix | null {
    if (kind === "H") {
        return HadamardGate;
    }
    if (kind === "X") {
        return XGate;
    }
    if (kind === "Y") {
        return YGate;
    }
    if (kind === "Z") {
        return ZGate;
    }
    // MEASURE and CNOT are not 2×2 matrices in this simulation
    return null;
}


/* helper: deep clone a GlobalStateVector so each column snapshot is independent */
function cloneGlobalStateVector(state: GlobalStateVector): GlobalStateVector {
    return {
        numberOfQubits: state.numberOfQubits,
        amplitudes: state.amplitudes.map((amp) => ({
            real: amp.real,
            imaginary: amp.imaginary,
        })),
    };
}


export function simulateCircuitByColumn(
    circuit: Circuit,
    initialState: GlobalStateVector,
): GlobalStateVector[] {
    const { nQubits, nCols, grid } = circuit;

    // Work on a mutable copy of the initial state
    let currentState: GlobalStateVector = cloneGlobalStateVector(initialState);

    const columnStates: GlobalStateVector[] = [];

    for (let col = 0; col < nCols; col++) {
        // 1) Apply all 1-qubit unitaries (H, X, Y, Z) in this column
        for (let row = 0; row < nQubits; row++) {
            const cell: GateCell = grid[row][col];
            if (!cell) {
                continue;
            }

            if (
                (cell.kind === "H") ||
                (cell.kind === "X") ||
                (cell.kind === "Y") ||
                (cell.kind === "Z")
            ) {
                const matrix = getMatrixForGateKind(cell.kind);
                if (matrix === null) {
                    continue;
                }
                applySingleQubitGateToGlobalState(currentState, row, matrix);
            }
        }

        // 2) Apply all CNOTs in this column
        for (let row = 0; row < nQubits; row++) {
            const cell: GateCell = grid[row][col];
            if (!cell) {
                continue;
            }

            if ((cell.kind === "CNOT") && cell.hasTarget && (typeof cell.targetRow === "number")) {
                const controlRow = row;
                const targetRow = cell.targetRow;
                applyCNOTToGlobalState(currentState, controlRow, targetRow);
            }
        }

        // 3) Apply all MEASURE gates in this column
        for (let row = 0; row < nQubits; row++) {
            const cell: GateCell = grid[row][col];
            if (!cell) {
                continue;
            }

            if (cell.kind === "MEASURE") {
                measureQubit(currentState, row);
            }
        }

        // 4) Snapshot the state after this column
        columnStates.push(cloneGlobalStateVector(currentState));
    }

    return columnStates;
}