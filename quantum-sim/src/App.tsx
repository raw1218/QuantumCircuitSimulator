import { ReactFlowProvider } from '@xyflow/react';
import CircuitCanvas from './quantum/circuitCanvas.tsx';

export default function App() {
  return (
    <ReactFlowProvider>
      <CircuitCanvas />
    </ReactFlowProvider>
  );
}
