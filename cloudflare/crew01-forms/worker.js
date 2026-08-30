const ALLOWED_ORIGINS = new Set([
  "https://fieldbox.app",
  "https://www.fieldbox.app",
]);

const ROUTES = Object.freeze({
  "/crew01/enroll": {
    action: "crew01_enroll",
    googleFormUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLScs4NE3ifV33zTtlOkd7UNDHmjZOMsCVKX8QigdQ7pbFG_u0A/formResponse",
    allowedFields: new Set([
      "entry.1157804745",
      "entry.1018500871",
      "entry.381992298",
      "entry.1414636555",
      "entry.204697437",
      "entry.795691013",
      "entry.1189892332",
      "entry.415997136",
      "entry.1853858981",
      "fvv",
      "pageHistory",
    ]),
    validate: validateEnrollment,
  },
  "/crew01/submit": {
    action: "crew01_submit",
    googleFormUrl:
      "https://docs.google.com/forms/d/e/1FAIpQLSeRIkrfjP_QfUTzDRgUA9LhzvEDq0a2Ovps6p7e9rp_PvkIFQ/formResponse",
    allowedFields: new Set([
      "entry.1364169378",
      "entry.194434320",
      "entry.48567142",
      "entry.456098895",
      "entry.731381614_year",
      "entry.731381614_month",
      "entry.731381614_day",
      "entry.533384280",
      "entry.1873563230",
      "entry.77096670",
      "entry.1547100393",
      "fvv",
      "pageHistory",
    ]),
    validate: validateSubmission,
  },
});

const REQUIRED_SUBMISSION_CONFIRMATIONS = new Set([
  "The video is public.",
  "The caption includes #FieldboxBackup.",
  "The caption includes #FieldboxCrew01.",
  "Fieldbox is a meaningful part of the video.",
  "The video clearly discloses that Fieldbox provided complimentary access.",
]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const route = ROUTES[url.pathname];

    if (request.method === "OPTIONS") {
      return ALLOWED_ORIGINS.has(origin)
        ? new Response(null, { status: 204, headers: corsHeaders(origin) })
        : jsonResponse({ ok: false, error: "Origin not allowed." }, 403, origin);
    }

    if (!route) {
      return jsonResponse({ ok: false, error: "Not found." }, 404, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, 405, origin, {
        Allow: "POST, OPTIONS",
      });
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ ok: false, error: "Origin not allowed." }, 403, origin);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > 65536) {
      return jsonResponse({ ok: false, error: "Submission is too large." }, 413, origin);
    }

    if (!env.TURNSTILE_SECRET) {
      return jsonResponse({ ok: false, error: "Verification is unavailable." }, 503, origin);
    }

    let formData;
    try {
      formData = await request.formData();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid form submission." }, 400, origin);
    }

    const token = stringValue(formData.get("cf-turnstile-response"));
    if (!token || token.length > 2048) {
      return jsonResponse({ ok: false, error: "Complete the verification and try again." }, 400, origin);
    }

    const validationError = route.validate(formData);
    if (validationError) {
      return jsonResponse({ ok: false, error: validationError }, 400, origin);
    }

    let turnstileResult;
    try {
      const verification = new FormData();
      verification.set("secret", env.TURNSTILE_SECRET);
      verification.set("response", token);
      verification.set("idempotency_key", crypto.randomUUID());

      const remoteIp = request.headers.get("CF-Connecting-IP");
      if (remoteIp) verification.set("remoteip", remoteIp);

      const verificationResponse = await fetch(
        "https://challenges.cloudflare.com/turnstile/v0/siteverify",
        { method: "POST", body: verification }
      );
      turnstileResult = await verificationResponse.json();
    } catch {
      return jsonResponse({ ok: false, error: "Verification could not be completed. Please try again." }, 502, origin);
    }

    if (
      !turnstileResult.success ||
      turnstileResult.hostname !== "fieldbox.app" ||
      turnstileResult.action !== route.action
    ) {
      return jsonResponse({ ok: false, error: "Verification failed. Please try again." }, 403, origin);
    }

    const googleFields = new URLSearchParams();
    for (const [name, value] of formData.entries()) {
      if (route.allowedFields.has(name) && typeof value === "string") {
        googleFields.append(name, value);
      }
    }

    try {
      const googleResponse = await fetch(route.googleFormUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: googleFields,
        redirect: "manual",
      });

      if (googleResponse.status < 200 || googleResponse.status >= 400) {
        return jsonResponse({ ok: false, error: "Fieldbox could not record this submission. Please try again." }, 502, origin);
      }
    } catch {
      return jsonResponse({ ok: false, error: "Fieldbox could not record this submission. Please try again." }, 502, origin);
    }

    return jsonResponse({ ok: true }, 200, origin);
  },
};

function validateEnrollment(formData) {
  const required = [
    "entry.1157804745",
    "entry.1018500871",
    "entry.204697437",
    "entry.795691013",
    "entry.1189892332",
    "entry.415997136",
    "entry.1853858981",
  ];

  if (!required.every((name) => hasText(formData, name))) {
    return "Complete every required field.";
  }

  if (!isEmail(stringValue(formData.get("entry.1018500871")))) {
    return "Enter a valid email address.";
  }

  if (!["Instagram", "TikTok", "Both"].includes(stringValue(formData.get("entry.204697437")))) {
    return "Select a valid primary platform.";
  }

  return valuesFitLimits(formData) ? "" : "One or more fields are too long.";
}

function validateSubmission(formData) {
  const required = [
    "entry.1364169378",
    "entry.194434320",
    "entry.48567142",
    "entry.456098895",
    "entry.731381614_year",
    "entry.731381614_month",
    "entry.731381614_day",
    "entry.533384280",
  ];

  if (!required.every((name) => hasText(formData, name))) {
    return "Complete every required field.";
  }

  const email = stringValue(formData.get("entry.194434320"));
  const platform = stringValue(formData.get("entry.48567142"));
  const videoUrl = stringValue(formData.get("entry.456098895"));
  const duration = Number(stringValue(formData.get("entry.533384280")));

  if (!isEmail(email)) return "Enter a valid email address.";
  if (!isCrew01VideoUrl(platform, videoUrl)) return "Enter a public video link that matches the selected platform.";
  if (!Number.isInteger(duration) || duration < 20 || duration > 86400) {
    return "Enter a valid video duration of at least 20 seconds.";
  }

  const confirmations = new Set(
    formData.getAll("entry.1873563230").map(stringValue)
  );
  if (![...REQUIRED_SUBMISSION_CONFIRMATIONS].every((value) => confirmations.has(value))) {
    return "Confirm every video requirement.";
  }

  return valuesFitLimits(formData) ? "" : "One or more fields are too long.";
}

function isCrew01VideoUrl(platform, value) {
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

  return platform === "Instagram"
    ? isInstagramReel
    : platform === "TikTok" && (isTikTokVideo || isTikTokShortLink);
}

function valuesFitLimits(formData) {
  for (const value of formData.values()) {
    if (typeof value === "string" && value.length > 4000) return false;
  }
  return true;
}

function hasText(formData, name) {
  return stringValue(formData.get(name)).trim().length > 0;
}

function stringValue(value) {
  return typeof value === "string" ? value : "";
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
  if (ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(body, status, origin, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      ...extraHeaders,
      "Content-Type": "application/json;charset=UTF-8",
    },
  });
}
