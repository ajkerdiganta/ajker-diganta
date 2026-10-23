import { describe, expect, it } from "vitest";
import { readBoundedBytes, readBoundedJson } from "@/lib/request-json";

function streamedRequest(chunks: Uint8Array[], headers?: HeadersInit) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("https://example.test/api", { method: "POST", headers, body, duplex: "half" } as RequestInit & { duplex: "half" });
}

describe("bounded JSON request parsing", () => {
  it("parses valid UTF-8 JSON and rejects malformed or invalid UTF-8 input", async () => {
    expect(await readBoundedJson(new Request("https://example.test/api", { method: "POST", body: JSON.stringify({ headline: "বাংলাদেশ" }) }))).toEqual({ headline: "বাংলাদেশ" });
    expect(await readBoundedJson(new Request("https://example.test/api", { method: "POST", body: "{" }))).toBeNull();
    expect(await readBoundedJson(streamedRequest([new Uint8Array([0xc3, 0x28])]))).toBeNull();
  });

  it("rejects bodies that exceed the byte ceiling even when Content-Length is absent", async () => {
    const request = streamedRequest([new Uint8Array(6), new Uint8Array(6)]);
    expect(request.headers.has("content-length")).toBe(false);
    expect(await readBoundedJson(request, 10)).toBeNull();
  });

  it("rejects declared oversize bodies before reading and still enforces actual bytes against dishonest lengths", async () => {
    expect(await readBoundedJson(streamedRequest([new TextEncoder().encode("{}")], { "content-length": "100" }), 10)).toBeNull();
    const dishonest = streamedRequest([new Uint8Array(11)], { "content-length": "1" });
    expect(await readBoundedJson(dishonest, 10)).toBeNull();
  });
});

describe("bounded binary upload reading", () => {
  it("accepts binary bytes exactly under the limit without requiring Content-Length", async () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    const request = streamedRequest([bytes.slice(0, 2), bytes.slice(2)]);
    expect(request.headers.has("content-length")).toBe(false);
    expect(await readBoundedBytes(request, bytes.length)).toEqual(bytes);
  });

  it("rejects actual bytes beyond the ceiling and dishonest declared length", async () => {
    expect(await readBoundedBytes(streamedRequest([new Uint8Array(11)]), 10)).toBeNull();
    expect(await readBoundedBytes(streamedRequest([new Uint8Array(6)], { "content-length": "100" }), 10)).toBeNull();
  });
});
