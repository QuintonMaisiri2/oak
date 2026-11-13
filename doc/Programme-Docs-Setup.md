> Updated Add Note form and personal-note ownership schema: see [Add-Note-Schema.md](Add-Note-Schema.md). Apply `20260919_note_fields.sql` last. The staff-only setup below describes the earlier version.

# Programme documentation

Both programme pages have Schedule and Docs tabs. Public visitors see shared
resources and a staff sign-in link; session notes and Add Note remain staff-only. Docs uses the existing verified staff permission
rule; attendee registration roles do not grant access.

Run `supabase/migrations/20260918_programme_docs.sql` in Supabase SQL Editor before
deploying. It creates the documentation table if missing and restricts access to
verified staff. Existing documentation rows are preserved. No example notes,
photos, or claims from the design reference are inserted.

Session notes load and save through `/api/programme/docs`. Authorship is taken
from the verified account, never the request body. Notes accept Day 1, Day 2,
or Day 3 and up to 5,000 characters. Database failures retain the user's draft.

Photo Gallery displays existing `photo_urls` from documentation rows plus the
programme gallery data. Key Takeaways uses the existing programme data. Resources
includes the real agenda PDF plus any supplied downloadable resources. Photo
uploads and takeaway/resource editing are not part of this change.

The database migration has not been applied remotely. Test persistence by adding
a note while signed in, reloading, and confirming the note is still present.
