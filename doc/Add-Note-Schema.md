# Add Note schema

The form matches the example note cards. No extra title or session field is required.

| Field | Source | Validation |
| --- | --- | --- |
| author_org | Required organisation input | Trimmed, 1-200 characters |
| day | Required event-day selector | Day 1, Day 2, or Day 3 |
| notes | Required note text | Trimmed, 1-5,000 characters |
| photo_urls | Optional picture URL input | Empty array or one HTTPS URL, max 2,048 characters; no embedded credentials |
| user_id | Verified server session | Auth user UUID; cannot be supplied by form |
| author_name | Verified account profile, email-name fallback | Up to 100 characters; cannot be supplied by form |
| author_initials | Server-derived from author name | Generated automatically |
| id | Database | Generated UUID |
| created_at | Database | Timestamp with time zone; displayed in Harare time |

Organisation is self-reported display information, not an authorization role.
The author display name comes from the account profile; ownership is enforced by
user_id, not by a display name, organisation or initials.

Request example:

```json
{
  "author_org": "Africa Ahead",
  "day": "Day 1",
  "notes": "Follow up with partners about the shared learning platform.",
  "photo_urls": []
}
```

The shared Zod schema is in src/lib/programme/documentation.ts. Both the form and
POST /api/programme/docs use it. Unknown request fields are rejected.

Run supabase/migrations/20260919_note_fields.sql in Supabase SQL Editor before
using the updated form. It is repeatable, preserves existing rows, and enforces
ownership with RLS to match the current personal-notes API. Legacy notes without
user_id remain inaccessible to personal-note queries. New rows must satisfy the
field constraints; historical rows are not retroactively rewritten or assigned.
Do not rerun earlier documentation policy migrations after this one.

No remote migration has been applied by this change. Verify persistence by adding
a note with your account and reloading. A second account must not see that note.
