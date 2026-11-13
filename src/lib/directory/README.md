Supabase is the primary source for the partner directory and registration options.
Run supabase/migrations/20260914_partner_directory.sql in the Supabase SQL Editor.
Only records with directory_slug populated appear in the directory. Existing demo
records are preserved but excluded. Add a unique directory_slug when adding an
organisation in Supabase. It forms the public profile URL and should stay stable.

partners.json contains the 65 supplied organisations and is the fallback when
Supabase is unavailable, empty, or the migration has not been applied. Database
edits are not automatically copied back to this fallback. Rerunning the import
restores supplied names, descriptions and websites, overwriting edits to them.

Missing descriptions and websites are intentionally blank. No contact names,
regions, partnership dates or logos were supplied, so none are invented.
Two supplied website assignments are withheld pending confirmation:
- Hospaz: https://hopeforkidszimbabwe.com/ (appears to belong to Hope for Kids).
- Zvitambo: https://oakfnd.org/ (appears to belong to OAK).
Organisation names are preserved as supplied, including ZimWorks, Rafiq Girls,
and Terres Des Homme. Website contents have not been independently verified.

Directory browsing categories are inferred from descriptions by categories.ts.
They are navigation aids, not official classifications. Partners may appear in
multiple categories; unmatched descriptions appear under Other. The same rules
apply to live Supabase data and the bundled fallback; no migration is needed.
