import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, v);
    } else if (value) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  redirect(query ? `/admin/login?${query}` : "/admin/login");
}
