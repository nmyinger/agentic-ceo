-- Fix 1: add 'actions' to the artifacts type constraint (was missing, causing emit_actions to error)
alter table artifacts drop constraint artifacts_type_check;
alter table artifacts add constraint artifacts_type_check check (type in ('vision', 'parking_lot', 'actions'));

-- Fix 2: set REPLICA IDENTITY FULL so UPDATE events include full row data in Supabase realtime.
-- Without this, only the primary key is sent on UPDATE — payload.new.type and payload.new.content
-- are undefined, so setVision/setActions/setParkingLot are never called after the first insert.
alter table artifacts replica identity full;
