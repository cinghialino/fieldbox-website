import assert from "node:assert/strict";
import test from "node:test";

import worker from "./worker.js";

const ENV = { TURNSTILE_SECRET: "test-secret" };
const ORIGINAL_FETCH = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

test("rejects requests from an unapproved origin", async () => {
  const response = await worker.fetch(
    new Request("https://forms.fieldbox.app/crew01/enroll", {
      method: "POST",
      headers: { Origin: "https://example.com" },
      body: enrollmentData(),
    }),
    ENV
  );

  assert.equal(response.status, 403);
});

test("requires a Turnstile token", async () => {
  const data = enrollmentData();
  data.delete("cf-turnstile-response");
  const response = await worker.fetch(formRequest("/crew01/enroll", data), ENV);

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /verification/i);
});

test("rejects a Turnstile result for the wrong action", async () => {
  globalThis.fetch = async () =>
    Response.json({ success: true, hostname: "fieldbox.app", action: "wrong_action" });

  const response = await worker.fetch(
    formRequest("/crew01/enroll", enrollmentData()),
    ENV
  );

  assert.equal(response.status, 403);
});

test("forwards a verified enrollment without exposing the Turnstile token", async () => {
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    if (String(input).includes("/siteverify")) {
      assert.equal(init.body.get("secret"), ENV.TURNSTILE_SECRET);
      assert.equal(init.body.get("response"), "verified-token");
      return Response.json({
        success: true,
        hostname: "fieldbox.app",
        action: "crew01_enroll",
      });
    }

    assert.equal(init.body.get("entry.1157804745"), "Fieldbox Worker Test");
    assert.equal(init.body.has("cf-turnstile-response"), false);
    return new Response(null, { status: 200 });
  };

  const response = await worker.fetch(
    formRequest("/crew01/enroll", enrollmentData()),
    ENV
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
  assert.equal(calls.length, 2);
});

test("rejects a video URL that does not match the selected platform", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return Response.json({ success: true });
  };

  const data = submissionData();
  data.set("entry.48567142", "Instagram");
  data.set("entry.456098895", "https://www.tiktok.com/@fieldbox/video/1234567890");

  const response = await worker.fetch(formRequest("/crew01/submit", data), ENV);

  assert.equal(response.status, 400);
  assert.equal(fetchCalled, false);
});

function formRequest(path, body) {
  return new Request(`https://forms.fieldbox.app${path}`, {
    method: "POST",
    headers: { Origin: "https://fieldbox.app" },
    body,
  });
}

function enrollmentData() {
  const data = new FormData();
  data.set("entry.1157804745", "Fieldbox Worker Test");
  data.set("entry.1018500871", "creators@fieldbox.app");
  data.set("entry.204697437", "Instagram");
  data.set("entry.795691013", "Photography");
  data.set("entry.1189892332", "United States");
  data.set("entry.415997136", "I have read and agree to the Crew01 terms at https://fieldbox.app/creators/crew01-2026/terms/");
  data.set("entry.1853858981", "Fieldbox may email me about Crew01 enrollment, access, submissions, rewards, and feedback.");
  data.set("cf-turnstile-response", "verified-token");
  data.set("fvv", "1");
  data.set("pageHistory", "0");
  return data;
}

function submissionData() {
  const data = new FormData();
  data.set("entry.1364169378", "Fieldbox Worker Test");
  data.set("entry.194434320", "creators@fieldbox.app");
  data.set("entry.48567142", "Instagram");
  data.set("entry.456098895", "https://www.instagram.com/reel/FIELDBOXTEST/");
  data.set("entry.731381614_year", "2026");
  data.set("entry.731381614_month", "8");
  data.set("entry.731381614_day", "30");
  data.set("entry.533384280", "20");
  for (const value of [
    "The video is public.",
    "The caption includes #FieldboxBackup.",
    "The caption includes #FieldboxCrew01.",
    "Fieldbox is a meaningful part of the video.",
    "The video clearly discloses that Fieldbox provided complimentary access.",
  ]) {
    data.append("entry.1873563230", value);
  }
  data.set("cf-turnstile-response", "verified-token");
  return data;
}
