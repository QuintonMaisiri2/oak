-- Agenda update: "Oak Grantee Convening Revised Draft Agenda" (kr update, 4 Nov).
-- Run in the Supabase SQL editor. Replaces the whole agenda (programme_agenda row id = 'main').
--
-- Speakers stay linked to their /speakers profiles: every person is written as
-- "Name, Organisation" or "Name (Oak)", and each name is a people.full_name or alias.
-- Item ids are unchanged (agenda-1-1 ... agenda-3-7).
-- Any session location staff already set in the admin editor is kept where this file leaves it blank.
-- The previous version is archived automatically in programme_agenda_revisions (rollback at the bottom).

BEGIN;

WITH new_agenda AS (
  SELECT $agenda$[
  {
    "id": "day-1",
    "label": "Day 1",
    "dateStr": "Monday, 9 November 2026",
    "theme": "Afternoon",
    "items": [
      {
        "kind": "break",
        "data": {
          "id": "agenda-1-1",
          "dayId": "day-1",
          "time": "14:00 – 15:00",
          "title": "Arrival, registration & badge collection",
          "type": "break"
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-1-2",
          "dayId": "day-1",
          "startTime": "15:00",
          "endTime": "15:10",
          "title": "National Anthem + Performance (Dzikwa Dance Group)",
          "category": "Social",
          "location": "",
          "speakers": [
            {
              "name": "Dzikwa Dance Group"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-1-3",
          "dayId": "day-1",
          "startTime": "15:10",
          "endTime": "15:30",
          "title": "Welcome & Introduction to Oak Foundation",
          "description": "Welcome by Doug Griffiths, Oak Foundation President (via video link).\nIntroduction to Oak Foundation by Cheryl Chang, Oak Foundation Chief of Staff.\nOak Zimbabwe Programme by Karl Riber, Oak Zimbabwe Head of Office.",
          "category": "Plenary",
          "location": "",
          "isFeatured": true,
          "speakers": [
            {
              "name": "Doug Griffiths, Oak Foundation President (via video link)"
            },
            {
              "name": "Cheryl Chang, Oak Foundation Chief of Staff"
            },
            {
              "name": "Karl Riber, Oak Zimbabwe Head of Office"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-1-4",
          "dayId": "day-1",
          "startTime": "15:30",
          "endTime": "15:50",
          "title": "Grantee showcase: Uncommon.org and JF Kapnek Zimbabwe",
          "category": "Plenary",
          "location": "",
          "speakers": [
            {
              "name": "Uncommon.org"
            },
            {
              "name": "JF Kapnek Zimbabwe"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-1-5",
          "dayId": "day-1",
          "startTime": "15:50",
          "endTime": "16:00",
          "title": "Orientation: agenda walkthrough, logistics briefing (MC-led)",
          "category": "Plenary",
          "location": "",
          "speakers": []
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-1-6",
          "dayId": "day-1",
          "startTime": "16:00",
          "endTime": "17:00",
          "title": "Speed Networking Session (among grantees)",
          "category": "Networking",
          "location": "",
          "speakers": []
        }
      },
      {
        "kind": "break",
        "data": {
          "id": "agenda-1-7",
          "dayId": "day-1",
          "time": "17:00",
          "title": "End of Day 1: Guests are free to leave · Optional 1:1 / small-group meetings: grantees & Oak staff (by request)",
          "type": "break"
        }
      }
    ]
  },
  {
    "id": "day-2",
    "label": "Day 2",
    "dateStr": "Tuesday, 10 November 2026",
    "theme": "Full day",
    "items": [
      {
        "kind": "break",
        "data": {
          "id": "agenda-2-1",
          "dayId": "day-2",
          "time": "08:00 – 08:20",
          "title": "Arrival",
          "type": "break"
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-2",
          "dayId": "day-2",
          "startTime": "08:30",
          "endTime": "09:00",
          "title": "Grantee Showcase videos + intros from Ele Collection, Young Africa",
          "category": "Plenary",
          "location": "",
          "speakers": [
            {
              "name": "Ele Collection"
            },
            {
              "name": "Young Africa"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-3",
          "dayId": "day-2",
          "startTime": "09:00",
          "endTime": "10:00",
          "title": "Keynote Panel & Discussion: Beyond Funding: Building Resilient Partnerships for Greater Impact",
          "description": "Moderated by Michelle Gwatiringa, Uncommon.\nPanellists: Charity Bafana (Restless Development), Natalie Simbini (Friendship Bench), Rati Moyo (Childline), Tatenda Songore (Youth Advocates).",
          "category": "Panel",
          "location": "",
          "isFeatured": true,
          "speakers": [
            {
              "name": "Michelle Gwatiringa, Uncommon (Moderator)"
            },
            {
              "name": "Charity Bafana, Restless Development"
            },
            {
              "name": "Natalie Simbini, Friendship Bench"
            },
            {
              "name": "Rati Moyo, Childline"
            },
            {
              "name": "Tatenda Songore, Youth Advocates"
            }
          ]
        }
      },
      {
        "kind": "break",
        "data": {
          "id": "agenda-2-4",
          "dayId": "day-2",
          "time": "10:00 – 10:30",
          "title": "Tea break",
          "type": "break"
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-5",
          "dayId": "day-2",
          "startTime": "10:30",
          "endTime": "11:15",
          "title": "Monitoring, Evaluation & Learning session",
          "category": "Workshop",
          "location": "",
          "speakers": [
            {
              "name": "Silvia Guizzardi (Oak)"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-6",
          "dayId": "day-2",
          "startTime": "11:15",
          "endTime": "12:00",
          "title": "Organizational Development session",
          "category": "Workshop",
          "location": "",
          "speakers": [
            {
              "name": "Alice Gentile (Oak)"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-7",
          "dayId": "day-2",
          "startTime": "12:00",
          "endTime": "13:15",
          "title": "1st Round of Breakout Sessions",
          "description": "Each track closes with key takeaways captured for the closing reflections.",
          "category": "Breakout",
          "location": "",
          "speakers": [],
          "tracks": [
            {
              "title": "Evidence-based impact",
              "location": "Plenary Room",
              "speakers": [
                {
                  "name": "Silvia Guizzardi, Oak Foundation"
                },
                {
                  "name": "Hillary Tanyanyiwa, JF Kapnek Zimbabwe"
                },
                {
                  "name": "Eleonora Aralla, CAFOD"
                },
                {
                  "name": "Tapiwa Takaona, Friendship Bench"
                }
              ]
            },
            {
              "title": "Alternative funding models",
              "location": "Room TBC",
              "speakers": [
                {
                  "name": "Simon Teede, Ele Collection — private company, CSR"
                },
                {
                  "name": "Lloyd Masunda, SAT — blended financing and ownership"
                },
                {
                  "name": "Ngonidzashe Nyambawaro, Island Hospice — Social Enterprise"
                }
              ]
            },
            {
              "title": "Resource Mobilization",
              "location": "Room TBC",
              "speakers": [
                {
                  "name": "Shupikai Chisero, HOSPAZ"
                },
                {
                  "name": "Rebecca Gumbo, Bethany Project"
                },
                {
                  "name": "Daniel McKenzie, KidzCan"
                }
              ]
            }
          ]
        }
      },
      {
        "kind": "break",
        "data": {
          "id": "agenda-2-8",
          "dayId": "day-2",
          "time": "13:15 – 14:15",
          "title": "Lunch",
          "type": "break"
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-9",
          "dayId": "day-2",
          "startTime": "14:15",
          "endTime": "15:30",
          "title": "2nd Round of Breakout Sessions",
          "category": "Breakout",
          "location": "",
          "speakers": [],
          "tracks": [
            {
              "title": "Evidence-based impact",
              "speakers": [
                {
                  "name": "Silvia Guizzardi, Oak Foundation"
                },
                {
                  "name": "Hillary Tanyanyiwa, JF Kapnek Zimbabwe"
                },
                {
                  "name": "Eleonora Aralla, CAFOD"
                },
                {
                  "name": "Tapiwa Chikwana, Friendship Bench"
                }
              ]
            },
            {
              "title": "Alternative funding models",
              "speakers": [
                {
                  "name": "Simon Teede, Ele Collection — private company, CSR"
                },
                {
                  "name": "Lloyd Masunda, SAT — blended financing and ownership"
                },
                {
                  "name": "Ngonidzashe Nyambawaro, Island Hospice — Social Enterprise"
                }
              ]
            },
            {
              "title": "Resource Mobilization",
              "speakers": [
                {
                  "name": "Shupikai Chisero, HOSPAZ"
                },
                {
                  "name": "Rebecca Gumbo, Bethany Project"
                },
                {
                  "name": "Daniel McKenzie, KidzCan"
                }
              ]
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-10",
          "dayId": "day-2",
          "startTime": "15:30",
          "endTime": "16:30",
          "title": "Plenary review of breakout sessions",
          "category": "Plenary",
          "location": "",
          "speakers": []
        }
      },
      {
        "kind": "break",
        "data": {
          "id": "agenda-2-11",
          "dayId": "day-2",
          "time": "16:30 – 16:45",
          "title": "Short break, tea ONLY, NO SNACKS",
          "type": "break"
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-12",
          "dayId": "day-2",
          "startTime": "16:45",
          "endTime": "17:30",
          "title": "MEL & OD breakouts for those interested (1:1)",
          "category": "Workshop",
          "location": "",
          "speakers": []
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-2-13",
          "dayId": "day-2",
          "startTime": "17:30",
          "endTime": "20:00",
          "title": "Gala Dinner",
          "description": "Entertainment will include a featured performance in the background (Tariro NeGitare).",
          "category": "Social",
          "location": "",
          "speakers": []
        }
      }
    ]
  },
  {
    "id": "day-3",
    "label": "Day 3",
    "dateStr": "Wednesday, 11 November 2026",
    "theme": "Morning",
    "items": [
      {
        "kind": "break",
        "data": {
          "id": "agenda-3-1",
          "dayId": "day-3",
          "time": "08:30",
          "title": "Arrival",
          "type": "break"
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-3-2",
          "dayId": "day-3",
          "startTime": "08:45",
          "endTime": "09:30",
          "title": "Oak Communications session",
          "category": "Workshop",
          "location": "",
          "isFeatured": true,
          "speakers": [
            {
              "name": "Cheryl Chang (Oak)"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-3-3",
          "dayId": "day-3",
          "startTime": "09:30",
          "endTime": "10:15",
          "title": "Safeguarding session",
          "category": "Workshop",
          "location": "",
          "speakers": [
            {
              "name": "Alice Gentile (Oak)"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-3-4",
          "dayId": "day-3",
          "startTime": "10:15",
          "endTime": "10:30",
          "title": "Reflections & way forward",
          "category": "Plenary",
          "location": "",
          "speakers": [
            {
              "name": "Karl Riber (Oak)"
            }
          ]
        }
      },
      {
        "kind": "session",
        "data": {
          "id": "agenda-3-5",
          "dayId": "day-3",
          "startTime": "10:30",
          "endTime": "10:45",
          "title": "Group photograph",
          "category": "Social",
          "location": "",
          "speakers": []
        }
      },
      {
        "kind": "break",
        "data": {
          "id": "agenda-3-6",
          "dayId": "day-3",
          "time": "10:45 – 11:15",
          "title": "Tea",
          "type": "break"
        }
      },
      {
        "kind": "break",
        "data": {
          "id": "agenda-3-7",
          "dayId": "day-3",
          "time": "11:15",
          "title": "Departure",
          "type": "break"
        }
      }
    ]
  }
]$agenda$::jsonb AS days
),
old_locations AS (
  SELECT i.item->'data'->>'id' AS item_id, i.item->'data'->>'location' AS location
  FROM public.programme_agenda pa
  CROSS JOIN LATERAL jsonb_array_elements(pa.days) AS d(day)
  CROSS JOIN LATERAL jsonb_array_elements(d.day->'items') AS i(item)
  WHERE pa.id = 'main'
    AND i.item->>'kind' = 'session'
    AND coalesce(i.item->'data'->>'location', '') <> ''
),
merged AS (
  SELECT jsonb_agg(
           jsonb_set(d.day, '{items}', (
             SELECT jsonb_agg(
                      CASE
                        WHEN ol.location IS NOT NULL AND coalesce(i.item->'data'->>'location', '') = ''
                          THEN jsonb_set(i.item, '{data,location}', to_jsonb(ol.location))
                        ELSE i.item
                      END
                      ORDER BY i.ord)
             FROM jsonb_array_elements(d.day->'items') WITH ORDINALITY AS i(item, ord)
             LEFT JOIN old_locations ol ON ol.item_id = i.item->'data'->>'id'
           ))
           ORDER BY d.ord) AS days
  FROM new_agenda
  CROSS JOIN LATERAL jsonb_array_elements(new_agenda.days) WITH ORDINALITY AS d(day, ord)
)
INSERT INTO public.programme_agenda (id, days, updated_at, updated_by, updated_by_email)
SELECT 'main', days, now(), NULL, 'SQL: revised agenda (4 Nov)' FROM merged
ON CONFLICT (id) DO UPDATE
  SET days = EXCLUDED.days,
      updated_at = EXCLUDED.updated_at,
      updated_by = NULL,
      updated_by_email = EXCLUDED.updated_by_email;

-- Check: one row per agenda item, in order.
SELECT d.day->>'label' AS day,
       coalesce(i.item->'data'->>'time', (i.item->'data'->>'startTime') || ' - ' || (i.item->'data'->>'endTime')) AS time,
       i.item->'data'->>'title' AS title,
       i.item->'data'->>'location' AS location
FROM public.programme_agenda pa
CROSS JOIN LATERAL jsonb_array_elements(pa.days) WITH ORDINALITY AS d(day, dord)
CROSS JOIN LATERAL jsonb_array_elements(d.day->'items') WITH ORDINALITY AS i(item, iord)
WHERE pa.id = 'main'
ORDER BY d.dord, i.iord;

COMMIT;

-- Rollback (only if needed): restore the version this replaced.
-- UPDATE public.programme_agenda
-- SET days = (SELECT days FROM public.programme_agenda_revisions ORDER BY id DESC LIMIT 1),
--     updated_at = now(), updated_by = NULL, updated_by_email = 'SQL: rollback'
-- WHERE id = 'main';
