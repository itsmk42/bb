-- Run this only if builderjo@admin.com shows email_not_confirmed on login.
-- Open Supabase SQL Editor and execute.

update auth.users
set email_confirmed_at = now(),
    updated_at = now()
where email = 'builderjo@admin.com';
