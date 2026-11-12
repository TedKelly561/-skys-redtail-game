/**
 * Troubleshooting switches, only active when added to the link, e.g.
 *   …/-skys-redtail-game/?debug            shows a small readout (frame speed, sharpness, camera)
 *   …/?debug&nobuddy&nolearn                turns features off one at a time to find a problem
 * Normal play never uses these.
 */
const params = (() => {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
})();

export const debugFlag = (name: string) => params.has(name);
