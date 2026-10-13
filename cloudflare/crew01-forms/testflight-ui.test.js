import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../../testflight/testflight.js", import.meta.url), "utf8");
function page(fetch, verified = true) {
  const elements = Object.fromEntries(["beta-form", "beta-submit", "beta-status", "beta-success"].map(id => [id, { hidden: id === "beta-success", disabled: true, dataset: {}, focus() { this.focused = true; } }]));
  const form = elements["beta-form"];
  form.action = "https://forms.fieldbox.app/testflight/join";
  form.reportValidity = () => true;
  form.addEventListener = (_, callback) => { form.submit = callback; };
  let loaded, config, resets = 0;
  const turnstile = { render(_, options) { config = options; return "widget"; }, reset() { resets++; } };
  const window = { addEventListener(_, callback) { loaded = callback; }, turnstile: verified ? turnstile : undefined };
  vm.runInNewContext(source, { window, document: { getElementById: id => elements[id] }, fetch, FormData: class { set() {} }, AbortSignal });
  loaded();
  if (verified) config.callback("verified-test-token");
  return { elements, submit: () => form.submit({ preventDefault() {} }), resets: () => resets };
}
test("the browser only shows received after a confirmed successful save", async () => {
  const p = page(async () => ({ ok: true, json: async () => ({ ok: true }) }));
  await p.submit();
  assert.equal(p.elements["beta-form"].hidden, true);
  assert.equal(p.elements["beta-success"].hidden, false);
  assert.equal(p.elements["beta-success"].focused, true);
});
test("storage and network failures keep the application visible and reset verification", async () => {
  for (const fetch of [async () => ({ ok: false, json: async () => ({ ok: false, error: "Storage unavailable" }) }), async () => { const error = new Error("Network failure"); error.name = "TypeError"; throw error; }]) {
    const p = page(fetch);
    await p.submit();
    assert.equal(p.elements["beta-form"].hidden, false);
    assert.equal(p.elements["beta-success"].hidden, true);
    assert.equal(p.elements["beta-submit"].disabled, true);
    assert.equal(p.resets(), 1);
    assert.equal(p.elements["beta-status"].dataset.error, "true");
  }
});
test("unavailable verification cannot submit an application", async () => {
  const p = page(() => { throw new Error("Must not submit"); }, false);
  await p.submit();
  assert.equal(p.elements["beta-submit"].disabled, true);
  assert.equal(p.elements["beta-success"].hidden, true);
});
