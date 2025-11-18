// e.g. src/quantum/InitialStatePanel.tsx

import React, { useState} from "react";
import {
  type QubitState,
  type BlochCoords,
  blochFromState,
  stateFromBloch,
  qubitPresets,
} from "./backend/qubitState";
import { InitialStateControls } from "./initialStateControls";
import { BlochSphereView } from "./blochSphereVisualization";

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
