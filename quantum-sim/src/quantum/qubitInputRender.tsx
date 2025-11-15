// qubitInputRender.tsx
import React from 'react';
import { useCircuitContext } from './circuitCanvas';
import { QubitVisualization } from './QubitVisualization';

function formatDegrees(rad: number): string {
    const deg = (rad * 180) / Math.PI;
    return deg.toFixed(0);
}

export function QubitInputsColumn() {
    const {
        nQubits,
        qubitInputs,
        updateQubitInput,
        setQubitPreset,
    } = useCircuitContext();

    if (!qubitInputs || qubitInputs.length === 0) {
        return null;
    }

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '8px 12px',
                borderRight: '1px solid #222',
                background: 'rgba(5, 7, 9, 0.95)',
                color: '#eee',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 12,
                height: '100%',
                boxSizing: 'border-box',
            }}
        >
            <div
                style={{
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 4,
                }}
            >
                Qubit Inputs
            </div>

            {Array.from({ length: nQubits }).map((_, index) => {
                const input = qubitInputs[index];
                if (!input) return null;

                const thetaDeg = (input.theta * 180) / Math.PI;
                const phiDeg = (input.phi * 180) / Math.PI;

                return (
                    <div
                        key={index}
                        style={{
                            padding: '6px 8px',
                            borderRadius: 6,
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                        }}
                    >
                        {/* Top: controls */}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                            }}
                        >
                            {/* Header row: q index + presets */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <span style={{ fontWeight: 500 }}>q{index}</span>

                                <div style={{ display: 'flex', gap: 4 }}>
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

                            {/* Sliders for θ and φ */}
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

                            {/* numeric readout */}
                            <div
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    opacity: 0.7,
                                }}
                            >
                                <span>θ = {formatDegrees(input.theta)}°</span>
                                <span>φ = {formatDegrees(input.phi)}°</span>
                            </div>
                        </div>

                        {/* Bottom: Bloch sphere visualization, centered */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'center',
                                marginTop: 4,
                            }}
                        >
                            <QubitVisualization index={index} />
                        </div>
                    </div>
                );
            })}
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
                padding: '2px 6px',
                borderRadius: 4,
                border: active ? '1px solid #4fc3f7' : '1px solid #444',
                background: active ? 'rgba(79, 195, 247, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                color: '#eee',
                fontSize: 11,
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
                gap: 6,
            }}
        >
            <span style={{ width: 12 }}>{label}</span>
            <input
                type="range"
                min={min}
                max={max}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                style={{ flex: 1 }}
            />
            <span style={{ width: 34, textAlign: 'right', opacity: 0.8 }}>
                {value.toFixed(0)}°
            </span>
        </label>
    );
}
