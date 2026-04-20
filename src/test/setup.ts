import { configure } from '@zip.js/zip.js';

// jsdom doesn't implement the Worker API. Without this, @zip.js spawns a
// worker that silently produces malformed archives, and ZipReader fails with
// "File format is not recognized" — but only in headless CI, because some
// platforms (e.g. macOS Node 25) happen to fall back to in-thread compression.
// Forcing useWebWorkers off makes test behavior identical across environments.
configure({ useWebWorkers: false });
