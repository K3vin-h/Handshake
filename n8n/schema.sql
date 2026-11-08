-- v1. Dedicated notification database/role; never install in the attempts database.
BEGIN;
CREATE SCHEMA IF NOT EXISTS handshake;
REVOKE ALL ON SCHEMA handshake FROM PUBLIC;
CREATE TABLE IF NOT EXISTS handshake.learners (
 learner_id text PRIMARY KEY CHECK(length(learner_id) BETWEEN 1 AND 100),
 user_name text NOT NULL DEFAULT '', their_name text NOT NULL DEFAULT '',
 learner_email text NOT NULL DEFAULT '', contact_email text NOT NULL DEFAULT '',
 contact_token text UNIQUE, contact_token_created_at timestamptz,
 contact_confirmed_at timestamptz, confirmation_delivery_pending boolean NOT NULL DEFAULT false, unsubscribe_token text UNIQUE,
 learner_unsubscribe_token text NOT NULL UNIQUE,
 requested_at timestamptz NOT NULL, generation uuid NOT NULL DEFAULT gen_random_uuid(), last_sent_at timestamptz,
 lesson_lease uuid, lesson_lease_until timestamptz
);
CREATE TABLE IF NOT EXISTS handshake.revoked_learners (learner_id text PRIMARY KEY, revoked_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS handshake.confirmation_reservations (
 address text NOT NULL, reserved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS confirmation_budget_time ON handshake.confirmation_reservations(reserved_at);
CREATE OR REPLACE FUNCTION handshake.token() RETURNS text LANGUAGE sql VOLATILE
 SET search_path = pg_catalog AS $$ SELECT replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','') $$;
CREATE OR REPLACE FUNCTION handshake.subscribe(p jsonb) RETURNS jsonb LANGUAGE plpgsql
 SET search_path = pg_catalog, handshake AS $$
DECLARE r handshake.learners; id text:=p->>'learnerId'; v_address text:=lower(trim(coalesce(p->>'contactEmail','')));
 learner text:=lower(trim(coalesce(p->>'learnerEmail',''))); changed boolean; wants_send boolean:=false; request_at timestamptz; current_time_utc timestamptz;
BEGIN
 -- Serializes all subscription writes and confirmation budget reservations across workers.
 PERFORM pg_advisory_xact_lock(48151623);
 current_time_utc:=clock_timestamp();
 IF id IS NULL OR length(id) NOT BETWEEN 1 AND 100 THEN RETURN jsonb_build_object('ok',false,'status',400); END IF;
 BEGIN request_at:=(p->>'requestedAt')::timestamptz; EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN jsonb_build_object('ok',false,'status',400); END;
 IF request_at IS NULL OR request_at>current_time_utc+interval '5 minutes' THEN RETURN jsonb_build_object('ok',false,'status',400); END IF;
 IF EXISTS(SELECT 1 FROM handshake.revoked_learners WHERE learner_id=id AND revoked_at>=request_at) OR EXISTS(SELECT 1 FROM handshake.learners WHERE learner_id=id AND requested_at>=request_at) THEN RETURN jsonb_build_object('ok',false,'status',409); END IF;
 IF p->>'action'='unsubscribe' THEN INSERT INTO handshake.revoked_learners(learner_id,revoked_at) VALUES(id,request_at) ON CONFLICT(learner_id) DO UPDATE SET revoked_at=excluded.revoked_at; DELETE FROM handshake.learners WHERE learner_id=id; RETURN jsonb_build_object('ok',true,'send',false,'status',200); END IF;
 IF p->>'action' IS DISTINCT FROM 'subscribe' OR (v_address='' AND learner='') OR
 (v_address<>'' AND (length(v_address)>254 OR v_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) OR
 (learner<>'' AND (length(learner)>254 OR learner !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')) OR
 length(coalesce(p->>'userName',''))>80 OR length(coalesce(p->>'theirName',''))>80
 THEN RETURN jsonb_build_object('ok',false,'status',400); END IF;
 SELECT * INTO r FROM handshake.learners WHERE learner_id=id FOR UPDATE;
 changed:=r.learner_id IS NULL OR r.contact_email IS DISTINCT FROM v_address OR (r.contact_confirmed_at IS NULL AND r.contact_token_created_at<current_time_utc-interval '24 hours');
 IF NOT changed AND r.confirmation_delivery_pending THEN RETURN jsonb_build_object('ok',false,'status',503); END IF;
 IF changed AND v_address<>'' THEN
  IF EXISTS(SELECT 1 FROM handshake.confirmation_reservations WHERE confirmation_reservations.address=v_address AND reserved_at>current_time_utc-interval '24 hours') OR
   (SELECT count(*) FROM handshake.confirmation_reservations WHERE reserved_at>current_time_utc-interval '1 hour')>=20
   THEN RETURN jsonb_build_object('ok',false,'status',429); END IF;
  INSERT INTO handshake.confirmation_reservations(address,reserved_at) VALUES(v_address,current_time_utc); wants_send:=true;
 END IF;
 INSERT INTO handshake.learners(learner_id,user_name,their_name,learner_email,contact_email,contact_token,contact_token_created_at,unsubscribe_token,learner_unsubscribe_token,confirmation_delivery_pending,requested_at)
 VALUES(id,coalesce(p->>'userName',''),coalesce(p->>'theirName',''),learner,v_address,
 CASE WHEN v_address<>'' THEN handshake.token() END,CASE WHEN v_address<>'' THEN current_time_utc END,
 CASE WHEN v_address<>'' THEN handshake.token() END,handshake.token(),wants_send,request_at)
 ON CONFLICT(learner_id) DO UPDATE SET requested_at=excluded.requested_at,user_name=excluded.user_name,their_name=excluded.their_name,learner_email=excluded.learner_email,contact_email=excluded.contact_email,
 contact_token=CASE WHEN changed THEN excluded.contact_token ELSE learners.contact_token END,
 contact_token_created_at=CASE WHEN changed THEN excluded.contact_token_created_at ELSE learners.contact_token_created_at END,
 contact_confirmed_at=CASE WHEN changed THEN NULL ELSE learners.contact_confirmed_at END,
 unsubscribe_token=CASE WHEN changed THEN excluded.unsubscribe_token ELSE learners.unsubscribe_token END,
 learner_unsubscribe_token=CASE WHEN learners.learner_email IS DISTINCT FROM excluded.learner_email THEN excluded.learner_unsubscribe_token ELSE learners.learner_unsubscribe_token END,
 confirmation_delivery_pending=CASE WHEN changed THEN wants_send ELSE learners.confirmation_delivery_pending END,
 generation=gen_random_uuid(),lesson_lease=CASE WHEN changed THEN NULL ELSE learners.lesson_lease END,lesson_lease_until=CASE WHEN changed THEN NULL ELSE learners.lesson_lease_until END
 RETURNING * INTO r;
 RETURN jsonb_build_object('ok',true,'status',200,'send',wants_send,'email',CASE WHEN wants_send THEN v_address END,'token',CASE WHEN wants_send THEN r.contact_token END);
END $$;
CREATE OR REPLACE FUNCTION handshake.contact_action(action text, token text) RETURNS jsonb LANGUAGE plpgsql
 SET search_path = pg_catalog, handshake AS $$
DECLARE affected integer:=0;
BEGIN
 PERFORM pg_advisory_xact_lock(48151623);
 IF token IS NULL OR token !~ '^[a-f0-9]{64}$' THEN RETURN jsonb_build_object('changed',false); END IF;
 IF action='confirm' THEN
 UPDATE handshake.learners SET contact_confirmed_at=now(),confirmation_delivery_pending=false,contact_token=NULL,contact_token_created_at=NULL
 WHERE contact_token=token AND contact_token_created_at>now()-interval '7 days' AND contact_email<>'';
 ELSIF action='unsubscribe' THEN
 UPDATE handshake.learners SET requested_at=greatest(requested_at,clock_timestamp()),contact_email='',contact_confirmed_at=NULL,contact_token=NULL,contact_token_created_at=NULL,unsubscribe_token=NULL,generation=gen_random_uuid(),lesson_lease=NULL,lesson_lease_until=NULL WHERE unsubscribe_token=token;
 ELSIF action='learner-unsubscribe' THEN
 INSERT INTO handshake.revoked_learners(learner_id,revoked_at) SELECT learner_id,greatest(requested_at,clock_timestamp()) FROM handshake.learners WHERE learner_unsubscribe_token=token ON CONFLICT(learner_id) DO UPDATE SET revoked_at=excluded.revoked_at;
 DELETE FROM handshake.learners WHERE learner_unsubscribe_token=token;
 ELSE RETURN jsonb_build_object('changed',false);
 END IF;
 GET DIAGNOSTICS affected=ROW_COUNT;
 RETURN jsonb_build_object('changed',affected>0);
END $$;
CREATE OR REPLACE FUNCTION handshake.confirmation_sent(token text) RETURNS jsonb LANGUAGE plpgsql
 SET search_path = pg_catalog, handshake AS $$
BEGIN
 UPDATE handshake.learners SET confirmation_delivery_pending=false WHERE contact_token=token;
 RETURN jsonb_build_object('ok',true,'status',200);
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA handshake FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA handshake FROM PUBLIC;
COMMIT;
