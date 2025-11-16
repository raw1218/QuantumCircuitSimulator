// src/quantum/BlochSphereView.tsx

import React from "react";
import type { BlochCoords } from "./backend/qubitState";

export interface BlochSphereViewProps {
  bloch: BlochCoords;
  /** size of the SVG in pixels */
  size?: number;
}

export const BlochSphereView: React.FC<BlochSphereViewProps> = ({
  bloch,
  size = 220,
}) => {
  const { theta, phi } = bloch;

  const radius = size / 2 - 10;
  const center = size / 2;

  // Bloch vector in 3D:
  // x = sinθ cosφ, y = sinθ sinφ, z = cosθ
  const x = Math.sin(theta) * Math.cos(phi);
  const y = Math.sin(theta) * Math.sin(phi);
  const z = Math.cos(theta);

  // Simple orthographic projection: look down the y-axis
  // So horizontal = x, vertical = z
  const px = center + radius * x;
  const py = center - radius * z; // minus because SVG y grows downward

  const cx = center;
  const cy = center;

  return (
    <svg width={size} height={size}>
      {/* Outer circle: the Bloch sphere outline */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke="black"
        strokeWidth={1}
      />

      {/* Equator */}
      <ellipse
        cx={cx}
        cy={cy}
        rx={radius}
        ry={radius * 0.4}
        fill="none"
        stroke="#aaa"
        strokeDasharray="4 4"
      />

      {/* z-axis (vertical) */}
      <line
        x1={cx}
        y1={cy - radius}
        x2={cx}
        y2={cy + radius}
        stroke="#ccc"
        strokeWidth={1}
      />

      {/* x-axis (horizontal) */}
      <line
        x1={cx - radius}
        y1={cy}
        x2={cx + radius}
        y2={cy}
        stroke="#ccc"
        strokeWidth={1}
      />

      {/* Bloch vector line */}
      <line
        x1={cx}
        y1={cy}
        x2={px}
        y2={py}
        stroke="red"
        strokeWidth={2}
      />

      {/* Tip of the vector */}
      <circle cx={px} cy={py} r={4} fill="red" />

      {/* Small labels for axes */}
      <text x={cx + radius + 4} y={cy + 4} fontSize={10}>
        x
      </text>
      <text x={cx + 4} y={cy - radius - 4} fontSize={10}>
        z
      </text>
    </svg>
  );
};
