// src/quantum/qubitState.ts

export interface Complex {
  re: number;
  im: number;
}

export interface BlochCoords {
  /** Polar angle θ in radians, range [0, π] */
  theta: number;
  /** Azimuthal angle φ in radians, range [0, 2π) */
  phi: number;
}

/**
 * Single-qubit pure state:
 * |ψ⟩ = α|0⟩ + β|1⟩
 * with |α|^2 + |β|^2 = 1
 */
export interface QubitState {
  alpha: Complex;
  beta: Complex;
}

// ---------- Complex helpers ----------

export function complex(re: number, im: number = 0): Complex {
  return { re, im };
}

export function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

export function complexConj(a: Complex): Complex {
  return { re: a.re, im: -a.im };
}

export function complexAbs(a: Complex): number {
  return Math.sqrt(a.re * a.re + a.im * a.im);
}

export function complexArg(a: Complex): number {
  return Math.atan2(a.im, a.re);
}

export function complexScale(a: Complex, s: number): Complex {
  return { re: a.re * s, im: a.im * s };
}

// ---------- State normalization ----------

export function normalizeState(state: QubitState): QubitState {
  const normSq =
    complexAbs(state.alpha) ** 2 + complexAbs(state.beta) ** 2;

  if (normSq === 0) {
    // degenerate case, default to |0>
    return {
      alpha: complex(1, 0),
      beta: complex(0, 0),
    };
  }

  const invNorm = 1 / Math.sqrt(normSq);

  return {
    alpha: complexScale(state.alpha, invNorm),
    beta: complexScale(state.beta, invNorm),
  };
}

// ---------- Bloch <-> state conversion ----------

/**
 * Convert Bloch coordinates (θ, φ) to a normalized qubit state.
 *
 * |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩
 */
export function stateFromBloch(bloch: BlochCoords): QubitState {
  const { theta, phi } = bloch;

  const halfTheta = theta / 2;
  const alphaMag = Math.cos(halfTheta);
  const betaMag = Math.sin(halfTheta);

  const alpha = complex(alphaMag, 0);

  // e^{iφ} = cos φ + i sin φ
  const phase = complex(Math.cos(phi), Math.sin(phi));
  const beta = complexMul(phase, complex(betaMag, 0));

  return normalizeState({ alpha, beta });
}

/**
 * Convert a normalized qubit state to Bloch coordinates (θ, φ).
 * We remove global phase by forcing α to be real and ≥ 0.
 */
export function blochFromState(input: QubitState): BlochCoords {
  const state = normalizeState(input);

  const { alpha, beta } = state;
  const alphaMag = complexAbs(alpha);
  const betaMag = complexAbs(beta);

  // Handle edge cases
  if (alphaMag === 0) {
    // Pure |1⟩ up to phase: θ = π, φ = arg(β)
    return {
      theta: Math.PI,
      phi: complexArg(beta),
    };
  }

  // Remove global phase: multiply state by e^{-i arg(α)} so α becomes real ≥ 0
  const phase = complex(0, -complexArg(alpha)); // i * (-arg)
  // e^{i * (-arg)} = cos(-arg) + i sin(-arg) = cos(arg) - i sin(arg)
  const g = complex(Math.cos(-phase.im), Math.sin(-phase.im));

  const alphaPrime = complexMul(alpha, g);
  const betaPrime = complexMul(beta, g);

  const alphaPrimeMag = complexAbs(alphaPrime);

  // θ from α'
  const theta = 2 * Math.acos(alphaPrimeMag);

  const phi = complexArg(betaPrime);

  return { theta, phi };
}

// ---------- Presets ----------

export type QubitPresetId =
  | "zero"
  | "one"
  | "plus"
  | "minus"
  | "plusI"
  | "minusI";

export interface QubitPreset {
  id: QubitPresetId;
  label: string;
  description: string;
  state: QubitState;
}

const ONE_OVER_SQRT2 = 1 / Math.sqrt(2);

export const qubitPresets: QubitPreset[] = [
  {
    id: "zero",
    label: "|0⟩",
    description: "Computational basis zero state",
    state: {
      alpha: complex(1, 0),
      beta: complex(0, 0),
    },
  },
  {
    id: "one",
    label: "|1⟩",
    description: "Computational basis one state",
    state: {
      alpha: complex(0, 0),
      beta: complex(1, 0),
    },
  },
  {
    id: "plus",
    label: "|+⟩",
    description: "(|0⟩ + |1⟩)/√2",
    state: {
      alpha: complex(ONE_OVER_SQRT2, 0),
      beta: complex(ONE_OVER_SQRT2, 0),
    },
  },
  {
    id: "minus",
    label: "|−⟩",
    description: "(|0⟩ − |1⟩)/√2",
    state: {
      alpha: complex(ONE_OVER_SQRT2, 0),
      beta: complex(-ONE_OVER_SQRT2, 0),
    },
  },
  {
    id: "plusI",
    label: "|+i⟩",
    description: "(|0⟩ + i|1⟩)/√2",
    state: {
      alpha: complex(ONE_OVER_SQRT2, 0),
      beta: complex(0, ONE_OVER_SQRT2),
    },
  },
  {
    id: "minusI",
    label: "|−i⟩",
    description: "(|0⟩ − i|1⟩)/√2",
    state: {
      alpha: complex(ONE_OVER_SQRT2, 0),
      beta: complex(0, -ONE_OVER_SQRT2),
    },
  },
];
