-- Audit-log immutability.
--
-- Section 14 of the platform specification requires that administrators —
-- including the Super Admin — cannot silently erase their own actions.
-- Application-level discipline is not enough, so the guarantee is enforced in
-- the database itself: audit rows may be inserted and read, never updated or
-- deleted.
--
-- A deliberate, recorded purge (for example a court-ordered erasure or an
-- approved retention run) is still possible, but only by a database superuser
-- who explicitly sets `app.audit_maintenance = 'on'` for the transaction, which
-- makes the act visible in database logs rather than invisible in the product.

CREATE OR REPLACE FUNCTION audit_logs_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.audit_maintenance', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON "audit_logs";
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON "audit_logs";
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();

-- The same protection applies to the tamper-evident access trails kept for
-- counselling notes and safeguarding records.
DROP TRIGGER IF EXISTS session_note_access_no_update ON "session_note_access";
CREATE TRIGGER session_note_access_no_update
  BEFORE UPDATE OR DELETE ON "session_note_access"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();

DROP TRIGGER IF EXISTS safeguarding_access_no_update ON "safeguarding_access";
CREATE TRIGGER safeguarding_access_no_update
  BEFORE UPDATE OR DELETE ON "safeguarding_access"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();

-- Hierarchy changes form the church's administrative record of who was given
-- authority, by whom and why. It is equally append-only.
DROP TRIGGER IF EXISTS hierarchy_changes_no_update ON "hierarchy_changes";
CREATE TRIGGER hierarchy_changes_no_update
  BEFORE UPDATE OR DELETE ON "hierarchy_changes"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_reject_mutation();

-- Supporting indexes for the moderation and counselling operational queries.
CREATE INDEX IF NOT EXISTS "counselling_sessions_scheduled_idx"
  ON "counselling_sessions" ("scheduledFor");
CREATE INDEX IF NOT EXISTS "connection_requests_requester_idx"
  ON "connection_requests" ("requesterId", "status");
CREATE INDEX IF NOT EXISTS "messages_sender_idx"
  ON "messages" ("senderId", "createdAt");
