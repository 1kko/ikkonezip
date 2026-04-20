import { configure } from '@zip.js/zip.js';
// Vite's ?url suffix copies the worker file into /assets and returns a
// same-origin URL. The native variant uses CompressionStream so we don't
// ship the WASM deflate fallback in the worker.
import workerURI from '@zip.js/zip.js/dist/zip-web-worker-native.js?url';

// By default zip.js inlines its worker as a data:text/javascript URI,
// which our CSP (worker-src 'self' blob:) correctly blocks. Pointing
// workerURI at a same-origin file lets workers run without weakening CSP.
configure({ workerURI });
