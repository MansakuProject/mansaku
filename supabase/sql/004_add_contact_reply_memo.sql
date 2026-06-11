alter table public.contact_messages
add column if not exists reply_memo text;

alter table public.contact_messages
add column if not exists replied_at timestamp with time zone;