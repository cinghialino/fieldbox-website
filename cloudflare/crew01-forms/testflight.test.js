import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import worker from "./worker.js";
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
function data() {
  return new URLSearchParams({ email: " TESTER@EXAMPLE.COM ", name: "Tester", device: "iPhone 16 Pro", setup: "Canon / SD / USB-C reader", workflow: "", contact_consent: "yes", offer_consent: "yes", "cf-turnstile-response": "test-token" });
}
function request(body = data(), origin = "https://fieldbox.app") {
  return new Request("https://forms.fieldbox.app/testflight/join", { method: "POST", headers: { Origin: origin }, body });
}
function database(t) {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("./migrations/0001_testflight.sql", import.meta.url), "utf8"));
  t.after(() => db.close());
  return { db, binding: { prepare: sql => ({ bind: (...args) => ({ run: async () => { db.prepare(sql).run(...args); return { success: true }; } }) }) } };
}
function verification(action = "testflight_join") {
  globalThis.fetch = async (url) => {
    assert.match(String(url), /turnstile.*siteverify/);
    return Response.json({ success: true, hostname: "fieldbox.app", action });
  };
}
test("persists only verified applications and retries do not overwrite or duplicate", async t => {
  const { db, binding } = database(t);
  verification();
  const env = { TURNSTILE_SECRET: "test", TESTFLIGHT_DB: binding };
  assert.equal((await worker.fetch(request(), env)).status, 200);
  const retry = data(); retry.set("setup", "Changed maliciously");
  assert.equal((await worker.fetch(request(retry), env)).status, 200);
  const rows = db.prepare("SELECT * FROM testflight_applications").all();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, "tester@example.com");
  assert.equal(rows[0].setup, "Canon / SD / USB-C reader");
  assert.equal(rows[0].status, "applied");
  assert.equal(rows[0].consent_version, "2026-10-12");
  assert.equal(Object.hasOwn(rows[0], "cf-turnstile-response"), false);
});
test("fails honestly when storage is unavailable or rejects the write", async () => {
  verification();
  assert.equal((await worker.fetch(request(), { TURNSTILE_SECRET: "test" })).status, 503);
  const env = { TURNSTILE_SECRET: "test", TESTFLIGHT_DB: { prepare() { throw new Error("storage failed"); } } };
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
});
test("requires both consents and valid unique bounded fields before verification", async () => {
  globalThis.fetch = () => { throw new Error("Verification should not be called"); };
  const env = { TURNSTILE_SECRET: "test", TESTFLIGHT_DB: {} };
  for (const change of [d => d.delete("contact_consent"), d => d.delete("offer_consent"), d => d.set("email", "invalid"), d => d.set("device", " "), d => d.set("setup", "x".repeat(2001)), d => d.append("email", "other@example.com"), d => d.set("unknown", "value"), d => d.delete("cf-turnstile-response")]) {
    const body = data(); change(body);
    assert.equal((await worker.fetch(request(body), env)).status, 400);
  }
});
test("wrong origin or Turnstile action cannot write", async t => {
  const { db, binding } = database(t);
  const env = { TURNSTILE_SECRET: "test", TESTFLIGHT_DB: binding };
  assert.equal((await worker.fetch(request(data(), "https://example.com"), env)).status, 403);
  verification("crew01_enroll");
  assert.equal((await worker.fetch(request(), env)).status, 403);
  assert.equal(db.prepare("SELECT count(*) AS n FROM testflight_applications").get().n, 0);
});
test("bounds streamed bodies without relying on Content-Length", async () => {
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); controller.close(); } });
  const req = new Request("https://forms.fieldbox.app/testflight/join", { method: "POST", headers: { Origin: "https://fieldbox.app", "Content-Type": "application/x-www-form-urlencoded" }, body, duplex: "half" });
  assert.equal((await worker.fetch(req, { TURNSTILE_SECRET: "test", TESTFLIGHT_DB: {} })).status, 413);
});
