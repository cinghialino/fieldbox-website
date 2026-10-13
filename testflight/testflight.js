(() => {
  const form = document.getElementById("beta-form");
  const button = document.getElementById("beta-submit");
  const status = document.getElementById("beta-status");
  let token = "";
  let widget;
  let submitting = false;
  const message = (text, error = false) => {
    status.textContent = text;
    status.dataset.error = String(error);
  };
  const clearVerification = () => {
    token = "";
    button.disabled = true;
  };
  const renderVerification = () => {
    if (!window.turnstile) {
      message("Verification couldn’t load. Refresh the page or contact support@fieldbox.app.", true);
      return;
    }
    widget = window.turnstile.render("#beta-verification", {
      sitekey: "0x4AAAAAAEiYQgXh-9kj-ePf",
      action: "testflight_join", theme: "dark", size: "flexible",
      callback: (value) => { token = value; button.disabled = submitting; message("Ready when you are."); },
      "expired-callback": () => { clearVerification(); message("Verification expired. Complete it again to apply."); },
      "error-callback": () => { clearVerification(); message("Verification couldn’t complete. Refresh the page and try again.", true); }
    });
  };
  window.addEventListener("load", renderVerification, { once: true });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!token) { message("Complete the verification to apply.", true); return; }
    submitting = true;
    button.disabled = true;
    message("Sending your application…");
    const body = new FormData(form);
    body.set("cf-turnstile-response", token);
    try {
      const response = await fetch(form.action, { method: "POST", body, headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(result.error || "We couldn’t save your application. Please try again.");
      form.hidden = true;
      const success = document.getElementById("beta-success");
      success.hidden = false;
      success.focus();
    } catch (error) {
      message(error.name === "TimeoutError" || error.name === "TypeError" ? "We couldn’t confirm your application was saved. Please try again; retries won’t create duplicate applications." : error.message, true);
      clearVerification();
      if (window.turnstile && widget !== undefined) window.turnstile.reset(widget);
    } finally { submitting = false; }
  });
})();
