-- Install after schema.sql. Learner email ownership is NOT verified: operator test inbox only.
CREATE TABLE IF NOT EXISTS handshake.recap_deliveries (
 learner_id text PRIMARY KEY REFERENCES handshake.learners(learner_id) ON DELETE CASCADE,
 generation uuid NOT NULL, lease uuid, lease_until timestamptz, last_sent_at timestamptz
);
REVOKE ALL ON handshake.recap_deliveries FROM PUBLIC;
CREATE OR REPLACE FUNCTION handshake.recap_stats(p jsonb) RETURNS jsonb LANGUAGE plpgsql
SET search_path=pg_catalog,handshake AS $$
DECLARE d jsonb; total numeric:=0; matches numeric:=0; n numeric; a numeric;
BEGIN
 IF jsonb_typeof(p->'daily') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid daily stats'; END IF;
 FOR d IN SELECT value FROM jsonb_array_elements(p->'daily') LOOP
  IF jsonb_typeof(d->'attempts') IS DISTINCT FROM 'number' OR jsonb_typeof(d->'accuracy') IS DISTINCT FROM 'number' OR
   jsonb_typeof(d->'day') IS DISTINCT FROM 'string' OR (d->>'day') !~ '^\d{4}-\d{2}-\d{2}$'
  THEN RAISE EXCEPTION 'Invalid daily stats'; END IF;
  n:=(d->>'attempts')::numeric; a:=(d->>'accuracy')::numeric;
  IF n<0 OR n>2147483647 OR trunc(n)<>n OR a<0 OR a>1 THEN RAISE EXCEPTION 'Invalid daily stats'; END IF;
  total:=total+n; matches:=matches+n*a;
 END LOOP;
 RETURN jsonb_build_object('attempts',total,'share',CASE WHEN total>0 THEN round(matches*100/total,1) END);
END $$;
CREATE OR REPLACE FUNCTION handshake.recap_claim(operator_email text) RETURNS SETOF jsonb LANGUAGE plpgsql
SET search_path=pg_catalog,handshake AS $$
DECLARE r handshake.learners; delivery handshake.recap_deliveries; new_lease uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(48151623);
 IF coalesce(operator_email,'')='' THEN RETURN; END IF;
 FOR r IN SELECT * FROM handshake.learners WHERE learner_email=lower(trim(operator_email)) AND learner_email<>'' FOR UPDATE LOOP
  SELECT * INTO delivery FROM handshake.recap_deliveries WHERE learner_id=r.learner_id FOR UPDATE;
  IF delivery.lease_until>now() OR delivery.last_sent_at>now()-interval '7 days' THEN CONTINUE; END IF;
  new_lease:=gen_random_uuid();
  INSERT INTO handshake.recap_deliveries(learner_id,generation,lease,lease_until) VALUES(r.learner_id,r.generation,new_lease,now()+interval '10 minutes')
  ON CONFLICT(learner_id) DO UPDATE SET generation=excluded.generation,lease=excluded.lease,lease_until=excluded.lease_until;
  RETURN NEXT jsonb_build_object('learnerId',r.learner_id,'lease',new_lease);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION handshake.recap_recheck(id text, expected_lease uuid, operator_email text) RETURNS jsonb LANGUAGE plpgsql
SET search_path=pg_catalog,handshake AS $$
DECLARE r handshake.learners;
BEGIN
 PERFORM pg_advisory_xact_lock(48151623);
 SELECT l.* INTO r FROM handshake.learners l JOIN handshake.recap_deliveries d USING(learner_id)
 WHERE l.learner_id=id AND d.lease=expected_lease AND d.lease_until>now() AND d.generation=l.generation
 AND l.learner_email=lower(trim(operator_email)) AND l.learner_email<>'' FOR UPDATE OF l,d;
 IF r.learner_id IS NULL THEN RETURN jsonb_build_object('send',false); END IF;
 RETURN jsonb_build_object('send',true,'email',r.learner_email,'unsubscribeToken',r.learner_unsubscribe_token);
END $$;
CREATE OR REPLACE FUNCTION handshake.recap_finish(id text, expected_lease uuid, success boolean) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,handshake AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(48151623);
 UPDATE handshake.recap_deliveries SET last_sent_at=CASE WHEN success THEN now() ELSE last_sent_at END,lease=NULL,lease_until=NULL WHERE learner_id=id AND lease=expected_lease;
END $$;
REVOKE ALL ON FUNCTION handshake.recap_stats(jsonb),handshake.recap_claim(text),handshake.recap_recheck(text,uuid,text),handshake.recap_finish(text,uuid,boolean) FROM PUBLIC;
