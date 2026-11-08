-- Install after schema.sql in the dedicated notification database.
CREATE OR REPLACE FUNCTION handshake.lesson_claim(p jsonb) RETURNS jsonb LANGUAGE plpgsql
SET search_path=pg_catalog,handshake AS $$
DECLARE r handshake.learners; title text; lease uuid:=gen_random_uuid();
BEGIN
 PERFORM pg_advisory_xact_lock(48151623);
 IF jsonb_typeof(p->'learnerId') IS DISTINCT FROM 'string' OR length(p->>'learnerId') NOT BETWEEN 1 AND 100 OR
 jsonb_typeof(p->'lessonId') IS DISTINCT FROM 'string' OR
 jsonb_typeof(p->'xp') IS DISTINCT FROM 'number' OR (p->>'xp')::numeric NOT BETWEEN 0 AND 1000 OR (p->>'xp')::numeric<>trunc((p->>'xp')::numeric)
 THEN RETURN jsonb_build_object('send',false,'status',400); END IF;
 -- Static canonical titles; personalized names and supplied lessonTitle are ignored.
 title:=CASE p->>'lessonId'
 WHEN '1.1' THEN 'Your letters' WHEN '1.2' THEN 'Spell your name' WHEN '1.3' THEN 'Checkpoint'
 WHEN '2.1' THEN 'Flat and curved' WHEN '2.2' THEN 'Point and pinky' WHEN '2.3' THEN 'Two and three fingers'
 WHEN '2.4' THEN 'The fist' WHEN '2.5' THEN 'Spell their name' WHEN '2.6' THEN 'More finger shapes'
 WHEN '2.7' THEN 'The fist family' WHEN '2.8' THEN 'Sideways shapes' WHEN '2.9' THEN 'Moving letters' WHEN '2.10' THEN 'Alphabet checkpoint'
 WHEN '3.1' THEN 'Hello and goodbye' WHEN '3.2' THEN 'Introductions' WHEN '4.1' THEN 'First hello' END;
 IF title IS NULL THEN RETURN jsonb_build_object('send',false,'status',200); END IF;
 SELECT * INTO r FROM handshake.learners WHERE learner_id=p->>'learnerId' FOR UPDATE;
 IF r.learner_id IS NULL OR r.contact_email='' OR r.contact_confirmed_at IS NULL OR r.unsubscribe_token IS NULL OR
 r.last_sent_at>now()-interval '10 minutes' OR r.lesson_lease_until>now()
 THEN RETURN jsonb_build_object('send',false,'status',200); END IF;
 UPDATE handshake.learners SET lesson_lease=lease,lesson_lease_until=now()+interval '10 minutes' WHERE learner_id=r.learner_id;
 RETURN jsonb_build_object('send',true,'status',200,'learnerId',r.learner_id,'lease',lease,'title',title);
END $$;
CREATE OR REPLACE FUNCTION handshake.lesson_recheck(id text, lease uuid) RETURNS jsonb LANGUAGE plpgsql
SET search_path=pg_catalog,handshake AS $$
DECLARE r handshake.learners;
BEGIN
 PERFORM pg_advisory_xact_lock(48151623);
 SELECT * INTO r FROM handshake.learners WHERE learner_id=id AND lesson_lease=lease AND lesson_lease_until>now() AND contact_confirmed_at IS NOT NULL AND contact_email<>'' AND unsubscribe_token IS NOT NULL FOR UPDATE;
 IF r.learner_id IS NULL THEN RETURN jsonb_build_object('send',false); END IF;
 RETURN jsonb_build_object('send',true,'email',r.contact_email,'unsubscribeToken',r.unsubscribe_token);
END $$;
CREATE OR REPLACE FUNCTION handshake.lesson_finish(id text, lease uuid, success boolean) RETURNS void LANGUAGE plpgsql
SET search_path=pg_catalog,handshake AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(48151623);
 UPDATE handshake.learners SET last_sent_at=CASE WHEN success THEN now() ELSE last_sent_at END,lesson_lease=NULL,lesson_lease_until=NULL WHERE learner_id=id AND lesson_lease=lease;
END $$;
REVOKE ALL ON FUNCTION handshake.lesson_claim(jsonb),handshake.lesson_recheck(text,uuid),handshake.lesson_finish(text,uuid,boolean) FROM PUBLIC;
