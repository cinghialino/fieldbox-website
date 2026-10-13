const FROM = "notifications@fieldbox.app";
const createEmail = async (from, to, raw) => {
  const { EmailMessage } = await import("cloudflare:email");
  return new EmailMessage(from, to, raw);
};
export function notificationText(row) {
  return ["New Fieldbox TestFlight application", "", `Name: ${row.name || "(not provided)"}`, `Email: ${row.email}`, `Device: ${row.device}`, `Setup: ${row.setup}`, `How they would use Fieldbox: ${row.workflow || "(left blank)"}`, `Received: ${row.created_at}`, `Record ID: ${row.id}`, "", "Next: review the setup, invite the selected email through App Store Connect, then send a Pro code after beta installation.", "Applications marked SAMPLE are synthetic test records. Do not invite them or allocate a code."].join("\n");
}
export async function flushNotifications(env, makeEmail = createEmail) {
  if (!env.TESTFLIGHT_EMAIL || !env.TESTFLIGHT_NOTIFY_TO) return;
  const to = env.TESTFLIGHT_NOTIFY_TO;
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(to)) throw new Error("Invalid notification destination");
  const rows = await env.TESTFLIGHT_DB.prepare(`SELECT * FROM testflight_applications WHERE notification_sent_at IS NULL AND notification_next_attempt <= ?1 ORDER BY created_at LIMIT 25`).bind(new Date().toISOString()).all();
  for (const row of rows.results) {
    try {
      const encoded = btoa(Array.from(new TextEncoder().encode(notificationText(row)), byte => String.fromCharCode(byte)).join(""));
      const raw = [`From: Fieldbox <${FROM}>`, `To: ${to}`, "Subject: New Fieldbox TestFlight application", `Message-ID: <testflight-${row.id}@fieldbox.app>`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64", "", encoded.match(/.{1,76}/g).join("\r\n"), ""].join("\r\n");
      await env.TESTFLIGHT_EMAIL.send(await makeEmail(FROM, to, raw));
      await env.TESTFLIGHT_DB.prepare(`UPDATE testflight_applications SET notification_sent_at = ?1, notification_attempts = notification_attempts + 1 WHERE id = ?2`).bind(new Date().toISOString(), row.id).run();
    } catch {
      const delay = Math.min(60, 2 ** Math.min(row.notification_attempts || 0, 6));
      await env.TESTFLIGHT_DB.prepare(`UPDATE testflight_applications SET notification_attempts = notification_attempts + 1, notification_next_attempt = ?1 WHERE id = ?2`).bind(new Date(Date.now() + delay * 60000).toISOString(), row.id).run();
    }
  }
}
