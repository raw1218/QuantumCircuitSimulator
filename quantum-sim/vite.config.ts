import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/

export default defineConfig({
    base: '/QuantumCircuitSimulator/quantum-sim', // or '/quantum-sim/'
    plugins: [react()],
});
