"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { CATEGORY_LABELS, PERSON_CATEGORIES, type Person, type PersonCategory } from "@/lib/people";
import { PersonAvatar } from "./PersonAvatar";

interface FormState {
  full_name: string;
  slug: string;
  role: string;
  organization: string;
  bio: string;
  photo_url: string;
  category: PersonCategory;
  aliases: string; // one per line
  advisor_slug: string;
  is_featured: boolean;
  is_published: boolean;
  sort_order: number;
}

const emptyForm: FormState = {
  full_name: "", slug: "", role: "", organization: "", bio: "", photo_url: "", category: "speaker",
  aliases: "", advisor_slug: "", is_featured: false, is_published: true, sort_order: 100,
};

const toForm = (person: Person): FormState => ({
  full_name: person.full_name, slug: person.slug, role: person.role ?? "", organization: person.organization ?? "",
  bio: person.bio ?? "", photo_url: person.photo_url ?? "", category: person.category, aliases: person.aliases.join("\n"),
  advisor_slug: person.advisor_slug ?? "", is_featured: person.is_featured, is_published: person.is_published, sort_order: person.sort_order,
});

const toPayload = (form: FormState) => ({
  ...form,
  slug: form.slug.trim() || undefined,
  aliases: form.aliases.split("\n").map(alias => alias.trim()).filter(Boolean),
});

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const labelClass = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500";

/** Reads a JSON reply; a crashed server returns an HTML error page instead, so fall back to the status code. */
async function readJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !json.error) json.error = `The server hit an error (${res.status}). Please try again.`;
  return json;
}

async function fetchPeople(): Promise<Person[]> {
  const res = await fetch("/api/people?all=true", { cache: "no-store" });
  const json = await readJson(res);
  if (!res.ok) throw new Error(json.error || "Failed to load profiles");
  return json.people;
}

