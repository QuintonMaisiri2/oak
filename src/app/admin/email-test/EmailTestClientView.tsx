"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Server,
  Info,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Clock,
  Key,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface ConfigStatus {
  provider: "resend" | "smtp" | "none";
  isConfigured: boolean;
  fromEmail: string;
  smtpVerification?: {
    success: boolean;
    message: string;
    error?: string;
    rawError?: string;
  } | null;
  vars: {
    RESEND_API_KEY: boolean;
    EMAIL_FROM: boolean;
    EMAIL_PROVIDER: boolean;
    SMTP_HOST: boolean;
    SMTP_PORT: boolean;
    SMTP_USER: boolean;
    SMTP_PASS: boolean;
    SMTP_SECURE: boolean;
  };
  missingVars: string[];
}

interface EmailTestClientViewProps {
  currentUserEmail?: string;
}

interface DispatchResult {
  success: boolean;
  provider?: string;
  messageId?: string | null;
  error?: string | null;
  recipient?: string;
  sentAt?: string;
}

const TEMPLATES = [
  {
    id: "booking",
    name: "1:1 Meeting Confirmation",
    subject: "Confirmed: 1:1 Advisory Session with Silvia Guizzardi",
    message:
      "Hello,\n\nYour 1:1 advisory consultation with Silvia Guizzardi has been scheduled.\n\nDate: Tuesday, 10 November 2026\nTime: 14:00 - 14:45\n\nPlease arrive 5 minutes before your allocated time. If you need to reschedule, use the Oak Convening portal.",
  },
  {
    id: "registration",
    name: "Convening Registration Pass",
    subject: "Oak Grantee Convening 2026: Your Registration & Check-In Details",
    message:
      "Welcome to the Oak Grantee Convening 2026 in Harare, Zimbabwe.\n\nRegistration is confirmed. When you arrive at the welcome desk, please present your digital nametag badge.\n\nConvening Dates: 9-11 November 2026\nLocation: Harare, Zimbabwe",
  },
  {
    id: "broadcast",
    name: "Operational Schedule Update",
    subject: "Oak Convening Update: Morning Plenary Room Change",
    message:
      "Dear Convening Attendees,\n\nPlease note that tomorrow morning's plenary session has moved to a larger room to accommodate all participants. Please check the programme page for details.\n\nStart time remains 09:00 AM sharp.",
  },
  {
    id: "ping",
    name: "Diagnostic Telemetry Ping",
    subject: "Oak Convening Dispatch Telemetry Ping",
    message:
      "Automated system telemetry test sent from the Oak Convening Super Admin diagnostics console. All systems operational.",
  },
];

