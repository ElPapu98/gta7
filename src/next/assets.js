// Explicitly licensed public scans. Each source is attributed in the UI.
export const CAPTURES = Object.freeze({
  apartment: {
    title: 'Apartamento', description: 'Captura de interior · 661 mil gaussianas · 8,4 MB',
    url: 'https://raw.githubusercontent.com/playcanvas/engine/main/examples/assets/splats/apartment.sog',
    author: 'Stephane Agullo (sa3d.fr)', license: 'CC BY 4.0',
    source: 'https://superspl.at/view?id=cdcec084',
    camera: { target: [0, -0.3, 0], distance: 8.6, yaw: 34, pitch: 13 },
    walking: { position: [0, -1.6, 1.2], bounds: [2.8, 2.6] }
  },
  hall: {
    title: 'Centro comunitario', description: 'Escenario escaneado · aproximadamente 28 MB',
    url: 'https://raw.githubusercontent.com/playcanvas/engine/main/examples/assets/splats/knock-community-hall.sog',
    author: 'scbenoit', license: 'CC BY 4.0',
    source: 'https://superspl.at/scene/0ff2e6dc',
    camera: { target: [0, 0, 0], distance: 13, yaw: 40, pitch: 19 },
    // Until a matching collision mesh is authored, movement is restricted to
    // an inspection volume and must not be described as physics-based walking.
    walking: { position: [0, 0, 2], bounds: [5, 5] }
  }
});

export function validateCapture(capture) {
  return Boolean(capture && /^https:\/\//.test(capture.url) &&
    /^CC BY 4\.0$/.test(capture.license) && capture.author && capture.source);
}
