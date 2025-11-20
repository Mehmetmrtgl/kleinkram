// src/boot/wasm-polyfill.ts
import { boot } from 'quasar/wrappers';

export default boot(() => {
    // Hack: The Foxglove libraries use a pattern where they try to `require` the .wasm file.
    // vite-plugin-wasm transforms imports, but if any 'require' remains in the excluded code, this catches it.
    if (typeof window !== 'undefined' && !(window as any).require) {
        (window as any).require = (mod: string) => {
            console.warn(`Blocked require call for: ${mod}`);
            // Return a dummy object or throw depending on what the lib expects.
            // Usually for WASM libs, the vite plugin intercepts the actual file load,
            // so this might just catch side-effect requires.
            return {};
        };
    }
});
