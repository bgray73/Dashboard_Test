import assert from "node:assert/strict";
import { it } from "node:test";
import viteConfig from "./vite.config";

it("proxies API requests to the documented port by default", () => {
  const proxy = viteConfig.server?.proxy;
  assert(proxy && typeof proxy === "object");
  const apiProxy = proxy["/api"];
  assert(apiProxy && typeof apiProxy === "object");
  assert.equal(apiProxy.target, "http://localhost:5000");
});
