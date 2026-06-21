import './App.css';
import { CameraView } from './components/CameraView';

export default function App() {
  return (
    <div className="app-root">
      <header className="app-header" aria-label="ERC-7 Camouflage Simulator">
        VIGIL-07 · ERC-7 Camouflage Simulator
      </header>
      <main className="app-main">
        <CameraView />
      </main>
    </div>
  );
}