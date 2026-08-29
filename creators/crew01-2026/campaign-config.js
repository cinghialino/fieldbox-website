window.FieldboxCrew01 = Object.freeze({
  campaignId: "crew01-2026",
  status: "open",
  enrollmentEmbedUrl: "https://docs.google.com/forms/d/e/1FAIpQLScs4NE3ifV33zTtlOkd7UNDHmjZOMsCVKX8QigdQ7pbFG_u0A/viewform?embedded=true",
  enrollmentDirectUrl: "https://docs.google.com/forms/d/e/1FAIpQLScs4NE3ifV33zTtlOkd7UNDHmjZOMsCVKX8QigdQ7pbFG_u0A/viewform",
  submissionEmbedUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeRIkrfjP_QfUTzDRgUA9LhzvEDq0a2Ovps6p7e9rp_PvkIFQ/viewform?embedded=true",
  submissionDirectUrl: "https://docs.google.com/forms/d/e/1FAIpQLSeRIkrfjP_QfUTzDRgUA9LhzvEDq0a2Ovps6p7e9rp_PvkIFQ/viewform",
});

window.renderCrew01Form = function renderCrew01Form(kind) {
  const mount = document.querySelector("[data-campaign-form]");
  if (!mount) return;

  const config = window.FieldboxCrew01;
  if (config.status === "closed") {
    mount.innerHTML = '<div class="form-placeholder"><strong>This campaign has closed.</strong><br>The Crew01 pages remain available for campaign records, but responses are no longer accepted.</div>';
    return;
  }

  const embedUrl = kind === "enrollment" ? config.enrollmentEmbedUrl : config.submissionEmbedUrl;
  const directUrl = kind === "enrollment" ? config.enrollmentDirectUrl : config.submissionDirectUrl;
  if (!embedUrl) {
    mount.innerHTML = '<div class="form-placeholder"><strong>The Crew01 form is being prepared.</strong><br>If you received an invitation, reply to that email or contact <a href="mailto:support@fieldbox.app">support@fieldbox.app</a>.</div>';
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.className = "form-frame";
  iframe.src = embedUrl;
  iframe.title = kind === "enrollment" ? "Fieldbox Crew01 enrollment form" : "Fieldbox Crew01 video submission form";
  iframe.loading = "eager";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  mount.appendChild(iframe);

  if (directUrl) {
    const fallback = document.createElement("p");
    fallback.className = "notice";
    fallback.innerHTML = `If the form does not load, <a href="${directUrl}" rel="noopener noreferrer">open it directly</a>.`;
    mount.appendChild(fallback);
  }
};
