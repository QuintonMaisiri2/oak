"use client";
// Force Turbopack to rebuild

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileText, ImageIcon, Lightbulb, NotebookPen, Plus, X, Trash2 } from "lucide-react";
import { noteSchema, type DocumentationPost } from "@/lib/programme/documentation";

interface GalleryPhoto { id: string; name: string; thumbnail: string; full: string }
import { createSpeakerMatcher, type PersonSummary } from "@/lib/people";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { SessionRecaps, photosUrlFor } from "./SessionRecaps";

// Notes come only from what attendees and staff add. Day recaps live in SessionRecaps.
const defaultSessionNotes: DocumentationPost[] = [];

const takeawaysByDay: Record<string, string[]> = {
  "Day 1": [
    "Oak sees partnership as more than funding: trust, honest two-way dialogue and partner feedback matter as much as the grant.",
    "Oak is committed to flexible, multi-year core support that backs whole organisations, not only projects.",
    "The Zimbabwe portfolio has grown to 36 direct grantees and about 25 sub-grantees, so intermediary organisations play a key role.",
    "Oak wants to clarify expectations between intermediaries and sub-grantees and welcomes feedback on where the system is unclear.",
    "With other funding shrinking, Oak will help partners connect with other philanthropies and provide recommendations.",
    "This convening is a chance for grantees to meet, learn from each other and find areas to collaborate.",
  ],
  "Day 2": [
    "Real partnership goes beyond money: hands-on support, honest conversations and a funder that stays when times are hard.",
    "Partnerships should outlast any single grant. Grantees want their own platforms to keep working together.",
    "Open your networks. Introducing peers to funders costs nothing and grows the whole sector.",
    "Your story is your strongest asset for alternative funding, from company marketing budgets to social enterprise.",
    "There is no one-size-fits-all funding model: diversify, invest in relationships and stay true to your mission.",
    "Oak will explore peer-to-peer learning, grant opening meetings and introductions to other funders, and core grants can adapt to crises such as El Nino.",
  ],
  "Day 3": [
    "Oak prefers to stay in the background: you don't need to acknowledge Oak, and any use of its name or logo needs approval from Oak's communications team.",
    "Tell your story with asset-based language that highlights people's strengths, and let Oak help amplify it.",
    "Every partner needs two safeguarding basics: a safeguarding lead and clear reporting and response procedures.",
    "Keep safeguarding policies few, comprehensive and actually used. Oak can link you to expert support.",
    "Partners left with concrete plans to work together, from psychosocial support to tech skills and social enterprise.",
    "Oak will follow up with peer calls, introductions to other funders, clearer expectations for intermediaries and an online grants platform.",
  ],
};


const resources = [
  { id: "1", title: "Opening Plenary Presentation", format: "PDF", size: "3.2 MB", day: "Day 1" },
  { id: "2", title: "OAK Portfolio Overview 2024-26", format: "PDF", size: "1.8 MB", day: "Day 2" },
  { id: "3", title: "Action Planning Workbook", format: "DOCX", size: "0.9 MB", day: "Day 3" },
  { id: "4", title: "Grantee Contact Directory", format: "XLSX", size: "0.4 MB", day: "All Days" },
  { id: "5", title: "Photo Gallery (High Res)", format: "ZIP", size: "184 MB", day: "All Days" }
];