export function EmailTestClientView({ currentUserEmail = "" }: EmailTestClientViewProps) {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [authError, setAuthError] = useState(false);

  // Form State
  const [recipient, setRecipient] = useState(currentUserEmail);
  const [subject, setSubject] = useState(TEMPLATES[0].subject);
  const [message, setMessage] = useState(TEMPLATES[0].message);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("booking");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DispatchResult | null>(null);

  // Copy state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showConfigDetails, setShowConfigDetails] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoadingConfig(true);
    setAuthError(false);
    try {
      const res = await fetch("/api/admin/email-test");
      if (res.status === 401 || res.status === 403) {
        setAuthError(true);
        setConfig(null);
        return;
      }
      const data = await res.json();
      setConfig(data);
    } catch (err) {
      console.error("Failed to load email config:", err);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSelectTemplate = (tpl: typeof TEMPLATES[0]) => {
    setSelectedTemplate(tpl.id);
    setSubject(tpl.subject);
    setMessage(tpl.message);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient.trim()) return;

    setSending(true);
    setResult(null);

    const sentTimestamp = new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    try {
      const res = await fetch("/api/admin/email-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: recipient.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setResult({
          success: false,
          error: data.error || `HTTP ${res.status}: Failed to send test email`,
          provider: data.provider || config?.provider,
          recipient: recipient.trim(),
          sentAt: sentTimestamp,
        });
      } else {
        setResult({
          success: data.success,
          messageId: data.messageId,
          error: data.error,
          provider: data.provider || config?.provider,
          recipient: recipient.trim(),
          sentAt: sentTimestamp,
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        error: err.message || "Network error sending test email",
        recipient: recipient.trim(),
        sentAt: sentTimestamp,
      });
    } finally {
      setSending(false);
      fetchConfig();
    }
  };

  const configuredVarsCount = config?.vars
    ? Object.values(config.vars).filter(Boolean).length
    : 0;
  const totalVarsCount = config?.vars ? Object.keys(config.vars).length : 8;

  return (
    <div className="space-y-6">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#111C33] via-[#16284D] to-[#1C2C4F] border border-amber-500/25 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute right-24 bottom-0 w-48 h-48 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin?view=super"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Super Admin</span>
              </Link>
              <span className="text-slate-500">•</span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-400/15 text-amber-300 border border-amber-400/30">
                <Shield className="w-3 h-3 text-amber-300" />
                SUPER ADMIN ONLY
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-400/15 text-blue-300 border border-blue-400/30">
                <Server className="w-3 h-3 text-blue-300" />
                DISPATCH TELEMETRY
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-blue-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
                <Mail className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Email System Diagnostics
                </h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                  Live SMTP & Resend connection monitoring, simulated attendee dispatch, and latency telemetry.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => fetchConfig()}
              disabled={loadingConfig}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingConfig ? "animate-spin" : ""}`} />
              <span>Refresh Status</span>
            </button>
            <Link
              href="/admin/activity"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/15 text-xs font-bold transition shadow-sm"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Audit Logs</span>
            </Link>
            <Link
              href="/admin/bookings"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold transition shadow-md"
            >
              <span>View Bookings</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Authorization Error Banner */}
      {authError && (
        <div className="bg-white rounded-3xl border border-rose-200 p-8 shadow-sm text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Super Admin Authorization Required</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Your current account does not have Super Admin governance privileges. Only Super Administrators can view credentials, test SMTP dispatches, or modify environment configurations.
          </p>
          <Link
            href="/admin"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#1C2C4F] hover:bg-[#162844] text-white text-xs font-bold transition shadow-xs"
          >
            Return to Dashboard
          </Link>
        </div>
      )}

      {!authError && (
        <>
          {/* 4 Interactive System Telemetry KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Active Provider */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Active Provider</span>
                <Server className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black text-slate-900 tracking-tight uppercase">
                  {loadingConfig ? "Checking..." : config?.provider || "None"}
                </span>
              </div>
              <div className="pt-1">
                {config?.isConfigured ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Operational & Ready
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                    <AlertCircle className="w-3 h-3 text-rose-600" />
                    Unconfigured
                  </span>
                )}
              </div>
            </div>

            {/* Card 2: Handshake / Ping */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Connection Ping</span>
                <ShieldCheck className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-black text-slate-900 tracking-tight truncate">
                  {loadingConfig
                    ? "Pinging..."
                    : config?.provider === "smtp"
                    ? config.smtpVerification?.success
                      ? "SMTP 250 OK"
                      : "Handshake Failed"
                    : config?.isConfigured
                    ? "Resend API Active"
                    : "Not Connected"}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {config?.provider === "smtp" && config.smtpVerification
                  ? config.smtpVerification.message
                  : config?.provider === "resend"
                  ? "REST API key recognized"
                  : "No credentials loaded"}
              </p>
            </div>

            {/* Card 3: Default Sender (FROM) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Default Sender</span>
                <Mail className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-bold text-slate-800 truncate font-mono">
                  {loadingConfig ? "Loading..." : config?.fromEmail || "Not Set"}
                </p>
                {config?.fromEmail && (
                  <button
                    onClick={() => handleCopy(config.fromEmail, "fromEmail")}
                    title="Copy sender email"
                    className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                  >
                    {copiedKey === "fromEmail" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                {config?.fromEmail.includes("resend.dev")
                  ? "⚠️ Sandbox sender address"
                  : "Verified convening sender"}
              </p>
            </div>

            {/* Card 4: Environment Variables */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>Environment Matrix</span>
                <Key className="w-4 h-4 text-slate-400" />
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xl font-black text-slate-900 tracking-tight">
                  {configuredVarsCount} / {totalVarsCount} Set
                </span>
                <button
                  onClick={() => setShowConfigDetails(!showConfigDetails)}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                >
                  {showConfigDetails ? "Hide matrix" : "View matrix"}
                </button>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((configuredVarsCount / totalVarsCount) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Collapsible Environment Variables Matrix */}
          {showConfigDetails && config?.vars && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Environment Variables Matrix (Server-Side Detection)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">
                  Values are obscured for security; presence is validated.
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {Object.entries(config.vars).map(([key, isSet]) => (
                  <div
                    key={key}
                    className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition ${
                      isSet
                        ? "bg-emerald-50/40 border-emerald-200/80 text-emerald-950"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}
                  >
                    <span className="font-mono text-[11px] truncate font-semibold">{key}</span>
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                        isSet
                          ? "bg-emerald-200 text-emerald-900"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isSet ? "SET" : "MISSING"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings & Alerts */}
          {config?.provider === "resend" && config.fromEmail.includes("onboarding@resend.dev") && (
            <div className="p-4 rounded-3xl bg-amber-50 border border-amber-200/90 flex items-start gap-3.5 text-xs text-amber-900 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <strong className="text-sm font-bold text-amber-950 block">
                  Notice regarding Resend Sandbox Mode
                </strong>
                <p className="text-amber-800 leading-relaxed">
                  The current sender is <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-semibold">onboarding@resend.dev</code>. In sandbox mode, Resend only permits dispatch to the verified account owner email. To send confirmations to attendees and Silvia Guizzardi, verify your custom domain in Resend and update <code className="bg-amber-100/80 px-1.5 py-0.5 rounded font-mono font-semibold">EMAIL_FROM</code>.
                </p>
              </div>
            </div>
          )}

          {!config?.isConfigured && (
            <div className="p-4 rounded-3xl bg-rose-50 border border-rose-200 flex items-start gap-3.5 text-xs text-rose-900 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <strong className="text-sm font-bold text-rose-950 block">
                  Email Dispatch is Currently Disabled
                </strong>
                <p className="text-rose-800 leading-relaxed">
                  Required environment variables missing: <strong>{config?.missingVars.join(", ") || "None"}</strong>. Add these in your hosting environment to enable automated notifications.
                </p>
              </div>
            </div>
          )}

          {/* Interactive Dispatch Console: 2 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column (7 cols): Dispatch Form & Templates */}
            <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-7 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Send Test Dispatch</h2>
                    <p className="text-[11px] text-slate-400">
                      Dispatches live transactional email through your active provider.
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2.5 py-1 rounded-full">
                  Live Dispatch
                </span>
              </div>

              {/* Scenario Quick-Fill Buttons */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    Quick Scenario Templates:
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-2">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className={`text-left p-3 rounded-2xl border text-xs transition cursor-pointer flex flex-col justify-between ${
                        selectedTemplate === tpl.id
                          ? "bg-[#1C2C4F] text-white border-[#1C2C4F] shadow-xs"
                          : "bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100/70"
                      }`}
                    >
                      <span className="font-bold block truncate">{tpl.name}</span>
                      <span
                        className={`text-[10px] block truncate mt-0.5 ${
                          selectedTemplate === tpl.id ? "text-slate-300" : "text-slate-400"
                        }`}
                      >
                        {tpl.subject}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSendTest} className="space-y-4">
                {/* Recipient Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Recipient Address (To) *
                    </label>
                    {currentUserEmail && (
                      <button
                        type="button"
                        onClick={() => setRecipient(currentUserEmail)}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                      >
                        Send to myself ({currentUserEmail})
                      </button>
                    )}
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="e.g. colleague@oakfnd.org"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F] bg-slate-50/50 text-slate-900 transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Delivers directly to the recipient mailbox. Check spam or junk if not received.
                  </p>
                </div>

                {/* Subject Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Subject Line *
                    </label>
                    <span className="text-[10px] text-slate-400">{subject.length} chars</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F] bg-slate-50/50 text-slate-900 transition font-medium"
                  />
                </div>

                {/* Message Body Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Message Body *
                    </label>
                    <span className="text-[10px] text-slate-400">{message.length} chars</span>
                  </div>
                  <textarea
                    rows={6}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1C2C4F] bg-slate-50/50 text-slate-900 transition font-mono text-xs leading-relaxed resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>Super Admin only</span>
                  </div>

                  <button
                    type="submit"
                    disabled={sending || !recipient.trim()}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#111C33] to-[#1C2C4F] hover:from-[#16284D] hover:to-[#243763] text-white text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Dispatching Test...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 text-amber-300" />
                        <span>Dispatch Test Email</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column (5 cols): Live Telemetry Result & Host Inspection */}
            <div className="lg:col-span-5 space-y-6">
              {/* Delivery Telemetry Result Card */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Delivery Telemetry
                    </h3>
                  </div>
                  {result && (
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                        result.success
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-rose-100 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {result.success ? "SUCCESS 200" : "ERROR"}
                    </span>
                  )}
                </div>

                {!result && !sending && (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Mail className="w-8 h-8 mx-auto text-slate-300" />
                    <p className="text-xs font-medium">Ready for dispatch.</p>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Fill out the form and dispatch a message to view live server telemetry, latency, and delivery headers.
                    </p>
                  </div>
                )}

                {sending && (
                  <div className="py-12 text-center space-y-3">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#1C2C4F]" />
                    <p className="text-xs font-bold text-slate-700">Connecting to mail exchange...</p>
                    <p className="text-[11px] text-slate-400">Executing TLS handshake and delivery payload</p>
                  </div>
                )}

                {result && !sending && (
                  <div className="space-y-3 animate-in fade-in">
                    {result.success ? (
                      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                          <strong className="text-sm font-bold text-emerald-900">
                            Email Delivered Successfully!
                          </strong>
                        </div>
                        <div className="text-xs space-y-1.5 text-emerald-900">
                          <div className="flex justify-between py-1 border-b border-emerald-200/60">
                            <span className="text-emerald-700">Target Recipient:</span>
                            <span className="font-mono font-semibold">{result.recipient}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-emerald-200/60">
                            <span className="text-emerald-700">Transport:</span>
                            <span className="font-bold uppercase">{result.provider}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-emerald-200/60">
                            <span className="text-emerald-700">Sent At:</span>
                            <span>{result.sentAt}</span>
                          </div>
                          {result.messageId && (
                            <div className="pt-1">
                              <span className="text-emerald-700 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                                Message-ID:
                              </span>
                              <div className="flex items-center justify-between bg-white/70 p-2 rounded-xl border border-emerald-200 font-mono text-[11px] text-emerald-950 break-all">
                                <span>{result.messageId}</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(result.messageId || "", "msgId")}
                                  className="ml-2 p-1 hover:bg-emerald-100 rounded text-emerald-700 cursor-pointer"
                                  title="Copy Message-ID"
                                >
                                  {copiedKey === "msgId" ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                          <strong className="text-sm font-bold text-rose-900">
                            Dispatch Failure
                          </strong>
                        </div>
                        <div className="bg-white/80 p-3 rounded-xl border border-rose-200 font-mono text-[11px] text-rose-900 break-all leading-relaxed">
                          {result.error}
                        </div>
                        <div className="text-[11px] text-rose-700 space-y-1">
                          <p className="font-semibold">Diagnostic suggestions:</p>
                          <ul className="list-disc pl-4 space-y-0.5 text-rose-600">
                            <li>Verify that the destination address exists.</li>
                            <li>If using Resend Sandbox, ensure recipient is the account owner.</li>
                            <li>For SMTP, check credentials and verify port 587 or 465.</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Server Details & Configuration Reference */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-purple-600" />
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Provider Configuration
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                  >
                    {showGuide ? "Hide guide" : "Setup guide"}
                  </button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">Selected Provider</span>
                    <span className="font-bold text-slate-900 uppercase font-mono">
                      {config?.provider}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500">SMTP Security Setting</span>
                    <span className="font-semibold text-slate-900">
                      {config?.provider !== "smtp" ? "Managed by provider" : config?.vars.SMTP_SECURE ? "SMTP_SECURE set" : "SMTP_SECURE not set"}
                    </span>
                  </div>
                </div>

                {showGuide && (
                  <div className="pt-3 border-t border-slate-100 text-xs text-slate-600 space-y-3 animate-in fade-in">
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 font-mono text-[11px] space-y-1">
                      <div className="font-bold text-slate-900 font-sans text-xs mb-1">
                        Resend Setup (Recommended)
                      </div>
                      <div>RESEND_API_KEY=re_...</div>
                      <div>EMAIL_FROM=&quot;Oak &lt;bookings@domain.org&gt;&quot;</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 font-mono text-[11px] space-y-1">
                      <div className="font-bold text-slate-900 font-sans text-xs mb-1">
                        SMTP / Nodemailer Setup
                      </div>
                      <div>EMAIL_PROVIDER=smtp</div>
                      <div>SMTP_HOST=smtp.mailgun.org</div>
                      <div>SMTP_PORT=587</div>
                      <div>SMTP_USER=postmaster@...</div>
                      <div>SMTP_PASS=...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
