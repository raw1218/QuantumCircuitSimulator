// qubitInputRender.tsx
import React from 'react';
import { useCircuitContext } from './circuitCanvas';
import { QubitVisualization } from './qubitVisualization';
import { GlobalStateColumn } from './globalStateVisualizer';

type QubitInputsColumnProps = {
    probs: number[];
    title?: string;
};

export function QubitInputsColumn({
    probs,
    title = 'Global state',
}: QubitInputsColumnProps) {
    const {
        nQubits,
        qubitInputs,
        updateQubitInput,
        setQubitPreset,
        currentCol,
    } = useCircuitContext();

    if (nQubits <= 0) return null;
    if (!qubitInputs || qubitInputs.length === 0) return null;

    // --- Prepare normalized global probabilities + labels ---
    const dim = 1 << nQubits;

    const clamped = probs.slice(0, dim);
    while (clamped.length < dim) clamped.push(0);

    const sum = clamped.reduce(
        (s, p) => s + (Number.isFinite(p) ? Math.max(0, p) : 0),
        0,
    );
    const norm = sum > 0 ? sum : 1;

    const normalized = clamped.map((p) =>
        Number.isFinite(p) ? Math.max(0, p) / norm : 0,
    );

    const labels = Array.from({ length: dim }, (_, i) =>
        `|${i.toString(2).padStart(nQubits, '0')}⟩`,
    );

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '6px 8px',
                borderRight: '1px solid #222',
                background: 'rgba(5, 7, 9, 0.95)',
                color: '#eee',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 11,
                height: '100%',
                boxSizing: 'border-box',
            }}
        >
            {/* Section header */}
            <div
                style={{
                    fontWeight: 600,
                    fontSize: 12,
                    marginBottom: 2,
                }}
            >
                Qubit Inputs
            </div>

            {/* Per-qubit cards */}
            {Array.from({ length: nQubits }).map((_, index) => {
                const input = qubitInputs[index];
                if (!input) return null;

                const thetaDeg = (input.theta * 180) / Math.PI;
                const phiDeg = (input.phi * 180) / Math.PI;

                return (
                    <div
                        key={index}
                        style={{
                            padding: '5px 6px',
                            borderRadius: 5,
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                        }}
                    >
                        {/* Controls */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                            }}
                        >
                            {/* Header */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <span
                                    style={{
                                        fontWeight: 500,
                                        fontSize: 11,
                                    }}
                                >
                                    q{index}
                                </span>

                                <div style={{ display: 'flex', gap: 3 }}>
                                    <PresetButton
                                        label="|0⟩"
                                        active={input.preset === 'zero'}
                                        onClick={() => setQubitPreset(index, 'zero')}
                                    />
                                    <PresetButton
                                        label="|1⟩"
                                        active={input.preset === 'one'}
                                        onClick={() => setQubitPreset(index, 'one')}
                                    />
                                    <PresetButton
                                        label="|+⟩"
                                        active={input.preset === 'plus'}
                                        onClick={() => setQubitPreset(index, 'plus')}
                                    />
                                    <PresetButton
                                        label="|-⟩"
                                        active={input.preset === 'minus'}
                                        onClick={() => setQubitPreset(index, 'minus')}
                                    />
                                </div>
                            </div>

                            {/* Sliders */}
                            <SliderRow
                                label="θ"
                                value={thetaDeg}
                                min={0}
                                max={180}
                                onChange={(deg) =>
                                    updateQubitInput(index, {
                                        theta: (deg * Math.PI) / 180,
                                    })
                                }
                            />

                            <SliderRow
                                label="φ"
                                value={phiDeg}
                                min={0}
                                max={360}
                                onChange={(deg) =>
                                    updateQubitInput(index, {
                                        phi: (deg * Math.PI) / 180,
                                    })
                                }
                            />
                        </div>

                        {/* Bloch sphere */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: 2,
                            }}
                        >
                            <QubitVisualization index={index} size={90} />
                        </div>
                    </div>
                );
            })}

            {/* --- GlobalStateColumn --- */}

                <GlobalStateColumn
                    col={currentCol ?? 0}
                    title={title}
                    labels={labels}
                normalized={normalized}
                />
       
        </div>
    );
}

type PresetButtonProps = {
    label: string;
    active: boolean;
    onClick: () => void;
};

function PresetButton({ label, active, onClick }: PresetButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{
                padding: '1px 4px',
                borderRadius: 3,
                border: active ? '1px solid #4fc3f7' : '1px solid #444',
                background: active ? 'rgba(79, 195, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: '#eee',
                fontSize: 10,
                cursor: 'pointer',
            }}
        >
            {label}
        </button>
    );
}

type SliderRowProps = {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
};

function SliderRow({ label, value, min, max, onChange }: SliderRowProps) {
    return (
        <label
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
            }}
        >
            <span style={{ width: 12, fontSize: 10 }}>{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{ flex: 1 }}
            />
            <span style={{ width: 28, textAlign: 'right', opacity: 0.8, fontSize: 10 }}>
                {value.toFixed(0)}°
            </span>
        </label>
    );
}
