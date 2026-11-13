// The downloadable agenda is now the designed PDF in /public/programme.
// This route stays so existing links to /programme/agenda keep working.
// (The previous auto-generated version lives in src/lib/programme/agenda-pdf.ts.)
export function GET(request: Request) {
  return Response.redirect(new URL("/programme/Oak-Grantee-Convening-2026-Agenda.pdf", request.url), 307);
}
