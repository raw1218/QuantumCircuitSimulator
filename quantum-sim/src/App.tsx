import { ReactFlowProvider } from '@xyflow/react';
import { CircuitCanvas, CircuitProvider } from './quantum/circuitCanvas.tsx';


export default function App() {
  return (
      <ReactFlowProvider>
    <CircuitProvider>
              <CircuitCanvas />
      </CircuitProvider>
    </ReactFlowProvider>
  );
}
