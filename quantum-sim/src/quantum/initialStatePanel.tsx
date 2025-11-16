// e.g. src/quantum/InitialStatePanel.tsx

import React, { useState } from "react";
import {
  QubitState,
  qubitPresets,
  blochFromState,
} from "./qubitState";
import { InitialStateControls } from "./InitialStateControls";
import { BlochSphereView } from "./BlochSphereView";

export const InitialStatePanel: React.FC = () => {
  const [state, setState] = useState<QubitState>(
    qubitPresets[0].state // default |0⟩
  );

  const bloch = blochFromState(state);

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <InitialStateControls state={state} onStateChange={setState} />
      <BlochSphereView bloch={bloch} />
    </div>
  );
};
