ALTER TABLE testflight_applications ADD COLUMN notification_sent_at TEXT;
ALTER TABLE testflight_applications ADD COLUMN notification_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE testflight_applications ADD COLUMN notification_next_attempt TEXT NOT NULL DEFAULT '';
CREATE INDEX testflight_notification_queue ON testflight_applications(notification_sent_at, notification_next_attempt);
