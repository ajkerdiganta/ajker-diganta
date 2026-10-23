// Cloudflare Workers staging stub.
// The existing media finalizer uses native sharp and is not Workers-compatible.
// Keep that route disabled until Cloudflare Images or an external image-processing path replaces sharp.
export default function sharpUnavailable() {
  throw new Error("Native image processing is unavailable in the Cloudflare Workers runtime");
}
