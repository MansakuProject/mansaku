alter table public.reviews
add column if not exists developer_comment text;

alter table public.reviews
add column if not exists developer_comment_visible boolean not null default false;
