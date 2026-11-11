-- =====================================================================
-- 말랑 레이스 온라인 데이터베이스
-- Supabase 대시보드 → SQL Editor → New query 에 전부 붙여 넣고 Run 을 누르세요.
-- 여러 번 실행해도 안전하게 만들었습니다.
--
-- 담는 것: 보호자 계정(동의 기록, 보호자 PIN), 아이 프로필(닉네임만), 게임 저장,
--          레이스 기록과 랭킹, 친구(보호자 승인), 친구 방
-- 담지 않는 것: 아이의 실명, 생년월일, 전화번호, 사진, 자유 채팅
-- =====================================================================
create extension if not exists pgcrypto with schema extensions;

-- ---------- tables ----------
create table if not exists public.guardians (
  id uuid primary key references auth.users(id) on delete cascade,
  consent_at timestamptz not null default now(),
  consent_version text not null default '2026-11',
  pin_hash text not null,
  pin_fails int not null default 0,
  pin_locked_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.children (
  id uuid primary key default gen_random_uuid(),
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 10),
  friend_code text not null unique,
  look jsonb not null default '{}'::jsonb check (pg_column_size(look) < 4000),
  level int not null default 1 check (level between 1 and 6),
  controls jsonb not null default '{"daily_min": 0, "emotes": true, "rooms": true}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists children_guardian on public.children (guardian_id);

create table if not exists public.saves (
  child_id uuid primary key references public.children(id) on delete cascade,
  data jsonb not null check (pg_column_size(data) < 600000),
  updated_at timestamptz not null default now()
);

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  child_id uuid not null references public.children(id) on delete cascade,
  world text not null,
  subject text not null,
  rank int not null,
  n int not null,
  time_s real not null,
  correct int not null,
  attempts int not null,
  score int not null,
  in_room boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists scores_child_time on public.scores (child_id, created_at desc);
create index if not exists scores_time on public.scores (created_at desc);

create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  from_child uuid not null references public.children(id) on delete cascade,
  to_child uuid not null references public.children(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  check (from_child <> to_child)
);
create unique index if not exists friendships_pair on public.friendships (least(from_child, to_child), greatest(from_child, to_child));

create table if not exists public.rooms (
  code text primary key,
  host_child uuid not null references public.children(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- row level security: the browser only ever sees its own family's rows ----------
alter table public.guardians enable row level security;
alter table public.children enable row level security;
alter table public.saves enable row level security;
alter table public.scores enable row level security;
alter table public.friendships enable row level security;
alter table public.rooms enable row level security;

create or replace function public.is_my_child(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.children where id = c and guardian_id = auth.uid())
$$;

drop policy if exists "own guardian row" on public.guardians;
create policy "own guardian row" on public.guardians for select to authenticated using (id = auth.uid());
drop policy if exists "own children" on public.children;
create policy "own children" on public.children for select to authenticated using (guardian_id = auth.uid());
drop policy if exists "own saves read" on public.saves;
create policy "own saves read" on public.saves for select to authenticated using (public.is_my_child(child_id));
drop policy if exists "own saves insert" on public.saves;
create policy "own saves insert" on public.saves for insert to authenticated with check (public.is_my_child(child_id));
drop policy if exists "own saves update" on public.saves;
create policy "own saves update" on public.saves for update to authenticated using (public.is_my_child(child_id)) with check (public.is_my_child(child_id));
drop policy if exists "own scores" on public.scores;
create policy "own scores" on public.scores for select to authenticated using (public.is_my_child(child_id));
-- friendships, rooms and everything else go through the functions below

-- pin_hash must never leave the server
revoke select on public.guardians from anon, authenticated;
grant select (id, consent_at, consent_version, created_at) on public.guardians to authenticated;

-- ---------- helpers ----------
create or replace function public._nick_ok(nick text) returns boolean
language sql immutable as $$
  select nick ~ '^[가-힣A-Za-z0-9 ]{2,10}$'          -- 한글, 영문, 숫자만
     and nick !~ '[0-9]{4,}'                           -- 전화번호 같은 긴 숫자 금지
     and nick !~* '(시발|씨발|병신|개새|ㅅㅂ|fuck|shit|sex)'
$$;

-- checks the guardian PIN; 5 wrong tries lock it for 5 minutes. Callers must not raise afterwards,
-- or the failure counter would be rolled back.
create or replace function public._pin_ok(p text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare g public.guardians;
begin
  select * into g from public.guardians where id = auth.uid() for update;
  if not found then return false; end if;
  if g.pin_locked_until is not null and g.pin_locked_until > now() then return false; end if;
  if p is not null and crypt(p, g.pin_hash) = g.pin_hash then
    update public.guardians set pin_fails = 0, pin_locked_until = null where id = g.id;
    return true;
  end if;
  update public.guardians set
    pin_locked_until = case when g.pin_fails + 1 >= 5 then now() + interval '5 minutes' else null end,
    pin_fails = case when g.pin_fails + 1 >= 5 then 0 else g.pin_fails + 1 end
  where id = g.id;
  return false;
end $$;

create or replace function public._pin_err() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.guardians where id = auth.uid() and pin_locked_until > now())
    then jsonb_build_object('ok', false, 'err', 'pin_locked') else jsonb_build_object('ok', false, 'err', 'pin') end
$$;

create or replace function public._new_code(len int) returns text
language plpgsql as $$
declare chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; s text := ''; i int;
begin
  for i in 1..len loop s := s || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
  return s;
end $$;

-- ---------- guardian ----------
create or replace function public.register_guardian(pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'err', 'auth'); end if;
  if pin !~ '^[0-9]{4}$' then return jsonb_build_object('ok', false, 'err', 'pin_format'); end if;
  if exists (select 1 from public.guardians where id = auth.uid()) then return jsonb_build_object('ok', true, 'existing', true); end if;
  insert into public.guardians (id, pin_hash) values (auth.uid(), crypt(pin, gen_salt('bf')));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.verify_pin(pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if public._pin_ok(pin) then return jsonb_build_object('ok', true); end if;
  return public._pin_err();
end $$;

create or replace function public.change_pin(old_pin text, new_pin text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  if new_pin !~ '^[0-9]{4}$' then return jsonb_build_object('ok', false, 'err', 'pin_format'); end if;
  if not public._pin_ok(old_pin) then return public._pin_err(); end if;
  update public.guardians set pin_hash = crypt(new_pin, gen_salt('bf')) where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- removes the guardian, every child, save, score, friendship and room (cascade)
create or replace function public.delete_my_account(pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public._pin_ok(pin) then return public._pin_err(); end if;
  delete from auth.users where id = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

-- ---------- children ----------
create or replace function public.create_child(nick text, look jsonb, lvl int, pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.children; v_code text;
begin
  nick := btrim(nick);
  if not public._nick_ok(nick) then return jsonb_build_object('ok', false, 'err', 'nick'); end if;
  if not public._pin_ok(pin) then return public._pin_err(); end if;
  if (select count(*) from public.children where guardian_id = auth.uid()) >= 4 then return jsonb_build_object('ok', false, 'err', 'max_children'); end if;
  loop v_code := public._new_code(6); exit when not exists (select 1 from public.children where friend_code = v_code); end loop;
  insert into public.children (guardian_id, nickname, friend_code, look, level)
    values (auth.uid(), nick, v_code, coalesce(look, '{}'::jsonb), least(6, greatest(1, coalesce(lvl, 1))))
    returning * into c;
  return jsonb_build_object('ok', true, 'child', to_jsonb(c));
end $$;

-- in-game look and grade can change without the PIN (the child plays on the guardian's login)
create or replace function public.update_child_profile(child uuid, look jsonb, lvl int) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  update public.children set look = coalesce(update_child_profile.look, children.look), level = least(6, greatest(1, coalesce(lvl, level))) where id = child;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.guardian_update_child(child uuid, nick text, controls jsonb, pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare dm int; em boolean; rm boolean;
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  if nick is not null and not public._nick_ok(btrim(nick)) then return jsonb_build_object('ok', false, 'err', 'nick'); end if;
  if not public._pin_ok(pin) then return public._pin_err(); end if;
  if controls is not null then
    dm := least(300, greatest(0, coalesce((controls->>'daily_min')::int, 0)));
    em := coalesce((controls->>'emotes')::boolean, true);
    rm := coalesce((controls->>'rooms')::boolean, true);
    update public.children set controls = jsonb_build_object('daily_min', dm, 'emotes', em, 'rooms', rm) where id = child;
  end if;
  if nick is not null then update public.children set nickname = btrim(nick) where id = child; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.delete_child(child uuid, pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  if not public._pin_ok(pin) then return public._pin_err(); end if;
  delete from public.children where id = child;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- race results and rankings ----------
-- The browser sends the raw result; the server checks it and works out the score itself.
create or replace function public.submit_score(child uuid, world text, subject text, rnk int, n int, time_s real, correct int, attempts int, in_room boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare lvl int; finish real; acc real; sc int;
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  if world not in ('candy', 'block', 'jungle', 'cloud', 'crystal', 'space')
     or subject not in ('math', 'capital', 'quiz', 'run')
     or n not between 2 and 50 or rnk not between 1 and n
     or time_s not between 45 and 1200
     or attempts not between 0 and 5 or correct not between 0 and attempts
     or (subject = 'run' and attempts <> 0) then
    return jsonb_build_object('ok', false, 'err', 'invalid');
  end if;
  if exists (select 1 from public.scores s where s.child_id = child and s.created_at > now() - interval '40 seconds') then
    return jsonb_build_object('ok', false, 'err', 'too_fast');
  end if;
  select level into lvl from public.children where id = child;
  finish := 1 - (rnk - 1)::real / greatest(1, n - 1);
  acc := case when attempts > 0 then correct::real / attempts else 0 end;
  sc := round(1000 * (case when attempts > 0 then 0.6 * acc + 0.4 * finish else 0.85 * finish + 0.15 end) * (1 + 0.15 * (lvl - 1)));
  insert into public.scores (child_id, world, subject, rank, n, time_s, correct, attempts, score, in_room)
    values (child, world, subject, rnk, n, time_s, correct, attempts, sc, coalesce(in_room, false));
  return jsonb_build_object('ok', true, 'score', sc);
end $$;

-- scope: 'all' or 'friends'. period: 'week' (sum of the best 10 races this week, Monday 00:00 KST)
-- or 'all' (best single race ever). Returns the top 50 plus my own row; never returns ids.
create or replace function public.leaderboard(child uuid, scope text default 'all', period text default 'week')
returns table (pos bigint, nickname text, look jsonb, level int, points bigint, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := case when period = 'week'
  then date_trunc('week', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul' else '-infinity'::timestamptz end;
begin
  if not public.is_my_child(child) then return; end if;
  return query
  with pool as (
    select c.id from public.children c
    where scope <> 'friends' or c.id = child or exists (
      select 1 from public.friendships f where f.status = 'approved'
        and ((f.from_child = child and f.to_child = c.id) or (f.to_child = child and f.from_child = c.id)))
  ), ranked as (
    select s.child_id, s.score, row_number() over (partition by s.child_id order by s.score desc) as k
    from public.scores s join pool p on p.id = s.child_id
    where s.created_at >= since
  ), totals as (
    select r.child_id, case when period = 'week' then sum(r.score) filter (where r.k <= 10) else max(r.score) end::bigint as pts
    from ranked r group by r.child_id
  ), board as (
    select rank() over (order by t.pts desc) as p, t.child_id, t.pts from totals t
  )
  select b.p, c.nickname, c.look, c.level, b.pts, c.id = child
  from board b join public.children c on c.id = b.child_id
  where b.p <= 50 or c.id = child
  order by b.p, c.nickname;
end $$;

-- ---------- friends (the receiving guardian approves) ----------
create or replace function public.send_friend_request(child uuid, code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.children;
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  select * into t from public.children where friend_code = upper(btrim(code));
  if not found then return jsonb_build_object('ok', false, 'err', 'no_code'); end if;
  if t.id = child then return jsonb_build_object('ok', false, 'err', 'self'); end if;
  if exists (select 1 from public.friendships where least(from_child, to_child) = least(child, t.id) and greatest(from_child, to_child) = greatest(child, t.id)) then
    return jsonb_build_object('ok', false, 'err', 'exists');
  end if;
  if (select count(*) from public.friendships where from_child = child and status = 'pending') >= 10 then
    return jsonb_build_object('ok', false, 'err', 'too_many');
  end if;
  insert into public.friendships (from_child, to_child) values (child, t.id);
  return jsonb_build_object('ok', true, 'nickname', t.nickname);
end $$;

-- friends and requests of one child (no ids of other families except the friendship id)
create or replace function public.my_friends(child uuid)
returns table (fid bigint, nickname text, look jsonb, level int, status text, incoming boolean)
language sql stable security definer set search_path = public as $$
  select f.id, o.nickname, o.look, o.level, f.status, f.to_child = child
  from public.friendships f
  join public.children o on o.id = case when f.from_child = child then f.to_child else f.from_child end
  where public.is_my_child(child) and (f.from_child = child or f.to_child = child)
  order by f.status, o.nickname
$$;

-- every request waiting for this guardian's approval, across all their children
create or replace function public.guardian_requests()
returns table (fid bigint, to_nickname text, from_nickname text, from_level int, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, t.nickname, s.nickname, s.level, f.created_at
  from public.friendships f
  join public.children t on t.id = f.to_child and t.guardian_id = auth.uid()
  join public.children s on s.id = f.from_child
  where f.status = 'pending'
  order by f.created_at
$$;

create or replace function public.respond_friend_request(fid bigint, approve boolean, pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f public.friendships;
begin
  select * into f from public.friendships where id = fid;
  if not found or not public.is_my_child(f.to_child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  if not public._pin_ok(pin) then return public._pin_err(); end if;
  if approve then update public.friendships set status = 'approved' where id = fid;
  else delete from public.friendships where id = fid; end if;
  return jsonb_build_object('ok', true);
end $$;

-- either family can end a friendship (guardian PIN)
create or replace function public.remove_friend(fid bigint, pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f public.friendships;
begin
  select * into f from public.friendships where id = fid;
  if not found or not (public.is_my_child(f.from_child) or public.is_my_child(f.to_child)) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  if not public._pin_ok(pin) then return public._pin_err(); end if;
  delete from public.friendships where id = fid;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- friend rooms (live races go over Supabase Realtime, only for the host and their approved friends) ----------
create or replace function public._room_member(code text, child uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.rooms r join public.children h on h.id = r.host_child
    join public.children me on me.id = child
    where r.code = _room_member.code and r.created_at > now() - interval '3 hours'
      and coalesce((me.controls->>'rooms')::boolean, true)
      and (r.host_child = child or exists (
        select 1 from public.friendships f where f.status = 'approved'
          and least(f.from_child, f.to_child) = least(r.host_child, child)
          and greatest(f.from_child, f.to_child) = greatest(r.host_child, child)))
  )
$$;

create or replace function public.create_room(child uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  if not coalesce((select (controls->>'rooms')::boolean from public.children where id = child), true) then return jsonb_build_object('ok', false, 'err', 'rooms_off'); end if;
  delete from public.rooms where host_child = child or created_at < now() - interval '3 hours';
  loop v_code := public._new_code(4); exit when not exists (select 1 from public.rooms r where r.code = v_code); end loop;
  insert into public.rooms (code, host_child) values (v_code, child);
  return jsonb_build_object('ok', true, 'code', v_code);
end $$;

create or replace function public.join_room(child uuid, code text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare h text;
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  code := upper(btrim(code));
  if not exists (select 1 from public.rooms r where r.code = join_room.code and r.created_at > now() - interval '3 hours') then return jsonb_build_object('ok', false, 'err', 'no_room'); end if;
  if not public._room_member(code, child) then return jsonb_build_object('ok', false, 'err', 'not_friend'); end if;
  select c.nickname into h from public.rooms r join public.children c on c.id = r.host_child where r.code = join_room.code;
  return jsonb_build_object('ok', true, 'code', code, 'host', h);
end $$;

create or replace function public.close_room(child uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_my_child(child) then return jsonb_build_object('ok', false, 'err', 'not_mine'); end if;
  delete from public.rooms where host_child = child;
  return jsonb_build_object('ok', true);
end $$;

-- open rooms hosted by approved friends
create or replace function public.friend_rooms(child uuid)
returns table (code text, host text, look jsonb, opened timestamptz)
language sql stable security definer set search_path = public as $$
  select r.code, h.nickname, h.look, r.created_at
  from public.rooms r join public.children h on h.id = r.host_child
  where public.is_my_child(child) and r.host_child <> child and public._room_member(r.code, child)
  order by r.created_at desc
$$;

-- Realtime: a channel named 'room:CODE' (private) is open only to the host and approved friends
create or replace function public.can_use_room(topic text) returns boolean
language sql stable security definer set search_path = public as $$
  select topic like 'room:%' and exists (
    select 1 from public.children c where c.guardian_id = auth.uid() and public._room_member(substr(topic, 6), c.id))
$$;

do $$ begin
  if to_regclass('realtime.messages') is not null then
    execute 'drop policy if exists "malang room read" on realtime.messages';
    execute 'create policy "malang room read" on realtime.messages for select to authenticated using (realtime.messages.extension in (''broadcast'', ''presence'') and public.can_use_room(realtime.topic()))';
    execute 'drop policy if exists "malang room write" on realtime.messages';
    execute 'create policy "malang room write" on realtime.messages for insert to authenticated with check (realtime.messages.extension in (''broadcast'', ''presence'') and public.can_use_room(realtime.topic()))';
  end if;
end $$;

-- ---------- who may call what ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public._pin_ok(text) from authenticated;
revoke execute on function public._new_code(int) from authenticated;
