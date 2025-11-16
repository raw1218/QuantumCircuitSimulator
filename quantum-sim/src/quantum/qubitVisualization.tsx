// QubitVisualization.tsx
import React from 'react';
import { useCircuitContext } from './circuitCanvas';

type QubitVisualizationProps = {
    index: number;
    size?: number; // optional, default to 90
};

export const QubitVisualization: React.FC<QubitVisualizationProps> = ({
    index,
    size: sizeProp,
}) => {
    const { qubitInputs } = useCircuitContext();
    const input = qubitInputs[index];
    if (!input) return null;

    const { theta, phi } = input;

    // Bloch vector components
    // |ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩
    // x = sinθ cosφ, y = sinθ sinφ, z = cosθ
    const x = Math.sin(theta) * Math.cos(phi);
    const y = Math.sin(theta) * Math.sin(phi);
    const z = Math.cos(theta);

    const size = sizeProp ?? 90;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * (30 / 90); // scale radius with size (was 30 when size=90)

    // Project (x, z) into 2D: x horizontal, z vertical
    const endX = cx + x * radius;
    const endY = cy - z * radius; // minus because SVG y+ is down

    const deg = (rad: number) => (rad * 180) / Math.PI;

    const gradId = `blochSphereGrad-${index}`;

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                fontSize: 11,
                color: '#eee',
                alignItems: 'center',
                // no minWidth so it can shrink inside the left column
            }}
        >
            {/* Label + θ, φ */}
            <div
                style={{
                    fontSize: 10,
                    opacity: 0.75,
                }}
            >
                q{index}: θ={deg(theta).toFixed(0)}°, φ={deg(phi).toFixed(0)}°
            </div>

            <svg
                width={size}
                height={size}
                viewBox={`0 0 ${size} ${size}`}
                style={{ display: 'block' }}
            >
                <defs>
                    {/* Radial gradient for fake 3D shading */}
                    <radialGradient id={gradId} cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#1e293b" />
                        <stop offset="70%" stopColor="#020617" />
                        <stop offset="100%" stopColor="#000000" />
                    </radialGradient>
                </defs>

                {/* Main sphere */}
                <circle
                    cx={cx}
                    cy={cy}
                    r={radius}
                    fill={`url(#${gradId})`}
                    stroke="rgba(148, 163, 184, 0.9)"
                    strokeWidth={1}
                />

                {/* Equator (horizontal ellipse) */}
                <ellipse
                    cx={cx}
                    cy={cy}
                    rx={radius}
                    ry={radius * 0.35}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.5)"
                    strokeWidth={0.6}
                />

                {/* Vertical great circle (meridian) */}
                <ellipse
                    cx={cx}
                    cy={cy}
                    rx={radius * 0.35}
                    ry={radius}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.35)"
                    strokeWidth={0.6}
                />

                {/* Extra "latitude" lines for 3D grid feel */}
                <ellipse
                    cx={cx}
                    cy={cy - radius * 0.3}
                    rx={radius * 0.8}
                    ry={radius * 0.25}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.18)"
                    strokeWidth={0.5}
                />
                <ellipse
                    cx={cx}
                    cy={cy + radius * 0.3}
                    rx={radius * 0.8}
                    ry={radius * 0.25}
                    fill="none"
                    stroke="rgba(148, 163, 184, 0.18)"
                    strokeWidth={0.5}
                />

                {/* Axes arrows labels (Z up/down, X left/right) */}
                {/* Z+ */}
                <line
                    x1={cx}
                    y1={cy - radius}
                    x2={cx}
                    y2={cy - radius - 6}
                    stroke="rgba(148,163,184,0.7)"
                    strokeWidth={0.7}
                />
                <text
                    x={cx - 2}
                    y={cy - radius - 9}
                    fontSize={7}
                    fill="rgba(148,163,184,0.9)"
                >
                    Z
                </text>

                {/* X+ */}
                <line
                    x1={cx + radius}
                    y1={cy}
                    x2={cx + radius + 6}
                    y2={cy}
                    stroke="rgba(148,163,184,0.7)"
                    strokeWidth={0.7}
                />
                <text
                    x={cx + radius + 8}
                    y={cy + 3}
                    fontSize={7}
                    fill="rgba(148,163,184,0.9)"
                >
                    X
                </text>

                {/* Bloch vector */}
                <line
                    x1={cx}
                    y1={cy}
                    x2={endX}
                    y2={endY}
                    stroke="#38bdf8"
                    strokeWidth={2}
                />
                <circle cx={endX} cy={endY} r={3} fill="#38bdf8" />

                {/* Center dot */}
                <circle cx={cx} cy={cy} r={1.6} fill="rgba(148,163,184,0.9)" />
            </svg>

            {/* xyz readout */}
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 6,
                    fontSize: 9,
                    opacity: 0.8,
                }}
            >
                <span>x={x.toFixed(2)}</span>
                <span>y={y.toFixed(2)}</span>
                <span>z={z.toFixed(2)}</span>
            </div>
        </div>
    );
};