export function PeopleAdmin() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    () =>
      fetchPeople()
        .then(list => { setPeople(list); setLoadError(""); })
        .catch(err => setLoadError(err instanceof Error ? err.message : "Failed to load profiles"))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    fetchPeople()
      .then(setPeople)
      .catch(err => setLoadError(err instanceof Error ? err.message : "Failed to load profiles"))
      .finally(() => setLoading(false));
  }, []);

  const openEditor = (person?: Person) => {
    setEditingId(person ? person.id : "new");
    setForm(person ? toForm(person) : emptyForm);
    setFormError("");
  };

  const update = (patch: Partial<FormState>) => setForm(prev => ({ ...prev, ...patch }));

  const uploadPhoto = async (file: File) => {
    setUploading(true);
    setFormError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/people/photo", { method: "POST", body });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Photo upload failed");
      update({ photo_url: json.url });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const save = async () => {
    setSaving(true);
    setFormError("");
    try {
      const isNew = editingId === "new";
      const res = await fetch(isNew ? "/api/people" : `/api/people/${editingId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(json.error || "Failed to save profile");
      setEditingId(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const quickToggle = async (person: Person, patch: Partial<Person>) => {
    const next = { ...person, ...patch };
    setPeople(prev => prev.map(p => (p.id === person.id ? next : p)));
    const res = await fetch(`/api/people/${person.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toPayload(toForm(next))),
    });
    if (!res.ok) await load();
  };

  const remove = async (person: Person) => {
    if (!confirm(`Delete ${person.full_name}'s profile? This also removes their uploaded photo.`)) return;
    const res = await fetch(`/api/people/${person.id}`, { method: "DELETE" });
    if (res.ok) {
      if (editingId === person.id) setEditingId(null);
      await load();
    }
  };

  const missingPhotos = people.filter(person => !person.photo_url).length;

  return (
    <div className="page-container flex flex-col gap-5">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0E1726]" style={{ fontFamily: "var(--font-sans)" }}>Speaker Profiles</h1>
          <p className="mt-1 text-sm text-[#6B7590]">
            Profiles appear on <Link href="/speakers" className="font-semibold text-blue-700 hover:underline">/speakers</Link> and
            next to matching names in the programme.
            {people.length > 0 && missingPhotos > 0 && <> {missingPhotos} of {people.length} still need a photo.</>}
          </p>
        </div>
        <button onClick={() => openEditor()} className="inline-flex items-center gap-1.5 self-start rounded-xl bg-[#1C2C4F] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#162844]">
          <Plus className="h-4 w-4" /> Add person
        </button>
      </header>

      {loadError && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{loadError}</p>}

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="overflow-hidden rounded-[20px] border border-slate-200/90 bg-white shadow-sm">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading profiles…</div>
          ) : people.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No profiles yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {people.map(person => (
                <li key={person.id} className={`flex items-center gap-3 px-4 py-3 ${editingId === person.id ? "bg-blue-50/60" : ""}`}>
                  <PersonAvatar name={person.full_name} photoUrl={person.photo_url} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-[#0E1726]">
                      {person.full_name}
                      {person.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />}
                      {!person.is_published && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">Hidden</span>}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {CATEGORY_LABELS[person.category]}{person.organization ? ` · ${person.organization}` : ""}
                      {!person.photo_url && <span className="text-amber-600"> · no photo</span>}
                      {!person.bio && <span className="text-amber-600"> · no bio</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button title={person.is_featured ? "Unfeature" : "Feature"} onClick={() => quickToggle(person, { is_featured: !person.is_featured })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-500">
                      <Star className={`h-4 w-4 ${person.is_featured ? "fill-amber-400 text-amber-400" : ""}`} />
                    </button>
                    <button title={person.is_published ? "Hide" : "Publish"} onClick={() => quickToggle(person, { is_published: !person.is_published })} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                      {person.is_published ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button title="Edit" onClick={() => openEditor(person)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-700">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button title="Delete" onClick={() => remove(person)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {editingId && (
          <section className="rounded-[20px] border border-slate-200/90 bg-white p-5 shadow-sm lg:sticky lg:top-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0E1726]">{editingId === "new" ? "Add person" : "Edit profile"}</h2>
              <button onClick={() => setEditingId(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex flex-col gap-3.5">
              <div className="flex items-center gap-4">
                <PersonAvatar name={form.full_name || "?"} photoUrl={form.photo_url} size="md" />
                <div className="flex flex-col gap-1.5">
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => e.target.files?.[0] && uploadPhoto(e.target.files[0])} />
                  <button type="button" disabled={uploading} onClick={() => fileInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    {form.photo_url ? "Replace photo" : "Upload photo"}
                  </button>
                  {form.photo_url && <button type="button" onClick={() => update({ photo_url: "" })} className="text-left text-[11px] font-semibold text-red-600 hover:underline">Remove photo</button>}
                  <p className="text-[11px] text-slate-400">JPG, PNG or WebP, up to 5 MB. Square headshots look best.</p>
                </div>
              </div>

              <div>
                <label className={labelClass}>Full name</label>
                <input className={inputClass} value={form.full_name} onChange={e => update({ full_name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Role / title</label>
                  <input className={inputClass} value={form.role} onChange={e => update({ role: e.target.value })} />
                </div>
                <div>
                  <label className={labelClass}>Organisation</label>
                  <input className={inputClass} value={form.organization} onChange={e => update({ organization: e.target.value })} />
                </div>
              </div>
              <div>
                <label className={labelClass}>Bio</label>
                <textarea rows={6} className={`${inputClass} h-auto py-2 leading-relaxed`} value={form.bio} onChange={e => update({ bio: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Type</label>
                  <select className={inputClass} value={form.category} onChange={e => update({ category: e.target.value as PersonCategory })}>
                    {PERSON_CATEGORIES.map(category => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Order</label>
                  <input type="number" min={0} className={inputClass} value={form.sort_order} onChange={e => update({ sort_order: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_featured} onChange={e => update({ is_featured: e.target.checked })} /> Featured</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={form.is_published} onChange={e => update({ is_published: e.target.checked })} /> Visible to attendees</label>
              </div>

              <details className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-sm">
                <summary className="cursor-pointer text-xs font-bold text-slate-600">Advanced</summary>
                <div className="mt-3 flex flex-col gap-3">
                  <div>
                    <label className={labelClass}>Other names in the agenda</label>
                    <textarea rows={2} className={`${inputClass} h-auto py-2`} placeholder="One per line, e.g. Doug Griffiths" value={form.aliases} onChange={e => update({ aliases: e.target.value })} />
                    <p className="mt-1 text-[11px] text-slate-400">Programme names are matched on the part before a comma or bracket.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Profile link</label>
                      <input className={inputClass} placeholder="auto from name" value={form.slug} onChange={e => update({ slug: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelClass}>1:1 adviser link</label>
                      <input className={inputClass} placeholder="e.g. alice-gentile" value={form.advisor_slug} onChange={e => update({ advisor_slug: e.target.value })} />
                    </div>
                  </div>
                </div>
              </details>

              {formError && <p className="rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-700">{formError}</p>}

              <div className="flex items-center gap-2 pt-1">
                <button onClick={save} disabled={saving || uploading || !form.full_name.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C2C4F] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#162844] disabled:opacity-60">
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save profile
                </button>
                {editingId !== "new" && form.slug && (
                  <Link href={`/speakers/${form.slug}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
                    View <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
