// src/quantum/InitialStateControls.tsx

import React, { useMemo } from "react";
import {
  type QubitState,
  type BlochCoords,
  blochFromState,
  stateFromBloch,
  qubitPresets,
} from "./backend/qubitState";

export interface InitialStateControlsProps {
  state: QubitState;
  onStateChange: (next: QubitState) => void;
}

function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export const InitialStateControls: React.FC<InitialStateControlsProps> = ({
  state,
  onStateChange,
}) => {
  // Always recompute Bloch coords from the current state
  const bloch: BlochCoords = useMemo(
    () => blochFromState(state),
    [state]
  );

  const thetaDeg = radToDeg(bloch.theta);
  const phiDeg = radToDeg(bloch.phi);

  const handleThetaChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextThetaDeg = Number(event.target.value);
    const nextTheta = degToRad(nextThetaDeg);
    const nextBloch: BlochCoords = {
      theta: nextTheta,
      phi: bloch.phi,
    };
    onStateChange(stateFromBloch(nextBloch));
  };

  const handlePhiChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const nextPhiDeg = Number(event.target.value);
    const nextPhi = degToRad(nextPhiDeg);
    const nextBloch: BlochCoords = {
      theta: bloch.theta,
      phi: nextPhi,
    };
    onStateChange(stateFromBloch(nextBloch));
  };

  const handlePresetClick = (presetState: QubitState) => {
    onStateChange(presetState);
  };

  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        padding: "0.75rem",
        borderRadius: 8,
        border: "1px solid #ddd",
        maxWidth: 420,
      }}
    >
      <div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          Initial Qubit State
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          Choose a preset or tweak the Bloch sphere angles.
        </div>
      </div>

      {/* Presets */}
      <div>
        <div style={{ fontSize: 12, marginBottom: 4 }}>Presets</div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
          }}
        >
          {qubitPresets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handlePresetClick(preset.state)}
              style={{
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #ccc",
                background: "#f8f8f8",
                cursor: "pointer",
                fontSize: 12,
              }}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sliders */}
      <div>
        <div style={{ fontSize: 12, marginBottom: 4 }}>
          Bloch Sphere Angles
        </div>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 12,
            marginBottom: 8,
          }}
        >
          θ (polar, 0° = |0⟩, 180° = |1⟩)
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={180}
              value={thetaDeg}
              onChange={handleThetaChange}
              style={{ flex: 1 }}
            />
            <span style={{ width: 40, textAlign: "right" }}>
              {thetaDeg.toFixed(1)}°
            </span>
          </div>
        </label>

        <label
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 12,
          }}
        >
          φ (azimuth, 0°–360°)
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={360}
              value={phiDeg}
              onChange={handlePhiChange}
              style={{ flex: 1 }}
            />
            <span style={{ width: 40, textAlign: "right" }}>
              {phiDeg.toFixed(1)}°
            </span>
          </div>
        </label>
      </div>

      {/* Optional: show α, β */}
      <div style={{ fontSize: 12, color: "#555" }}>
        <div style={{ marginBottom: 2 }}>State vector</div>
        <code style={{ fontSize: 11 }}>
          |ψ⟩ = ({state.alpha.re.toFixed(3)}{" "}
          {state.alpha.im >= 0 ? "+" : "-"}{" "}
          {Math.abs(state.alpha.im).toFixed(3)}i) |0⟩
          {"  +  "}
          ({state.beta.re.toFixed(3)}{" "}
          {state.beta.im >= 0 ? "+" : "-"}{" "}
          {Math.abs(state.beta.im).toFixed(3)}i) |1⟩
        </code>
      </div>
    </div>
  );
};
