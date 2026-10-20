-- Test RLS : un utilisateur ne doit pas pouvoir rattacher son device au brassin d'un autre.
-- À jouer sur la stack LOCALE uniquement. Tout est annulé en fin de script (rollback).
\set ON_ERROR_ROLLBACK on
begin;

insert into auth.users (id, instance_id, aud, role, email)
values ('aaaaaaaa-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a@rls.test'),
       ('bbbbbbbb-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'b@rls.test');

insert into batches (id, user_id, name, status, recipe_snapshot) values
  ('aaaaaaaa-1111-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'Brassin A', 'fermentation', '{}'),
  ('bbbbbbbb-1111-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'Brassin B', 'fermentation', '{}');
insert into devices (id, user_id, type, name, api_token) values
  ('aaaaaaaa-2222-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'ispindel', 'Device A', 'tok-a');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

\echo '--- T1 (attaque) : A rattache son device au brassin de B'
savepoint t1;
update devices set active_batch_id = 'bbbbbbbb-1111-0000-0000-000000000001' where id = 'aaaaaaaa-2222-0000-0000-000000000001';
select 'T1 resultat: active_batch_id apres UPDATE = ' || coalesce(active_batch_id::text,'null') as t1 from devices where id = 'aaaaaaaa-2222-0000-0000-000000000001';
rollback to t1;

\echo '--- T2 (témoin) : A rattache son device à son propre brassin'
update devices set active_batch_id = 'aaaaaaaa-1111-0000-0000-000000000001' where id = 'aaaaaaaa-2222-0000-0000-000000000001';
select 'T2 resultat: ' || active_batch_id::text as t2 from devices where id = 'aaaaaaaa-2222-0000-0000-000000000001';

\echo '--- T3 (témoin) : A remet NULL'
update devices set active_batch_id = null where id = 'aaaaaaaa-2222-0000-0000-000000000001';
select 'T3 resultat: ' || coalesce(active_batch_id::text,'null') as t3 from devices where id = 'aaaaaaaa-2222-0000-0000-000000000001';

\echo '--- T4 (attaque) : A crée un device déjà rattaché au brassin de B'
savepoint t4;
insert into devices (user_id, type, name, api_token, active_batch_id)
values ('aaaaaaaa-0000-0000-0000-00000000000a', 'ispindel', 'Device A2', 'tok-a2', 'bbbbbbbb-1111-0000-0000-000000000001');
select 'T4 resultat: INSERT accepté' as t4 where exists (select 1 from devices where api_token = 'tok-a2');
rollback to t4;

rollback;
