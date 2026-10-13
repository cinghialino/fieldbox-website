# Fieldbox Crew01 form gateway

This Cloudflare Worker is the server-side gateway for the Crew01 enrollment and video-submission forms.

It accepts requests only from `fieldbox.app`, validates the Cloudflare Turnstile token and expected action, validates the submitted fields, and forwards accepted responses to the campaign's existing Google Forms endpoints.

Cloudflare configuration:

- Worker name: `fieldbox-crew01-forms`
- Custom domain: `forms.fieldbox.app`
- Required encrypted secret: `TURNSTILE_SECRET`
- Worker observability: disabled to avoid retaining submitted personal information in logs

The Turnstile secret must never be committed to this repository or exposed to client-side code.

## TestFlight applications

The same gateway has a separate `POST /testflight/join` route. It uses Turnstile action
`testflight_join` and the private `TESTFLIGHT_DB` D1 binding. The existing creator
forms still forward to Google Forms; beta applications do not.

The public page is `/testflight/`. It collects invitation email, optional name,
device, storage/camera setup, optional workflow notes, and both consent confirmations.
No subscription codes, invitation links, IP addresses, or Turnstile tokens are stored in D1.
There is no public read endpoint. Cloudflare observability remains disabled.

### Deployment and verification

1. Run `npm test` (Node 22 with `node:sqlite` available).
2. Apply the migration: `wrangler d1 migrations apply fieldbox-testflight --remote`.
3. Validate the Worker bundle with `wrangler deploy --dry-run`, then deploy the Worker.
4. Publish the static site separately, after review. Check the live page, privacy notice,
   and an explicitly authorized test application through the production Turnstile widget.
   Delete only that identified synthetic application after checking the stored fields.

### Reviewing applications

In the Cloudflare dashboard, open **Workers & Pages → D1 → fieldbox-testflight → Console**.
The following private query lists applications awaiting an invitation:

```sql
SELECT id, created_at, name, email, device, setup, workflow, status
FROM testflight_applications
WHERE campaign = 'testflight-1.8-2026' AND status = 'applied'
ORDER BY created_at;
```

Applications do not automatically invite people or send codes. Review their setups,
add selected emails to the external tester group in App Store Connect, then update
only the matching application ID to `invited`. Once TestFlight shows installation,
update it to `installed`; send the offer code privately and mark it `code_sent`.
The allowed statuses are `applied`, `invited`, `installed`, `code_sent`, and `declined`.
No feedback checklist gates the code. Allocate no more than the agreed 30 complimentary
years. Review the remaining allocation before sending each batch; the page does not
claim a live count or automatically reserve places.

```sql
UPDATE testflight_applications SET status = 'invited' WHERE id = 'exact-application-id';
SELECT status, COUNT(*) AS applications FROM testflight_applications GROUP BY status;
```

Duplicate applications for the same normalized email and campaign return the same
success response without overwriting an existing entry. Corrections and deletion
requests go through support; use the exact application ID for any private update.

### Offer maintenance

The page names beta 1.8 and says codes must be redeemed **before November 1, 2026**.
Apple controls eligibility, redemption, and renewal. After the complimentary year,
the subscription auto-renews at the standard price unless canceled. This code is for
the App Store subscription, separate from TestFlight beta access.

Before the deadline or once all 30 offers are allocated, update the page, metadata,
and required offer checkbox together; do not leave an expired or exhausted offer
advertised. The signup route deliberately has no automatic invitation/reward logic.

## Application notifications

Each saved application is queued for a private email with all submitted fields and its record ID.
The recipient is the encrypted Worker secret `TESTFLIGHT_NOTIFY_TO`; never put the private address
in public site assets or committed config. The native `TESTFLIGHT_EMAIL` binding uses the existing
Fieldbox Email Routing setup. The recipient must be a verified routing destination.

Submission saves and email delivery are separate: the applicant receives success once saved.
The Worker attempts notifications in background after submission and every five minutes.
Failed attempts retry with backoff up to hourly. `notification_sent_at` records provider acceptance,
not proof that the recipient read the email. A crash after send and before recording may duplicate
a notification; the stable record ID and Message-ID identify the same application.
