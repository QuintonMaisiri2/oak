const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8").replace(/\r\n/g,"\n");
const write=(p,s)=>fs.writeFileSync(p,s);
function edit(p,fn){write(p,fn(read(p)));}
for(const p of ["src/lib/supabase/server.ts","src/lib/supabase/middleware.ts","src/proxy.ts"]){
 edit(p,s=>{
  s='import { AUTH_COOKIE_OPTIONS } from "@/lib/auth/policy";\n'+s;
  s=s.replace(/return createServerClient\(supabaseUrl, supabaseAnonKey, \{/g,'return createServerClient(supabaseUrl, supabaseAnonKey, {\n    cookieOptions: AUTH_COOKIE_OPTIONS,');
  s=s.replace(/createServerClient\(supabaseUrl!, supabaseAnonKey!, \{/g,'createServerClient(supabaseUrl!, supabaseAnonKey!, {\n        cookieOptions: AUTH_COOKIE_OPTIONS,');
  s=s.replace(/const supabase = createServerClient\(supabaseUrl, supabaseAnonKey, \{/g,'const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {\n    cookieOptions: AUTH_COOKIE_OPTIONS,');
  s=s.replace(/\.set\(name, value, options\)/g,'.set(name, value, { ...options, ...AUTH_COOKIE_OPTIONS })');
  if(p==="src/proxy.ts"){
   s=s.replace('import { AUTH_COOKIE_OPTIONS }','import { AUTH_COOKIE_OPTIONS, isStaffUser }');
   s=s.replace("user && user.email?.toLowerCase().endsWith('@uncommon.org')","isStaffUser(user)");
   s=s.replace('return NextResponse.redirect(loginUrl);','const denied = NextResponse.redirect(loginUrl);\n      response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));\n      return denied;');
  }
  return s;
 });
}
for(const p of ["src/app/admin/login/page.tsx","src/app/admin/set-password/page.tsx"]){
 edit(p,s=>{
  s=s.replace('useRouter, useSearchParams','useSearchParams');
  s=s.replace(/^import .*supabase\/client.*\n/gm,"").replace(/^import .*setAdminSession.*\n/gm,"");
  s=s.replace('  const router = useRouter();\n','');
  s=s.replace('  const detailsParam = searchParams.get("details");\n','');
  s=s.replace(/^      setError\(.*detailsParam.*\n/m,'      setError("Authentication failed. Please try signing in again.");\n');
  s=s.replace('[errorParam, detailsParam]','[errorParam]');
  const start=s.indexOf('  const handleGoogleLogin = async () => {');
  const end=s.indexOf('\n  return (',start);
  const path=p.includes("set-password")?'"/admin"':'nextPath';
  s=s.slice(0,start)+'  const handleGoogleLogin = () => {\n'+(p.includes("set-password")?'    if (!isValidAdminEmail) return;\n':'')+
   '    setIsLoading(true);\n    setError(null);\n    window.location.assign("/api/auth/start?next=" + encodeURIComponent('+path+'));\n  };\n'+s.slice(end);
  return s;
 });
}
edit("src/components/Sidebar.tsx",s=>{
 s=s.replace('import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";','import { getSessionStatus } from "@/lib/session";');
 const start=s.indexOf('        if (isSupabaseConfigured()) {');
 const end=s.indexOf('\n      } catch',start);
 return s.slice(0,start)+'        const status = await getSessionStatus();\n        if (mounted) setIsStaff(status.isStaff);'+s.slice(end);
});
edit("src/components/admin/AdminHeader.tsx",s=>s.replace(/^import .*supabase\/client.*\n/gm,""));
edit("src/app/admin/page.tsx",s=>{
 const start=s.indexOf('  // Verify admin session on mount');
 const end=s.indexOf('  // Load attendance data',start);
 s=s.slice(0,start)+'  // Access is enforced by the server proxy and each API endpoint.\n\n'+s.slice(end);
 s=s.replace('const handleSignOut = () => {\n    clearAdminSession();','const handleSignOut = async () => {\n    try { await clearAdminSession(); } catch { setError("Unable to sign out. Please try again."); return; }');
 return s;
});
for(const p of ["src/app/(public)/page.tsx","src/app/(public)/dashboard/[role]/page.tsx"]){
 edit(p,s=>{
  s=s.replace('import { getPartnerSession, getAdminSession } from "@/lib/session";','import { getSessionStatus } from "@/lib/session";');
  const start=s.indexOf('  useEffect(() => {');
  const end=s.indexOf('  }, [router]);',start)+'  }, [router]);'.length;
  const root=p==="src/app/(public)/page.tsx";
  const block='  useEffect(() => {\n    let mounted = true;\n    getSessionStatus().then(({ isStaff, partnerId }) => {\n      if (!mounted) return;\n      if (isStaff) router.replace("/admin");\n      else if (partnerId) router.replace("/pass/" + partnerId);\n      else '+(root?'setIsChecking(false)':'router.replace("/")')+';\n    }).catch(() => { if (mounted) '+(root?'setIsChecking(false)':'router.replace("/")')+'; });\n    return () => { mounted = false; };\n  }, [router]);';
  return s.slice(0,start)+block+s.slice(end);
 });
}
write("src/app/staff-access/page.tsx",'import { redirect } from "next/navigation";\nexport default function StaffAccessPage() { redirect("/admin"); }\n');
edit("src/components/registration/RegistrationForm.tsx",s=>{
 s=s.replace(/^import .*setPartnerSession.*\n/gm,"");
 s=s.replace(/^      document.cookie =.*oak_role.*\n      setPartnerSession\(passId\);/m,'      // The registration action sets an HttpOnly pass bookmark.');
 s=s.replace('      // eslint-disable-next-line react-hooks/immutability\n','');
 return s;
});
for(const p of ["src/app/api/check-in/route.ts","src/app/api/attendees/route.ts","src/app/api/attendees/export/route.ts"]){
 edit(p,s=>{
  s='import { requireStaff } from "@/lib/auth/server";\n'+s;
  if(p.includes("check-in")){
   s='import { isSameOrigin } from "@/lib/auth/policy";\n'+s;
   s=s.replace('    const rawBody = await request.json();','    if (!isSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });\n    const access = await requireStaff();\n    if (access.response) return access.response;\n    const { client: adminClient, user } = access;\n    const rawBody = await request.json();');
   const start=s.indexOf('    const serverClient = await createClient();');
   const end=s.indexOf('    const cleanId',start);
   s=s.slice(0,start)+s.slice(end);
   s=s.replace('const targetIdentifier = parseScannedQrPayload(code);','const targetIdentifier = parseScannedQrPayload(code);\n    if (!targetIdentifier) return NextResponse.json({ error: "Invalid QR code" }, { status: 400 });');
   s=s.replace("attendeeQuery.ilike('event_code', cleanId)","attendeeQuery.eq('event_code', cleanId.toUpperCase())");
   s=s.replace("      cleanId\n    );","      cleanId\n    );\n    if (!isUuid && !/^OAK-2026-\\d{4}-[A-Z0-9]{4}$/i.test(cleanId)) return NextResponse.json({ error: 'Invalid QR code' }, { status: 400 });");
   s=s.replace("    const adminClient = createAdminClient();",'    const access = await requireStaff();\n    if (access.response) return access.response;\n    const adminClient = access.client;');
   s=s.replace("import { createAdminClient, createClient } from '@/lib/supabase/server';\n","");
  }else if(p.includes("export")){
   s=s.replace('    let attendees: Attendee[] = [];','    const access = await requireStaff();\n    if (access.response) return access.response;\n    let attendees: Attendee[] = [];');
   s=s.replace('      const serverClient = await createClient();\n      const adminClient = createAdminClient();\n\n      // Verify admin session if auth is configured\n      await serverClient.auth.getUser();','      const adminClient = access.client;');
   s=s.replace('createAdminClient, createClient, isSupabaseServerConfigured','isSupabaseServerConfigured');
  }else{
   s=s.replace("import { createAdminClient } from '@/lib/supabase/server';\n","");
   s=s.replace('    const adminClient = createAdminClient();','    const access = await requireStaff();\n    if (access.response) return access.response;\n    const adminClient = access.client;');
  }
  s=s.replace(/err: any/g,'err: unknown').replace(/err\.message \|\| /g,'');
  return s;
 });
}
edit("src/app/api/attendees/[id]/route.ts",s=>{
 s=s.replace("    const decodedId = decodeURIComponent(id).trim();","    const decodedId = id.trim();\n    if (!/^(?:[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}|OAK-2026-\\d{4}-[A-Z0-9]{4})$/i.test(decodedId)) return NextResponse.json({ error: 'Invalid attendee identifier' }, { status: 400 });");
 s=s.replace(".select('*');",".select('id,event_code,first_name,last_name,organization,sub_partner,role,created_at');");
 s=s.replace("query.ilike('event_code', decodedId)","query.eq('event_code', decodedId.toUpperCase())");
 for(const field of ["email","phone","dietaryRequirements","accessibilityRequirements","travelRequirements","accommodationRequirements"]){
  s=s.replace(new RegExp('^        '+field+':.*\\n','m'),'');
 }
 return s.replace('err: any','err: unknown').replace("err.message || ","");
});