export function ProgrammeDocs({ canManage = false, activeDayLabel = "Day 1", dayLabels = ["Day 1", "Day 2", "Day 3"], people = [] }: { canManage?: boolean, activeDayLabel?: string, dayLabels?: string[], people?: PersonSummary[] }) {
  const matchSpeaker = useMemo(() => createSpeakerMatcher(people), [people]);
  const [personalPosts, setPersonalPosts] = useState<DocumentationPost[]>([]);
  const [adding, setAdding] = useState(false);
  const currentDayLabel = activeDayLabel;
  const [day, setDay] = useState(currentDayLabel);
  
  // Sync the form day when tab changes
  useEffect(() => { setDay(currentDayLabel) }, [currentDayLabel]);

  const [notes, setNotes] = useState("");
  const [organization, setOrganization] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [gallery, setGallery] = useState<{ day: string; total: number; photos: GalleryPhoto[] } | null>(null);

  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Fetch personal notes from the DB
    async function load() {
      try {
        const response = await fetch("/api/programme/docs");
        const data = await response.json();
        if (response.ok) {
          setPersonalPosts(data.posts || []);
          setAuthorName(data.author?.name || "");
          setOrganization(current => current || data.author?.organization || "");
        }
      } catch (err) {
        console.error("Failed to fetch notes:", err);
      }
    }
    
    void load();
  }, []);

  // The day's gallery: six random photos from that day's folder, a new set on each page load.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/programme/gallery?day=${encodeURIComponent(currentDayLabel)}`, { cache: "no-store" })
      .then(response => (response.ok ? response.json() : null))
      .then(data => {
        if (!cancelled) setGallery({ day: currentDayLabel, total: data?.total ?? 0, photos: data?.photos ?? [] });
      })
      .catch(() => {
        if (!cancelled) setGallery({ day: currentDayLabel, total: 0, photos: [] });
      });
    return () => { cancelled = true; };
  }, [currentDayLabel]);

  const galleryReady = gallery?.day === currentDayLabel;
  const galleryPhotos = galleryReady ? gallery.photos : [];
  const galleryTotal = galleryReady ? gallery.total : 0;

  useEffect(() => { if (adding) input.current?.focus(); }, [adding]);

  async function saveNote(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setFormError("");
    setNotice("");
    const parsed = noteSchema.safeParse({ day, notes, author_org: organization, photo_urls: photoUrl.trim() ? [photoUrl.trim()] : [] });
    if (!parsed.success) { setFormError(parsed.error.issues[0].message); return; }
    setSaving(true);

    try {
      const payload = parsed.data;

      const response = await fetch("/api/programme/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setPersonalPosts(current => [data.post, ...current]);
      setNotes("");
      setPhotoUrl("");
      setAdding(false);
      setNotice("Your note was saved.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save note");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      const response = await fetch(`/api/programme/docs?id=${id}`, { method: "DELETE" });
      if (!response.ok) {
         const data = await response.json();
         throw new Error(data.error || "Failed to delete note");
      }
      setPersonalPosts(current => current.filter(post => post.id !== id));
      setNotice("Note deleted.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete note");
    }
  }

  // Combine default mock notes with personal DB notes, filtered by the active day
  const allNotes = [...defaultSessionNotes, ...personalPosts].filter(n => n.day === currentDayLabel);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <SessionRecaps dayLabel={currentDayLabel} match={matchSpeaker} />

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#0E1726]">
            <NotebookPen aria-hidden="true" className="h-5 w-5 text-[#425780]" />
            Session Notes
          </h2>
          <button
            type="button"
            onClick={() => { setAdding(!adding); setFormError(""); setNotice(""); }}
            disabled={saving}
            aria-expanded={adding}
            aria-controls="add-note-form"
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#162E55] px-3.5 text-[11px] font-bold tracking-wide text-white shadow-sm hover:bg-[#1C2E5A] transition-colors"
          >
            {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {adding ? "Cancel" : "Add Note"}
          </button>
        </div>

        {adding && (
          <form id="add-note-form" onSubmit={saveNote} className="mb-6 rounded-[20px] border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="font-semibold text-sm text-[#162E55]">{canManage ? "Add Session Note" : "Add Personal Note"}</h3>
            <p className="text-xs text-slate-500">Fields marked * are required. Your name and posting time are added automatically.</p>
            <label className="block text-sm font-medium text-slate-700">
              Author
              <input readOnly value={authorName || "Your signed-in account"} className="mt-1.5 block h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Organisation *
              <input required maxLength={200} autoComplete="organization" value={organization} onChange={event => setOrganization(event.target.value)} disabled={saving} placeholder="Your organisation" className="mt-1.5 block h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Event day *
              <select required value={day} onChange={e => setDay(e.target.value)} disabled={saving} className="mt-1.5 block h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm">
                {dayLabels.map(d => <option key={d}>{d}</option>)}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Note *
              <textarea ref={input} required maxLength={5000} value={notes} onChange={e => setNotes(e.target.value)} disabled={saving} rows={4} placeholder="What did you learn?" className="mt-1.5 block w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" />
            </label>



            <p className="text-xs text-slate-500">{notes.length}/5,000 characters</p>
            {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving || !notes.trim() || !organization.trim()} className="h-10 rounded-xl bg-[#162E55] px-5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? "Saving…" : "Save Note"}
              </button>
            </div>
          </form>
        )}

        {notice && <p role="status" className="mb-3 text-sm text-green-800">{notice}</p>}
        {allNotes.length === 0 && !adding && (
          <p className="rounded-[20px] border border-dashed border-slate-200 bg-white/60 p-5 text-center text-[13px] text-slate-500">
            No notes for {currentDayLabel} yet. Tap Add Note to share what you learned.
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {allNotes.map((note) => (
            <article key={note.id} className="overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-sm flex flex-col">
              {note.photo_urls && note.photo_urls.length > 0 && (
                <div className="w-full shrink-0 bg-slate-100">
                  <img src={note.photo_urls[0]} alt="Attached note picture" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                </div>
              )}
              <div className="p-5 flex-1 flex flex-col">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar name={note.author_name ?? "Guest"} photoUrl={note.author_name ? matchSpeaker(note.author_name)?.photo_url : null} size="sm" />
                    <div className="min-w-0">
                      <h3 className="text-[13px] font-bold text-slate-900 leading-tight">
                        {note.author_name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium truncate">
                        {note.author_org}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-[10px] font-semibold text-slate-500">
                      {note.day} • {new Date(note.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Harare" })}
                    </span>
                    {personalPosts.some(p => p.id === note.id) && (
                      <button type="button" onClick={() => deleteNote(note.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete note">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[14px] leading-[1.7] text-slate-700 whitespace-pre-wrap">
                  {note.notes}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Photo Gallery Section: the day's fixed picks from its Drive folder */}
      {(!galleryReady || galleryPhotos.length > 0) && (
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-[17px] font-bold text-[#0E1726]">
            <ImageIcon aria-hidden="true" className="h-5 w-5 text-[#425780]" />
            Photo Gallery
          </h2>
          {galleryTotal > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-medium text-slate-400">
                {galleryPhotos.length} of {galleryTotal} photos
              </span>
              {photosUrlFor(currentDayLabel) && (<a href={photosUrlFor(currentDayLabel)} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-[#162E55] px-3.5 text-[11px] font-bold tracking-wide text-white hover:bg-[#1C2E5A] shadow-sm transition-colors">
                <Download className="h-3.5 w-3.5" />
                All {currentDayLabel} photos
              </a>)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {!galleryReady
            ? Array.from({ length: 6 }, (_, i) => <div key={i} className="aspect-[4/3] animate-pulse rounded-[14px] bg-slate-200/70" />)
            : galleryPhotos.map(photo => (
              <a key={photo.id} href={photo.full} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-[14px] bg-slate-100 shadow-sm">
                <img
                  src={photo.thumbnail}
                  alt={`${currentDayLabel} convening photo`}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </a>
            ))}
        </div>
      </section>
      )}

      {/* Key Takeaways Section */}
      {takeawaysByDay[currentDayLabel] && (
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-[#0E1726]">
          <Lightbulb aria-hidden="true" className="h-5 w-5 text-[#425780]" />
          Key Takeaways
        </h2>
        <div className="rounded-[20px] border border-slate-100 bg-white p-6 shadow-sm">
          <ol className="space-y-4">
            {(takeawaysByDay[currentDayLabel] ?? []).map((takeaway, index) => (
              <li key={index} className="flex items-start gap-3.5">
                <span className="mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#162E55] text-[10px] font-bold text-white">
                  {index + 1}
                </span>
                <p className="text-[13px] leading-[1.6] text-slate-700">
                  {takeaway}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      )}

      {/* Resources Section */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 text-[17px] font-bold text-[#0E1726]">
          <Download aria-hidden="true" className="h-5 w-5 text-[#425780]" />
          Resources
        </h2>
        <div className="space-y-3">
          {resources.filter(r => r.day === currentDayLabel || r.day === "All Days").map(resource => (
            <button key={resource.id} type="button" className="w-full flex items-center gap-3.5 rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm transition hover:border-slate-300">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#F4F5F7]">
                <FileText aria-hidden="true" className="h-[22px] w-[22px] text-slate-400 stroke-[1.5]" />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <h3 className="text-[13px] font-bold text-slate-900 truncate">
                  {resource.title}
                </h3>
                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                  {resource.format} · {resource.size} · {resource.day}
                </p>
              </div>
              <Download aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}

