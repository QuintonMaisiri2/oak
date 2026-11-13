"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { useState, useRef, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, AlertCircle, ArrowLeft, ArrowRight, LogIn } from "lucide-react";
import { registrationSchema, RegistrationFormData } from "@/lib/validation/schemas";
import { registerAttendee as registerAttendeeServer } from "@/app/(public)/register/actions";

const STEPS: { title: string; description: string; fields: (keyof RegistrationFormData)[] }[] = [
  { title: "About you", description: "Your name and how we can reach you.", fields: ["firstName", "lastName", "email", "phone"] },
  { title: "Organisation & role", description: "Who you're attending with and in what capacity.", fields: ["organization", "subPartner", "role"] },
  { title: "Requirements & consent", description: "Anything we should plan for (all optional), then confirm.", fields: ["dietary", "accessibility", "accommodation", "consent"] },
];

const stepOf = (field: string) => Math.max(0, STEPS.findIndex(step => step.fields.includes(field as keyof RegistrationFormData)));

function organizationOptions(names: string[]) {
  return [...new Set([...names, "OAK Foundation"])].sort((a, b) => a.localeCompare(b)).filter(name => name !== "Other").concat("Other");
}

export function RegistrationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isAlreadyRegistered, setIsAlreadyRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [partnerOptions, setPartnerOptions] = useState<string[]>(() => organizationOptions([]));
  const [partnerData, setPartnerData] = useState<{ name: string; categories: string[] }[]>([]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    async function loadPartners() {
      try {
        const res = await fetch('/api/partners', { signal: controller.signal });
        if (!res.ok) throw new Error('Failed to fetch partners');
        const partners: { name: string; categories: string[] }[] = await res.json();
        if (mounted && partners.length > 0) {
          setPartnerData(partners);
          setPartnerOptions(organizationOptions(partners.map(p => p.name)));
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Failed to load partners:", err);
      } finally {
        clearTimeout(timeout);
      }
    }
    loadPartners();
    return () => { mounted = false; clearTimeout(timeout); controller.abort(); };
  }, []);

  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");
  const filteredPartnerOptions = partnerOptions.filter(org =>
    org.toLowerCase().includes(orgSearch.trim().toLowerCase())
  );
  const [selectedOrgOption, setSelectedOrgOption] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const scrollToFormTop = () => formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const router = useRouter();
  const searchParams = useSearchParams();
  const urlEmail = searchParams?.get("email") || "";
  const errorParam = searchParams?.get("error");
  
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    trigger,
    control,
    formState: { errors },
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: "onTouched",
  });

  useEffect(() => {
    if (urlEmail) {
      setValue("email", urlEmail, { shouldValidate: true });
    }
  }, [urlEmail, setValue]);

  const selectedRole = useWatch({ control, name: "role" });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsRoleDropdownOpen(false);
      }
      if (orgDropdownRef.current && !orgDropdownRef.current.contains(event.target as Node)) {
        setIsOrgDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const onError = (fieldErrors: typeof errors) => {
    setIsAlreadyRegistered(false);
    setRegisteredEmail(null);
    const firstKey = Object.keys(fieldErrors)[0] as keyof RegistrationFormData | undefined;
    const firstMsg = firstKey ? fieldErrors[firstKey]?.message : undefined;
    setSubmitError(firstMsg || "Please fill in all required fields accurately.");
    if (firstKey) setStep(stepOf(firstKey));

    // Scroll to the first error
    if (firstKey) {
      const el = document.getElementById(firstKey) || (firstKey === 'role' ? dropdownRef.current : firstKey === 'organization' ? orgDropdownRef.current : null);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }
    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onSubmit = async (data: RegistrationFormData) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setIsAlreadyRegistered(false);
    setRegisteredEmail(null);
    
    try {
      // 1. Server validation and database persistence
      const serverResult = await registerAttendeeServer(data);
      if (!serverResult.success) {
        setSubmitError(serverResult.error);
        if (serverResult.isAlreadyRegistered) {
          setIsAlreadyRegistered(true);
          setRegisteredEmail(serverResult.registeredEmail || data.email);
        }
        if (serverResult.errors) {
          const failedKeys = Object.entries(serverResult.errors).filter(([, msgs]) => msgs && msgs[0]).map(([key]) => key);
          for (const [key, msgs] of Object.entries(serverResult.errors)) {
            if (msgs && msgs[0]) {
              setError(key as any, { type: 'server', message: msgs[0] });
            }
          }
          // Send the user back to the earliest step with a server-side error
          if (failedKeys.length) setStep(Math.min(...failedKeys.map(stepOf)));
        }
        formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setIsSubmitting(false);
        return;
      }

      const passId = serverResult.eventCode || serverResult.attendeeId;
      const emailParam = encodeURIComponent(data.email.trim().toLowerCase());
      const roleParam = encodeURIComponent(data.role);
      const isStaffAdmin = data.role === 'Coordination Team' || data.role === 'OAK Staff';

      if (isStaffAdmin) {
        router.push(`/admin/login?email=${emailParam}&registered=true&role=${roleParam}&next=${encodeURIComponent(`/pass/${passId}`)}`);
        return;
      }

      // Public attendees (Grantee, Presenter, Observer) are redirected to sign in with Google to view their protected ticket pass
      router.push(`/admin/login?registered=true&email=${emailParam}&role=${roleParam}&next=${encodeURIComponent(`/pass/${passId}`)}`);
    } catch (error: any) {
      console.error("Registration error:", error);
      setSubmitError(error.message || 'An error occurred during registration.');
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = async () => {
    const valid = await trigger(STEPS[step].fields, { shouldFocus: true });
    if (!valid) return;
    setSubmitError(null);
    setStep(current => Math.min(current + 1, STEPS.length - 1));
    scrollToFormTop();
  };

  // Enter on an earlier step advances instead of submitting the whole form.
  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (step < STEPS.length - 1) {
      event.preventDefault();
      void goNext();
      return;
    }
    return handleSubmit(onSubmit, onError)(event);
  };

  return (
    <div className="space-y-4">
      {errorParam === "not-registered" && urlEmail && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-sm font-medium flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">No existing registration found for &quot;{urlEmail}&quot;</p>
            <p className="text-xs text-amber-800 mt-0.5">Please complete the form below to register for the convening and receive your event entry pass.</p>
            <p className="text-xs text-amber-800 mt-1">
              Already registered with a different email?{" "}
              <a href="/admin/login" className="font-bold underline">Sign in with an email code</a> sent to that address instead.
            </p>
          </div>
        </div>
      )}

      <section className="bg-white rounded-[24px] p-[20px] border border-slate-100 shadow-sm" data-purpose="registration-form-container">
        <div ref={formTopRef} />
        <ol className="mb-5 grid grid-cols-3 gap-2" aria-label="Registration steps">
          {STEPS.map((s, i) => (
            <li key={s.title} className="min-w-0" aria-current={i === step ? "step" : undefined}>
              <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-[#1A2F50]" : "bg-slate-200"}`} />
              <p className={`mt-2 truncate text-[11px] font-semibold ${i === step ? "text-[#1A2F50]" : "text-slate-400"}`}>{s.title}</p>
            </li>
          ))}
        </ol>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Step {step + 1} of {STEPS.length}</p>
        <h2 className="text-[18px] leading-[28px] font-semibold text-slate-900 tracking-normal">{STEPS[step].title}</h2>
        <p className="mb-6 text-[13px] text-[#6B7590]">{STEPS[step].description}</p>

        {submitError && (
          <div
            className={`mb-5 p-4 rounded-xl border text-sm font-medium ${
              isAlreadyRegistered
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isAlreadyRegistered ? 'text-amber-600' : 'text-red-500'}`} />
              <div className="space-y-2 flex-1">
                <p className="font-semibold leading-relaxed">{submitError}</p>
                {isAlreadyRegistered && (
                  <div className="pt-1">
                    <Link
                      href={`/admin/login?email=${encodeURIComponent(registeredEmail || "")}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#1A2F50] text-white rounded-xl text-xs font-bold hover:bg-[#162844] transition-colors shadow-xs"
                    >
                      <span>Sign In to View Ticket</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-5" noValidate>
          <div className={step === 0 ? "space-y-5" : "hidden"}>
            <div className="grid grid-cols-2 gap-[20px]">
              {/* First Name */}
              <div>
                <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-2" htmlFor="firstName">
                  FIRST NAME <span className="text-red-500">*</span>
                </label>
                <input 
                  id="firstName"
                  {...register("firstName")}
                  type="text" 
                  placeholder="Maria"
                  className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.firstName ? 'ring-2 ring-red-500 border-red-400' : ''}`}
                />
                {errors.firstName && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.firstName.message}</p>}
              </div>
              {/* Last Name */}
              <div>
                <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-2" htmlFor="lastName">
                  LAST NAME <span className="text-red-500">*</span>
                </label>
                <input 
                  id="lastName"
                  {...register("lastName")}
                  type="text" 
                  placeholder="Schmidt"
                  className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.lastName ? 'ring-2 ring-red-500 border-red-400' : ''}`}
                />
                {errors.lastName && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-2" htmlFor="email">
                EMAIL ADDRESS <span className="text-red-500">*</span>
              </label>
              <input 
                id="email"
                {...register("email")}
                type="email" 
                placeholder="you@organisation.org"
                className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.email ? 'ring-2 ring-red-500 border-red-400' : ''}`}
              />
              {errors.email && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.email.message}</p>}
            </div>

            {/* Phone Number */}
            <div>
              <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-2" htmlFor="phone">
                PHONE NUMBER
              </label>
              <input 
                id="phone"
                {...register("phone")}
                type="tel" 
                placeholder="+41 xx xxx xx xx"
                className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.phone ? 'ring-2 ring-red-500 border-red-400' : ''}`}
              />
              {errors.phone && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.phone.message}</p>}
            </div>
          </div>

          <div className={step === 1 ? "space-y-5" : "hidden"}>
            {/* Organisation */}
            <div ref={orgDropdownRef}>
              <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-2" htmlFor="organization">
                ORGANISATION <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {selectedOrgOption !== "Other" && (
                  <input type="hidden" id="organization" {...register("organization")} />
                )}
                <button 
                  type="button"
                  className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm flex justify-between items-center cursor-pointer transition-all outline-none ${(errors.organization && selectedOrgOption !== 'Other') ? 'ring-2 ring-red-500 border-red-400' : 'focus:ring-2 focus:ring-[#1A2F50]'}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setOrgSearch("");
                    setIsOrgDropdownOpen(!isOrgDropdownOpen);
                  }}
                >
                  <span className={selectedOrgOption ? "text-slate-800 font-medium" : "text-slate-400"}>
                    {selectedOrgOption || "Select your organisation"}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOrgDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                {isOrgDropdownOpen && (
                  <div className="absolute z-50 top-full mt-2 w-full left-0 max-h-[240px] overflow-y-auto overscroll-contain scrollbar-hide bg-white rounded-[15px] shadow-lg border border-slate-100 pb-[10px] flex flex-col items-center">
                    <div className="sticky top-0 z-10 w-full shrink-0 bg-white p-2">
                      <input
                        type="search"
                        autoFocus
                        aria-label="Search grantee organisations"
                        placeholder="Search grantees..."
                        value={orgSearch}
                        onChange={(event) => setOrgSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") event.preventDefault();
                          if (event.key === "Escape") {
                            event.preventDefault();
                            setIsOrgDropdownOpen(false);
                            orgDropdownRef.current?.querySelector("button")?.focus();
                          }
                        }}
                        className="h-10 w-full rounded-lg bg-[#EEF1F5] px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#1A2F50]"
                      />
                    </div>
                    <button type="button"
                      className="w-full md:w-[calc(100%-24px)] h-[30px] px-[10px] py-[3px] rounded-[5px] font-sans font-normal text-[15px] leading-[22.5px] text-slate-700 cursor-pointer hover:bg-[#162E55] hover:text-white transition-colors flex items-center shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedOrgOption("");
                        setValue("organization", "", { shouldValidate: true });
                        setValue("subPartner", "", { shouldValidate: true });
                        setIsOrgDropdownOpen(false);
                      }}
                    >
                      Select your organisation
                    </button>

                    {filteredPartnerOptions.map(org => (
                      <button type="button"
                        key={org}
                        className="w-full md:w-[calc(100%-24px)] h-[30px] px-[10px] py-[3px] rounded-[5px] font-sans font-normal text-[15px] leading-[22.5px] cursor-pointer text-slate-700 hover:bg-[#162E55] hover:text-white transition-colors flex items-center shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrgOption(org);
                          if (org !== "Other") {
                            setValue("organization", org, { shouldValidate: true });
                          
                            const pData = partnerData.find(p => p.name === org);
                            if (pData && pData.categories && pData.categories.length > 0 && !pData.categories.includes("Other")) {
                              setValue("subPartner", pData.categories.join(", "), { shouldValidate: true });
                            } else {
                              setValue("subPartner", "", { shouldValidate: true });
                            }
                          } else {
                            setValue("organization", "", { shouldValidate: true });
                            setValue("subPartner", "", { shouldValidate: true });
                          }
                          setIsOrgDropdownOpen(false);
                        }}
                      >
                        {org}
                      </button>
                    ))}
                    {filteredPartnerOptions.length === 0 && (
                      <p role="status" className="w-full px-3 py-4 text-sm text-slate-500">No matching grantees. Clear the search to see all options.</p>
                    )}
                  </div>
                )}
              </div>
            
              {selectedOrgOption === "Other" && (
                <div className="mt-3">
                  <input 
                    id="organization"
                    {...register("organization")}
                    type="text" 
                    placeholder="Please specify your organisation"
                    className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.organization ? 'ring-2 ring-red-500 border-red-400' : ''}`}
                  />
                </div>
              )}
              {errors.organization && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.organization.message}</p>}
            </div>

            {/* Sub-grantee / Programme Area */}
            <div>
              <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-2" htmlFor="subPartner">
                SUB-GRANTEE / PROGRAMME AREA
              </label>
              <input 
                id="subPartner"
                {...register("subPartner")}
                type="text" 
                placeholder="Optional"
                className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.subPartner ? 'ring-2 ring-red-500 border-red-400' : ''}`}
              />
              {errors.subPartner && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.subPartner.message}</p>}
            </div>

            {/* Role / Capacity */}
            <div ref={dropdownRef}>
              <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-2" htmlFor="role">
                ROLE / CAPACITY <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input type="hidden" id="role" {...register("role")} />
                <button 
                  type="button"
                  className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm flex justify-between items-center cursor-pointer transition-all outline-none ${errors.role ? 'ring-2 ring-red-500 border-red-400' : 'focus:ring-2 focus:ring-[#1A2F50]'}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsRoleDropdownOpen(!isRoleDropdownOpen);
                  }}
                >
                  <span className={selectedRole ? "text-slate-800 font-medium" : "text-slate-400"}>
                    {selectedRole || "Select your role"}
                  </span>
                  <svg className={`w-4 h-4 text-slate-400 transition-transform ${isRoleDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                {isRoleDropdownOpen && (
                  <div className="absolute z-50 top-full mt-2 w-full left-0 h-auto bg-white rounded-[15px] shadow-lg border border-slate-100 py-[10px] flex flex-col items-center">
                  
                    <div 
                      className="w-full md:w-[calc(100%-24px)] h-[30px] px-[10px] py-[3px] rounded-[5px] font-sans font-normal text-[15px] leading-[22.5px] text-slate-700 cursor-pointer hover:bg-[#162E55] hover:text-white transition-colors flex items-center shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        setValue("role", "" as any, { shouldValidate: true });
                        setIsRoleDropdownOpen(false);
                      }}
                    >
                      Select your role
                    </div>

                    {["Grantee", "OAK Staff", "Coordination Team", "Presenter", "Observer"].map(role => (
                      <div 
                        key={role}
                        className="w-full md:w-[calc(100%-24px)] h-[30px] px-[10px] py-[3px] rounded-[5px] font-sans font-normal text-[15px] leading-[22.5px] cursor-pointer text-slate-700 hover:bg-[#162E55] hover:text-white transition-colors flex items-center shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setValue("role", role as RegistrationFormData["role"], { shouldValidate: true });
                          setIsRoleDropdownOpen(false);
                        }}
                      >
                        {role}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedRole === 'OAK Staff' && (
                <p className="text-[11px] text-[#1C2E5A] bg-[#EEF1F5] rounded-xl px-3 py-2 mt-2 font-medium border border-slate-200">
                  💡 Authorized staff with an <strong>@oakfnd.org, @oakfnd.ch, or @uncommon.org</strong> email on the admin allowlist will have full access to the admin dashboard.
                </p>
              )}
              {errors.role && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.role.message}</p>}
            </div>
          </div>

          <div className={step === 2 ? "space-y-5" : "hidden"}>
            {/* Requirements Container Box */}
            <div className="bg-[#EDF1F7]/70 rounded-2xl p-5 space-y-4 border border-slate-100" data-purpose="requirements-container">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                REQUIREMENTS
              </span>
            
              {/* Dietary Requirements */}
              <div>
                <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-1.5" htmlFor="dietary">
                  DIETARY REQUIREMENTS
                </label>
                <input 
                  id="dietary"
                  {...register("dietary")}
                  type="text" 
                  placeholder="e.g. Vegetarian, Halal, Gluten-free"
                  className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.dietary ? 'ring-2 ring-red-500 border-red-400' : ''}`}
                />
                {errors.dietary && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.dietary.message}</p>}
              </div>

              {/* Accessibility Requirements */}
              <div>
                <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-1.5" htmlFor="accessibility">
                  ACCESSIBILITY REQUIREMENTS
                </label>
                <input 
                  id="accessibility"
                  {...register("accessibility")}
                  type="text" 
                  placeholder="e.g. Wheelchair access, hearing loop"
                  className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.accessibility ? 'ring-2 ring-red-500 border-red-400' : ''}`}
                />
                {errors.accessibility && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.accessibility.message}</p>}
              </div>

              {/* Travel & Accommodation */}
              <div>
                <label className="block font-sans text-[12px] leading-[16px] font-semibold text-[#6B7590] uppercase tracking-[0.3px] mb-1.5" htmlFor="accommodation">
                  TRAVEL & ACCOMMODATION
                </label>
                <input 
                  id="accommodation"
                  {...register("accommodation")}
                  type="text" 
                  placeholder="e.g. Flight from London, hotel needed"
                  className={`w-full bg-[#EEF1F5] border border-slate-200 rounded-[14px] h-[52.5px] px-[16px] py-[14px] text-sm text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-[#1A2F50] focus:bg-white transition-all outline-none ${errors.accommodation ? 'ring-2 ring-red-500 border-red-400' : ''}`}
                />
                {errors.accommodation && <p className="text-[12px] font-medium text-red-600 mt-1.5">{errors.accommodation.message}</p>}
              </div>
            </div>

            {/* Consent Checkbox Card */}
            <div className={`border rounded-2xl p-[20px] flex items-start space-x-3.5 bg-white transition-colors ${errors.consent ? 'border-red-400 bg-red-50/20' : 'border-slate-200/90'}`}>
              <input 
                id="consent"
                {...register("consent")}
                type="checkbox"
                className="w-[20px] h-[20px] mt-0.5 rounded-[6px] border-2 border-[#1C2E5A2E] text-[#1A2F50] focus:ring-[#1A2F50] cursor-pointer shrink-0"
              />
              <label htmlFor="consent" className="font-sans text-[14px] leading-[22.75px] text-slate-600 tracking-normal font-normal cursor-pointer">
                I agree to OAK Foundation&apos;s <Link href="/privacy" target="_blank" className="underline underline-offset-2 text-[#1A2F50] font-bold hover:text-blue-900">privacy policy</Link> and consent to my registration data being used for event coordination.
              </label>
            </div>
            {errors.consent && <p className="text-[12px] font-medium text-red-600 mt-1">{errors.consent.message}</p>}
          </div>

          <div className="flex items-center gap-3 pt-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => { setStep(step - 1); setSubmitError(null); scrollToFormTop(); }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-[18px] text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                key="next"
                type="button"
                onClick={goNext}
                className="flex-1 bg-[#1A2F50] hover:bg-[#162844] text-white font-bold text-sm p-[18px] rounded-2xl shadow-sm transition flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                key="submit"
                type="submit"
                disabled={isSubmitting}
                className={`flex-1 bg-[#1A2F50] hover:bg-[#162844] text-white font-bold text-sm p-[18px] rounded-2xl shadow-sm transition flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <span>{isSubmitting ? "Processing..." : "Register & Generate QR Code"}</span>
              </button>
            )}
          </div>

          <div className="pt-2 pb-1 flex items-center justify-center gap-2 text-xs text-slate-500 text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Your data is protected and handled according to our <Link href="/privacy" target="_blank" className="font-semibold text-[#1A2F50] hover:underline">Privacy Policy</Link>.</span>
          </div>
        </form>
      </section>

      {/* Bottom Card: Already Registered */}
      <div className="p-5 rounded-2xl bg-[#EEF1F5] border border-slate-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
            <LogIn className="w-5 h-5 text-[#162E55]" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">Already registered?</p>
            <p className="text-xs text-slate-500">Sign in with Google or an email code to retrieve your event ticket and QR code.</p>
          </div>
        </div>
        <Link
          href="/admin/login"
          className="shrink-0 px-4 py-2.5 bg-[#162E55] hover:bg-[#1C2E5A] text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-2"
        >
          <span>Sign In</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
