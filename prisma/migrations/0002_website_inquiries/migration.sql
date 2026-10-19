-- Every enquiry from the standardprojects.org contact form (public.inquiries) becomes an
-- unassigned CRM lead, due for follow-up immediately, with the message logged as a note.
CREATE OR REPLACE FUNCTION public.crm_lead_from_inquiry() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lead_id text := gen_random_uuid()::text;
BEGIN
  INSERT INTO "Lead" (id, company, "contactName", email, industry, "serviceInterest", source, stage,
                      "nextFollowUpAt", "stageChangedAt", "createdAt", "updatedAt")
  VALUES (lead_id, NEW.name, NEW.name, lower(NEW.email), NEW.business_type, NEW.need, 'WEBSITE', 'NEW',
          now(), now(), now(), now());

  INSERT INTO "Activity" (id, type, summary, source, "externalId", "leadId", "occurredAt", "createdAt")
  VALUES (gen_random_uuid()::text, 'NOTE',
          concat_ws(E'\n', 'Website enquiry',
                    'Business: ' || NEW.business_type, 'Needs: ' || NEW.need, NEW.note),
          'WEBSITE', 'inquiry:' || NEW.id::text, lead_id, NEW.created_at, now());
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.crm_lead_from_inquiry() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_lead_from_inquiry ON public.inquiries;
CREATE TRIGGER crm_lead_from_inquiry AFTER INSERT ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION public.crm_lead_from_inquiry();
