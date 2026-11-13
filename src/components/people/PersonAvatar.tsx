import { initialsOf } from "@/lib/people";

const SIZES = {
  xs: "h-6 w-6 text-[9px]",
  sm: "h-9 w-9 text-[11px]",
  md: "h-14 w-14 text-base",
  lg: "h-28 w-28 text-3xl",
} as const;

/** Round profile photo with an initials fallback. */
export function PersonAvatar({ name, photoUrl, size = "sm", className = "" }: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const base = `${SIZES[size]} shrink-0 rounded-full ${className}`;
  if (photoUrl) {
    return <img src={photoUrl} alt={name} loading="lazy" className={`${base} border border-slate-200 bg-slate-100 object-cover`} />;
  }
  return (
    <span aria-hidden className={`${base} flex items-center justify-center bg-gradient-to-br from-[#1C2C4F] to-[#3B5A8C] font-bold text-white`}>
      {initialsOf(name)}
    </span>
  );
}
