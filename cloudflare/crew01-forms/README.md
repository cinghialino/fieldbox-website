# Fieldbox Crew01 form gateway

This Cloudflare Worker is the server-side gateway for the Crew01 enrollment and video-submission forms.

It accepts requests only from `fieldbox.app`, validates the Cloudflare Turnstile token and expected action, validates the submitted fields, and forwards accepted responses to the campaign's existing Google Forms endpoints.

Cloudflare configuration:

- Worker name: `fieldbox-crew01-forms`
- Custom domain: `forms.fieldbox.app`
- Required encrypted secret: `TURNSTILE_SECRET`
- Worker observability: disabled to avoid retaining submitted personal information in logs

The Turnstile secret must never be committed to this repository or exposed to client-side code.
