import { configure } from '@zip.js/zip.js';

// Force in-thread compression in tests so timing is deterministic and we
// don't depend on the test environment's Worker behavior.
configure({ useWebWorkers: false });
