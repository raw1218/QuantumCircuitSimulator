import { useEffect, useState } from 'react';

export type QubitPreset = 'zero' | 'one' | 'plus' | 'minus' | 'plusI' | 'minusI';

export type QubitInput = {
    theta: number;  // radians
    phi: number;    // radians
    preset: QubitPreset | null;
};

export function useQubitInputs(nQubits: number) {
    const [qubitInputs, setQubitInputs] = useState<QubitInput[]>(() =>
        Array.from({ length: nQubits }, () => ({
            theta: 0,
            phi: 0,
            preset: 'zero',
        })),
    );

    // keep array length synced with nQubits
    useEffect(() => {
        setQubitInputs((prev) => {
            const next = [...prev];
            while (next.length < nQubits) {
                next.push({ theta: 0, phi: 0, preset: 'zero' });
            }
            return next.slice(0, nQubits);
        });
    }, [nQubits]);

    function updateQubitInput(index: number, partial: Partial<QubitInput>) {
        setQubitInputs((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], ...partial, preset: null };
            return next;
        });
    }

    function setQubitPreset(index: number, preset: QubitPreset) {
        const π = Math.PI;
        const presets: Record<QubitPreset, { theta: number; phi: number }> = {
            zero: { theta: 0, phi: 0 },
            one: { theta: π, phi: 0 },
            plus: { theta: π / 2, phi: 0 },
            minus: { theta: π / 2, phi: π },
            plusI: { theta: π / 2, phi: π / 2 },
            minusI: { theta: π / 2, phi: (3 * π) / 2 },
        };

        const { theta, phi } = presets[preset];

        setQubitInputs((prev) => {
            const next = [...prev];
            next[index] = { theta, phi, preset };
            return next;
        });
    }

    return { qubitInputs, updateQubitInput, setQubitPreset };
}