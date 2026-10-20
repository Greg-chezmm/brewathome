-- Même contrôle sur une copie des données réelles (stack LOCALE uniquement). Tout est annulé (rollback).
\set ON_ERROR_ROLLBACK on
begin;
select d.user_id as owner, d.id as device, (select id from batches where user_id = d.user_id limit 1) as own_batch,
       (select id from batches where user_id <> d.user_id limit 1) as foreign_batch
from devices d limit 1 \gset
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'owner', 'role', 'authenticated')::text, true);
\echo '--- R1 (témoin) : renommer le device réel (ligne existante, autre colonne)'
update devices set name = name || ' (test)' where id = :'device';
select 'R1: ' || name from devices where id = :'device';
\echo '--- R2 (témoin) : rattacher le device réel à son propre brassin'
update devices set active_batch_id = :'own_batch' where id = :'device';
select 'R2 rattaché = ' || (active_batch_id is not null) from devices where id = :'device';
\echo '--- R3 (attaque) : rattacher le device réel au brassin de l''autre utilisateur'
update devices set active_batch_id = :'foreign_batch' where id = :'device';
select 'R3 rattaché à un brassin étranger = ' || (active_batch_id = :'foreign_batch') from devices where id = :'device';
\echo '--- R4 : l''autre utilisateur ne voit pas mon device'
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from batches where id = :'foreign_batch'), 'role', 'authenticated')::text, true);
select 'R4 devices visibles par l''autre = ' || count(*) from devices;
rollback;
