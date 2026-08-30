window.FieldboxCrew01 = Object.freeze({
  campaignId: "crew01-2026",
  status: "open",
});

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

  const responseFrame = document.querySelector("[data-campaign-response]");
  const submitButton = form.querySelector('button[type="submit"]');
  const status = form.querySelector("[data-form-status]");
  let submitted = false;

  if (kind === "submission") {
    const platform = form.querySelector('[name="entry.48567142"]');
    const videoUrl = form.querySelector('[name="entry.456098895"]');
    const publishedDate = form.querySelector('[name="published-date"]');
    const dateYear = form.querySelector('[name="entry.731381614_year"]');
    const dateMonth = form.querySelector('[name="entry.731381614_month"]');
    const dateDay = form.querySelector('[name="entry.731381614_day"]');

    videoUrl.addEventListener("input", () => videoUrl.setCustomValidity(""));

    form.addEventListener("submit", (event) => {
      if (!window.isCrew01VideoUrl(platform.value, videoUrl.value)) {
        videoUrl.setCustomValidity(`Enter a public ${platform.value} video link that matches the selected platform.`);
        videoUrl.reportValidity();
        event.preventDefault();
        return;
      }

      const [year, month, day] = publishedDate.value.split("-");
      dateYear.value = year;
      dateMonth.value = month;
      dateDay.value = day;
    });
  }

  form.addEventListener("submit", () => {
    if (!form.checkValidity()) return;
    submitted = true;
    submitButton.disabled = true;
    submitButton.textContent = "Sending…";
    status.textContent = "Sending your information to Fieldbox…";
    status.classList.remove("form-error");
  });

  responseFrame.addEventListener("load", () => {
    if (!submitted) return;
    const successHeading = form.dataset.successHeading;
    const successBody = form.dataset.successBody;
    form.innerHTML = `<div class="form-success" role="status"><strong>${successHeading}</strong><p>${successBody}</p></div>`;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });
};
