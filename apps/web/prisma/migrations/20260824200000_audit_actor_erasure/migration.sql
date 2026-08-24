-- Audit-log immutability, refined for lawful erasure of a person.
--
-- The original trigger rejected every UPDATE on audit_logs. That is right for
-- the content of an entry, but it also blocked the one legitimate write the
-- platform must be able to make: when a member's account is erased under a
-- data-rights obligation, the foreign key nulls audit_logs."actorId".
--
-- Blocking that would force an impossible choice between honouring an erasure
-- request and keeping the audit trail. So the rule is made precise instead:
--
--   * The CONTENT of an entry is immutable. Action, target, reason, outcome,
--     metadata, address, timestamp — none can ever be altered.
--   * The actorId REFERENCE may be set to NULL, and only to NULL, and only
--     when nothing else on the row changes. The entry survives; the denormalised
--     actorEmail and actorRole on the row keep it meaningful; the link to a
--     deleted account is released.
--
-- DELETE remains forbidden outright, except under the recorded maintenance flag.

CREATE OR REPLACE FUNCTION audit_logs_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.audit_maintenance', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Permit exactly one shape of update: releasing the actor reference.
    IF NEW."actorId" IS NULL
       AND OLD."actorId" IS NOT NULL
       AND NEW.id           IS NOT DISTINCT FROM OLD.id
       AND NEW."actorEmail" IS NOT DISTINCT FROM OLD."actorEmail"
       AND NEW."actorRole"  IS NOT DISTINCT FROM OLD."actorRole"
       AND NEW.action       IS NOT DISTINCT FROM OLD.action
       AND NEW."targetType" IS NOT DISTINCT FROM OLD."targetType"
       AND NEW."targetId"   IS NOT DISTINCT FROM OLD."targetId"
       AND NEW.reason       IS NOT DISTINCT FROM OLD.reason
       AND NEW.outcome      IS NOT DISTINCT FROM OLD.outcome
       AND NEW.metadata     IS NOT DISTINCT FROM OLD.metadata
       AND NEW."ipAddress"  IS NOT DISTINCT FROM OLD."ipAddress"
       AND NEW."userAgent"  IS NOT DISTINCT FROM OLD."userAgent"
       AND NEW."createdAt"  IS NOT DISTINCT FROM OLD."createdAt"
    THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'audit_logs is append-only: entries cannot be altered'
      USING ERRCODE = '42501';
  END IF;

  RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

-- The security-event log follows the same rule: its userId is also nulled when
-- an account is erased, and its content is likewise immutable.
CREATE OR REPLACE FUNCTION security_events_reject_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('app.audit_maintenance', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW."userId" IS NULL
     AND OLD."userId" IS NOT NULL
     AND NEW.id          IS NOT DISTINCT FROM OLD.id
     AND NEW.kind        IS NOT DISTINCT FROM OLD.kind
     AND NEW.severity    IS NOT DISTINCT FROM OLD.severity
     AND NEW.detail      IS NOT DISTINCT FROM OLD.detail
     AND NEW."ipAddress" IS NOT DISTINCT FROM OLD."ipAddress"
     AND NEW."userAgent" IS NOT DISTINCT FROM OLD."userAgent"
     AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'security_events is append-only: % is not permitted', TG_OP
    USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS security_events_no_update ON "security_events";
CREATE TRIGGER security_events_no_update
  BEFORE UPDATE OR DELETE ON "security_events"
  FOR EACH ROW EXECUTE FUNCTION security_events_reject_mutation();
