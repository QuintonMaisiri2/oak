-- Correct the Friendship Bench speaker's name in the live agenda.
-- "Tapiwa Chikwana" was a mix-up: the Evidence-based impact speaker is Tapiwa Takaona (Friendship Bench).
-- (Tapiwa Chikwanha of the Uncommon coordination team is a different person and is not touched.)
--
-- Run in the Supabase SQL editor. Changes only that one name in programme_agenda (id = 'main').
-- Safe to run more than once.

UPDATE public.programme_agenda
SET days = replace(days::text, 'Tapiwa Chikwana, Friendship Bench', 'Tapiwa Takaona, Friendship Bench')::jsonb,
    updated_at = now()
WHERE id = 'main'
  AND days::text LIKE '%Tapiwa Chikwana, Friendship Bench%';

-- Check: should return 0 rows.
SELECT id FROM public.programme_agenda
WHERE id = 'main' AND days::text LIKE '%Chikwana, Friendship Bench%';
