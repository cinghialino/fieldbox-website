window.FieldboxCrew01 = Object.freeze({
  campaignId: "crew01-2026",
  status: "open",
});

window.onCrew01TurnstileSuccess = function onCrew01TurnstileSuccess() {
  const form = document.querySelector("[data-campaign-form]");
  if (!form) return;
  const submitButton = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-form-status]");
  submitButton.disabled = false;
  status.textContent = status.dataset.defaultText;
  status.classList.remove("form-error");
};

window.onCrew01TurnstileExpired = function onCrew01TurnstileExpired() {
  setCrew01VerificationPending("Verification expired. Please wait for it to refresh.");
};

window.onCrew01TurnstileError = function onCrew01TurnstileError() {
  setCrew01VerificationPending("Verification could not be completed. Please refresh the page and try again.", true);
};

window.onCrew01TurnstileUnsupported = function onCrew01TurnstileUnsupported() {
  setCrew01VerificationPending("This browser cannot complete verification. Try another browser or contact creators@fieldbox.app.", true);
};

function setCrew01VerificationPending(message, isError = false) {
  const form = document.querySelector("[data-campaign-form]");
  if (!form) return;
  form.querySelector('button[type="submit"]').disabled = true;
  const status = form.querySelector("[data-form-status]");
  status.textContent = message;
  status.classList.toggle("form-error", isError);
}

window.isCrew01VideoUrl = function isCrew01VideoUrl(platform, value) {
  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    return false;
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsedUrl.pathname;
  const isInstagramReel = hostname === "instagram.com" && /^\/reel\/[A-Za-z0-9_-]+\/?$/.test(path);
  const isTikTokVideo = hostname === "tiktok.com" && (/^\/@[^/]+\/video\/[0-9]+\/?$/.test(path) || /^\/t\/[A-Za-z0-9_-]+\/?$/.test(path));
  const isTikTokShortLink = (hostname === "vm.tiktok.com" || hostname === "vt.tiktok.com") && /^\/[A-Za-z0-9_-]+\/?$/.test(path);

  return platform === "Instagram" ? isInstagramReel : platform === "TikTok" && (isTikTokVideo || isTikTokShortLink);
};

window.renderCrew01Form = function renderCrew01Form(kind) {
  const form = document.querySelector("[data-campaign-form]");
  if (!form) return;

  const config = window.FieldboxCrew01;
  if (config.status === "closed") {
    form.outerHTML = '<div class="form-placeholder"><strong>This campaign has closed.</strong><br>The Crew01 pages remain available for campaign records, but responses are no longer accepted.</div>';
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-form-status]");
  status.dataset.defaultText = status.textContent;

  if (kind === "submission") {
    const platform = form.querySelector('[name="entry.48567142"]');
    const videoUrl = form.querySelector('[name="entry.456098895"]');
    const publishedDate = form.querySelector('[name="published-date"]');
    const dateYear = form.querySelector('[name="entry.731381614_year"]');
    const dateMonth = form.querySelector('[name="entry.731381614_month"]');
    const dateDay = form.querySelector('[name="entry.731381614_day"]');

    videoUrl.addEventListener("input", () => videoUrl.setCustomValidity(""));

    form.dataset.submissionPlatformField = platform.name;
    form.dataset.submissionVideoUrlField = videoUrl.name;
    form.dataset.submissionPublishedDateField = publishedDate.name;
    form.dataset.submissionDateYearField = dateYear.name;
    form.dataset.submissionDateMonthField = dateMonth.name;
    form.dataset.submissionDateDayField = dateDay.name;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    if (kind === "submission") {
      const platform = form.elements.namedItem(form.dataset.submissionPlatformField);
      const videoUrl = form.elements.namedItem(form.dataset.submissionVideoUrlField);
      if (!window.isCrew01VideoUrl(platform.value, videoUrl.value)) {
        videoUrl.setCustomValidity(`Enter a public ${platform.value} video link that matches the selected platform.`);
        videoUrl.reportValidity();
        return;
      }

      const publishedDate = form.elements.namedItem(form.dataset.submissionPublishedDateField);
      const [year, month, day] = publishedDate.value.split("-");
      form.elements.namedItem(form.dataset.submissionDateYearField).value = year;
      form.elements.namedItem(form.dataset.submissionDateMonthField).value = month;
      form.elements.namedItem(form.dataset.submissionDateDayField).value = day;
    }

    const formData = new FormData(form);
    if (!formData.get("cf-turnstile-response")) {
      status.textContent = "Complete the verification before submitting.";
      status.classList.add("form-error");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    status.textContent = "Sending your information to Fieldbox…";
    status.classList.remove("form-error");

    try {
      const response = await fetch(form.action, {
        method: "POST",
        body: formData,
        headers: { Accept: "application/json" },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Fieldbox could not record this submission. Please try again.");
      }

      const successHeading = form.dataset.successHeading;
      const successBody = form.dataset.successBody;
      form.innerHTML = `<div class="form-success" role="status"><strong>${successHeading}</strong><p>${successBody}</p></div>`;
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      status.textContent = error.message || "Fieldbox could not record this submission. Please try again.";
      status.classList.add("form-error");
      submitButton.textContent = kind === "enrollment" ? "Enroll in Crew01" : "Submit video";
      if (window.turnstile) window.turnstile.reset();
    }
  });
};
