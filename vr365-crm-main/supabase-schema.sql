-- Run this in your Supabase SQL editor

create table if not exists guests (
  id text primary key,
  name text not null,
  email text,
  phone text,
  notes text default '',
  tags text[] default '{}',
  aliases text[] default '{}',
  created_at timestamp with time zone default now()
);

create table if not exists bookings (
  id text primary key,
  guest_id text references guests(id) on delete cascade,
  property text,
  unit_code text,
  check_in date,
  check_out date,
  amount numeric default 0,
  channel text,
  date_booked date,
  guest_name text,
  guest_email text,
  created_at timestamp with time zone default now()
);

-- Indexes for fast search
create index if not exists idx_guests_email on guests(email);
create index if not exists idx_guests_name on guests(name);
create index if not exists idx_bookings_guest_id on bookings(guest_id);
create index if not exists idx_bookings_check_in on bookings(check_in);
create index if not exists idx_bookings_channel on bookings(channel);
create index if not exists idx_bookings_unit_code on bookings(unit_code);

-- Enable full text search on guests
create index if not exists idx_guests_fts on guests using gin(to_tsvector('english', coalesce(name,'') || ' ' || coalesce(email,'')));
