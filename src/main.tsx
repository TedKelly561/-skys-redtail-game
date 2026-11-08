import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Listen for the browser's install offer from the very start.
import './game/install';

createRoot(document.getElementById('root')!).render(<App />);

// Lets the game be added to the home screen and open like an app (published site only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const page = location.href.split('#')[0];
        const files = performance.getEntriesByType('resource').map((e) => e.name);
        reg.active?.postMessage({ type: 'cache-these', urls: [page, ...files] });
      })
      .catch(() => {
        // The game works fine without it.
      });
  });
}
