CREATE TABLE IF NOT EXISTS testflight_applications (
  id TEXT PRIMARY KEY,
  campaign TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  device TEXT NOT NULL,
  setup TEXT NOT NULL,
  workflow TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied' CHECK(status IN ('applied', 'invited', 'installed', 'code_sent', 'declined')),
  UNIQUE(campaign, email)
);
