"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ScanLine,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Phone,
  Camera,
  WifiOff,
  CloudUpload,
  Calendar,
} from "lucide-react";
import { ScanSuccessView, type CheckInResult } from "@/components/admin/ScanSuccessView";
import { getSessionStatus } from "@/lib/session";
import { getAutoEventDay, getEventDayInfo, getHarareDateString } from "@/lib/event-days";

type QueuedScan = {
  id: string;
  code: string;
  timestamp: string;
  eventDay?: string;
  retries: number;
};

export default function AdminScanPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    getSessionStatus()
      .then(({ isStaff }) => {
        if (!mounted) return;
        if (!isStaff) {
          router.replace("/admin/login?next=/admin/scan");
        } else {
          setIsAuthorized(true);
        }
      })
      .catch(() => {
        if (mounted) router.replace("/admin/login?next=/admin/scan");
      });
    return () => {
      mounted = false;
    };
  }, [router]);
  const [scanState, setScanState] = useState<"idle" | "success" | "error">("idle");
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("Code is invalid or unregistered");
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const lastMethodRef = useRef<"camera" | "manual">("manual");
  const manualInputRef = useRef<HTMLInputElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const cameraStartingRef = useRef(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<QueuedScan[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("oak_scan_queue");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const autoDetectedDay = getAutoEventDay();
  const todayHarare = getHarareDateString();
  const [selectedDay, setSelectedDay] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("oak_scan_selected_day");
      if (stored) return stored;
    }
    return getAutoEventDay();
  });

  const isCustomTestDay =
    todayHarare !== "2026-11-09" &&
    todayHarare !== "2026-11-10" &&
    todayHarare !== "2026-11-11";

  const dayOptions = [
    { id: "2026-11-09", label: "Day 1 (9 Nov)", isToday: todayHarare === "2026-11-09" },
    { id: "2026-11-10", label: "Day 2 (10 Nov)", isToday: todayHarare === "2026-11-10" },
    { id: "2026-11-11", label: "Day 3 (11 Nov)", isToday: todayHarare === "2026-11-11" },
    ...(isCustomTestDay
      ? [{ id: todayHarare, label: `Today (${todayHarare})`, isToday: true }]
      : []),
  ];

  const handleSelectDay = (day: string) => {
    setSelectedDay(day);
    try {
      sessionStorage.setItem("oak_scan_selected_day", day);
    } catch {}
  };

  const resetToAutoDay = () => {
    setSelectedDay(autoDetectedDay);
    try {
      sessionStorage.removeItem("oak_scan_selected_day");
    } catch {}
  };
  const html5QrCodeRef = useRef<unknown>(null);
  const scannerDivId = "oak-qr-reader";

  const playSuccessSound = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // AudioContext blocked or unsupported
    }
  };

  const playWarningSound = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(370, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // AudioContext blocked or unsupported
    }
  };

  const playErrorSound = () => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(160, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // AudioContext blocked or unsupported
    }
  };

  const saveQueue = (queue: QueuedScan[]) => {
    setPendingQueue(queue);
    try {
      localStorage.setItem("oak_scan_queue", JSON.stringify(queue));
    } catch {
      // Ignore storage write errors
    }
  };

  // Perform actual check-in request
  const processCheckIn = useCallback(async (codeToProcess: string) => {
    const trimmed = codeToProcess.trim();
    if (!trimmed || isProcessingRef.current) return;

    isProcessingRef.current = true;
    setIsProcessing(true);
    const scannedAt = new Date().toISOString();

    try {
      const res = await fetch("/api/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, scannedAt, eventDay: selectedDay }),
      });

      if (!res.ok) {
        let errorMsg = "Attendee QR code not recognised";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch (e) {
          console.error("Failed to parse error response", e);
        }
        setErrorMessage(errorMsg);
        setScanState("error");
        playErrorSound();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(300);
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      const data = await res.json();

      setLastResult(data);
      setScanState("success");
      setManualCode("");

      if (data.status === "already_checked_in") {
        playWarningSound();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([150, 100, 150]);
        }
      } else {
        playSuccessSound();
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate([80, 40, 80]);
        }
      }

      // Sync local storage & notify other dashboard components
      try {
        const dbStr = localStorage.getItem("oak_attendees_db");
        if (dbStr) {
          const db = JSON.parse(dbStr);
          const id = data.attendee?.eventCode || data.attendee?.id;
          for (const key of Object.keys(db)) {
            if (
              db[key].registrationId === id ||
              db[key].qrCodeId === id ||
              db[key].eventCode === id ||
              (data.attendee?.email && db[key].email === data.attendee.email)
            ) {
              db[key].attendanceStatus = "Checked In";
              db[key].checkInTime = data.checkIn?.scannedAt || new Date().toISOString();
            }
          }
          localStorage.setItem("oak_attendees_db", JSON.stringify(db));
        }
      } catch {}

      window.dispatchEvent(new Event("oak-attendance-update"));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (netErr) {
      console.warn("Network error during check-in scan. Queuing locally (R9):", netErr);

      // Hard Rule R9: Queue locally and retry with resilience
      const queuedItem: QueuedScan = {
        id: crypto.randomUUID(),
        code: trimmed,
        timestamp: scannedAt,
        eventDay: selectedDay,
        retries: 0,
      };

      const updated = [...pendingQueue, queuedItem];
      saveQueue(updated);

      // Show temporary optimistic state
      setErrorMessage("Network offline. Scan has been safely queued and will sync once reconnected.");
      setScanState("error");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, [pendingQueue, selectedDay]);

  // Sync queued scans when back online
  const flushQueue = useCallback(async () => {
    if (pendingQueue.length === 0 || isSyncing) return;
    setIsSyncing(true);

    const remaining: QueuedScan[] = [];

    for (const item of pendingQueue) {
      try {
        const res = await fetch("/api/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: item.code, scannedAt: item.timestamp, eventDay: item.eventDay || selectedDay }),
        });

        if (!res.ok && res.status !== 404) {
          remaining.push({ ...item, retries: item.retries + 1 });
        }
      } catch {
        remaining.push({ ...item, retries: item.retries + 1 });
      }
    }

    saveQueue(remaining);
    setIsSyncing(false);
  }, [pendingQueue, isSyncing, selectedDay]);

  useEffect(() => {
    window.addEventListener("online", flushQueue);
    return () => window.removeEventListener("online", flushQueue);
  }, [flushQueue]);

  // Stop camera helper
  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        const scanner = html5QrCodeRef.current as {
          isScanning: boolean;
          stop: () => Promise<void>;
          clear: () => void;
        };
        if (scanner.isScanning) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (err) {
        console.warn("Error stopping camera scanner:", err);
      }
      html5QrCodeRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Start camera dynamically importing html5-qrcode (Performance Rule §10)
  const startCamera = async () => {
    if (cameraStartingRef.current || html5QrCodeRef.current || isProcessingRef.current) return;
    setCameraError(null);
    if (!window.isSecureContext) {
      setCameraError("Camera scanning needs HTTPS. Open the secure site on your phone; an http:// local network address cannot access the camera.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot access the camera. Open this page in Safari or Chrome, or enter the attendee code below.");
      return;
    }
    cameraStartingRef.current = true;
    setIsCameraStarting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(scannerDivId);
      html5QrCodeRef.current = scanner;
      let scanHandled = false;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 10,
        },
        async (decodedText) => {
          if (scanHandled || isProcessingRef.current) return;
          // Claim this camera result without locking out processCheckIn itself.
          scanHandled = true;
          lastMethodRef.current = "camera";
          await stopCamera();
          await processCheckIn(decodedText);
        },
        () => {
          // Ignore individual frame scan misses
        }
      );

      setIsCameraActive(true);
    } catch (err) {
      console.warn("Failed to initialize camera scanner:", err);
      await stopCamera();
      const message = err instanceof Error ? `${err.name} ${err.message}` : String(err);
      setCameraError(
        /NotAllowed|Permission|denied/i.test(message)
          ? "Camera permission was denied. Allow camera access in your browser's site settings, then try again."
          : /NotFound|DevicesNotFound/i.test(message)
          ? "No camera was found. Use a phone with a camera or enter the attendee code below."
          : "Camera could not start. Close other apps using the camera and try again, or enter the attendee code below."
      );
      setIsCameraActive(false);
    } finally {
      cameraStartingRef.current = false;
      setIsCameraStarting(false);
    }
  };

  // Reset scanner
  const resetScan = async (restartCamera?: boolean) => {
    await stopCamera();
    isProcessingRef.current = false;
    setIsProcessing(false);
    setScanState("idle");
    setLastResult(null);
    setErrorMessage("Code is invalid or unregistered");

    if (restartCamera && lastMethodRef.current === "camera") {
      setTimeout(() => {
        startCamera();
      }, 150);
    }
  };

  // USB / Bluetooth handheld scanners (e.g. PST Premier) act as a keyboard: they "type" the
  // QR contents very quickly and usually press Enter. Capture that burst anywhere on the page so
  // staff can scan back-to-back without clicking into the manual entry box first.
  const [usbScanSeenAt, setUsbScanSeenAt] = useState<number | null>(null);
  const latestHandlersRef = useRef({ processCheckIn, resetScan, scanState });
  useEffect(() => {
    latestHandlersRef.current = { processCheckIn, resetScan, scanState };
  });

  useEffect(() => {
    if (isAuthorized !== true) return;
    const MAX_GAP_MS = 60; // scanners send keys a few ms apart; people type far slower
    const MIN_LENGTH = 8;
    let buffer = "";
    let lastKeyAt = 0;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const submit = async () => {
      const code = buffer.trim();
      buffer = "";
      if (code.length < MIN_LENGTH) return;
      const { processCheckIn: check, resetScan: reset, scanState: state } = latestHandlersRef.current;
      setUsbScanSeenAt(Date.now());
      lastMethodRef.current = "manual";
      if (state !== "idle") await reset(false);
      await check(code);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      // Typing into a field (e.g. manual entry) is handled by that field's own form.
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      const now = performance.now();
      if (now - lastKeyAt > MAX_GAP_MS) buffer = "";
      lastKeyAt = now;
      if (idleTimer) clearTimeout(idleTimer);

      if (event.key === "Enter" || event.key === "Tab") {
        if (buffer.length >= MIN_LENGTH) {
          event.preventDefault();
          void submit();
        }
        buffer = "";
        return;
      }
      if (event.key.length !== 1) return;
      buffer += event.key;
      // Scanners configured without an Enter suffix: submit once the burst stops.
      idleTimer = setTimeout(() => {
        if (/^(OAK-2026-\d{4}-[A-Z0-9]{4}|[0-9a-f-]{36}|https?:\/\/\S+)$/i.test(buffer.trim())) void submit();
        else buffer = "";
      }, 150);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, [isAuthorized]);

  if (isAuthorized !== true) {
    return (
      <div className="page-shell flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mb-8 w-full max-w-[608px] flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 
            className="text-[24px] font-bold leading-[32px] tracking-normal text-[#0E1726] mb-1"
            style={{ fontFamily: 'var(--font-sans)' }}
          >
            Event Check-In
          </h1>
          <p className="font-sans text-[14px] font-normal leading-[20px] tracking-normal text-[#6B7590]">
            {scanState === "success"
              ? lastResult?.status === "already_checked_in"
                ? "Attendee already checked in"
                : "Scan verified successfully"
              : scanState === "error"
              ? "Verification failed"
              : "Scan an attendee QR code to check them in"}
          </p>
        </div>

        {/* Offline Queue Indicator (Hard Rule R9) */}
        {pendingQueue.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-amber-50 border border-amber-200 px-4 py-2 text-xs font-semibold text-amber-900">
            <WifiOff className="h-4 w-4 text-amber-600" />
            <span>{pendingQueue.length} pending offline</span>
            <button
              onClick={flushQueue}
              disabled={isSyncing}
              className="ml-2 inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-[11px] text-white hover:bg-amber-700"
            >
              <CloudUpload className="h-3 w-3" />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        )}
      </div>

      {/* Handheld USB scanner status */}
      <div className="mb-3 w-full max-w-[608px] flex items-center gap-2 rounded-2xl border border-[#1C2E5A1A] bg-white px-3 py-2 text-xs text-[#4B5563] shadow-xs">
        <ScanLine className="h-4 w-4 shrink-0 text-[#1C2E5A]" />
        <span>
          <span className="font-bold text-[#0E1726]">USB scanner ready</span>
          {" · "}
          {isProcessing && usbScanSeenAt
            ? "Checking scanned code…"
            : "plug in a handheld scanner and scan a pass; no need to click anything first"}
        </span>
      </div>

      {/* Auto-Detected Event Day Indicator */}
      <div className="mb-6 w-full max-w-[608px] bg-white rounded-2xl border border-[#1C2E5A1A] p-3 shadow-xs flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <span className="text-xs font-bold text-[#0E1726]">
            Active Day: {getEventDayInfo(selectedDay).label}
          </span>
          {selectedDay === autoDetectedDay ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              Auto-Detected
            </span>
          ) : (
            <button
              type="button"
              onClick={resetToAutoDay}
              className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-semibold border border-amber-200 hover:bg-amber-100 cursor-pointer"
              title="Reset to today's auto-detected day"
            >
              Reset to Auto
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {dayOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelectDay(opt.id)}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedDay === opt.id
                  ? "bg-[#1C2E5A] text-white shadow-xs"
                  : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB]"
              }`}
            >
              {opt.label}
              {opt.isToday && selectedDay !== opt.id && (
                <span className="ml-1 text-[9px] text-emerald-600 font-bold">•</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {scanState === "success" && lastResult && (
        <ScanSuccessView lastResult={lastResult} resetScan={() => resetScan(true)} />
      )}

      {scanState === "error" && (
        <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-300 space-y-4">
          <div className="w-full max-w-[608px] bg-gradient-to-br from-[#DC2626] to-[#EF4444] rounded-[24px] flex items-center gap-[16px] shadow-[0_4px_16px_0_#1C2E5A12,0_1px_3px_0_#1C2E5A0D] relative overflow-hidden h-[107px] px-[20px]">
            <div className="absolute top-1/2 -translate-y-1/2 -right-[15%] w-[280px] h-[280px] bg-white/10 rounded-full"></div>
            <div className="w-[56px] h-[56px] bg-white/20 rounded-[16px] flex items-center justify-center shrink-0 z-10 border border-white/20">
              <XCircle className="w-[30px] h-[30px] text-white" />
            </div>
            <div className="z-10 flex flex-col justify-center">
              <p className="text-[10px] font-bold tracking-[1.5px] uppercase text-white/80 mb-0.5 font-sans">
                Check-In Failed
              </p>
              <h2 className="text-[20px] leading-[28px] font-bold text-white mb-0.5 tracking-normal font-sans">
                Scan Unsuccessful
              </h2>
              <p className="text-[13px] leading-[18px] text-[#FFFFFFCC] font-normal font-sans">
                {errorMessage}
              </p>
            </div>
          </div>

          <div className="w-full max-w-[608px] bg-white rounded-[24px] p-[20px] shadow-[0_1px_3px_0_#1C2E5A0D,0_4px_16px_0_#1C2E5A12] border border-[#1C2E5A1A]">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
              <h3 className="font-bold text-[14px] text-[#0E1726] font-sans">Possible reasons</h3>
            </div>
            <ul className="space-y-3">
              {[
                "QR code belongs to a different event",
                "Registration was not completed in the system",
                "Code has been altered or corrupted",
                "Attendee registered under a different identifier",
              ].map((reason, idx) => (
                <li key={idx} className="flex items-center gap-3 text-[13px] text-[#6B7590] font-sans">
                  <div className="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 bg-[#DC2626] rounded-full"></div>
                  </div>
                  {reason}
                </li>
              ))}
            </ul>
          </div>

          <div className="w-full max-w-[608px] space-y-3 pt-2">
            <button
              onClick={() => resetScan(true)}
              className="w-full h-[52px] bg-[#162E55] hover:bg-[#1C2E5A] text-white font-semibold text-[14px] rounded-[16px] flex items-center justify-center gap-2 transition-colors shadow-[0_4px_20px_0_#1C2E5A4D] cursor-pointer font-sans"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
            <button
              onClick={() => {
                resetScan(false);
                setTimeout(() => {
                  manualInputRef.current?.focus();
                  manualInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 120);
              }}
              className="w-full h-[52px] bg-white hover:bg-[#F8FAFC] border border-[#1C2E5A1A] text-[#162E55] font-semibold text-[14px] rounded-[16px] flex items-center justify-center gap-2 transition-colors cursor-pointer font-sans"
            >
              <Phone className="w-4 h-4 text-[#6B7590]" />
              Manual Code Entry
            </button>
          </div>
        </div>
      )}

      {scanState === "idle" && (
        <div className="space-y-4">
          <style>{`
            #oak-qr-reader video {
              object-fit: cover !important;
              width: 100% !important;
              height: 100% !important;
              border-radius: 12px;
            }
          `}</style>
          {/* Camera Viewport */}
          <div 
            className="bg-[#0E1726] rounded-[24px] overflow-hidden flex flex-col shadow-[0_1px_3px_0_#1C2E5A0D,0_4px_16px_0_#1C2E5A12] w-full relative"
            style={{ maxWidth: '608px', aspectRatio: '608 / 673' }}
          >
            {/* Main Dark Area */}
            <div className="relative z-20 w-full flex-1 flex flex-col items-center justify-center shrink-0">
              
              {/* Gradient 1: Tiny center dot/noise */}
              <div 
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  opacity: 0.07,
                  background: 'radial-gradient(70.71% 70.71% at 50% 50%, rgba(168, 187, 206, 0.8) 0.16%, rgba(0, 0, 0, 0) 0.16%)'
                }}
              ></div>

              {/* Gradient 2: Center Glow */}
              <div 
                className="absolute z-0 pointer-events-none rounded-full"
                style={{
                  width: '211.66px',
                  height: '211.66px',
                  opacity: 0.44,
                  background: 'radial-gradient(70.71% 70.71% at 50% 50%, rgba(168, 187, 206, 0.12) 0%, rgba(168, 187, 206, 0) 70%)'
                }}
              ></div>
              
              {/* Scanner Reticle */}
              <div className="relative z-20 w-[240px] h-[240px]">
                <div className="absolute inset-0 z-0 overflow-hidden rounded-[12px]">
                  <div id={scannerDivId} className="w-full h-full" />
                </div>
                <div className="absolute top-0 left-0 w-8 h-8 border-t-[2px] border-l-[2px] border-white/30 rounded-tl-[12px] z-10 pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-[2px] border-r-[2px] border-white/30 rounded-tr-[12px] z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-[2px] border-l-[2px] border-white/30 rounded-bl-[12px] z-10 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-[2px] border-r-[2px] border-white/30 rounded-br-[12px] z-10 pointer-events-none"></div>
              </div>
              
              <p 
                className="absolute bottom-[20px] z-20 font-sans font-normal text-center"
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  letterSpacing: '0.3px',
                  color: 'rgba(168, 187, 206, 0.5)'
                }}
              >
                Position QR code within the frame
              </p>

              {!isCameraActive ? (
                <div className="absolute z-30 flex flex-col items-center">
                  <button
                    type="button"
                    onClick={startCamera}
                    disabled={isCameraStarting || isProcessing}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#1C2E5A] px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-opacity-90 transition cursor-pointer"
                  >
                    <Camera className="h-4 w-4" />
                    {isCameraStarting ? "Starting camera..." : isProcessing ? "Checking attendee..." : "Activate Camera Scanner"}
                  </button>
                  {cameraError && (
                    <p className="text-[11px] text-amber-300 max-w-xs mt-2 text-center bg-black/60 px-3 py-1 rounded-lg">
                      {cameraError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="absolute top-4 right-4 z-30">
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-xl bg-black/60 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/80 transition cursor-pointer"
                  >
                    Stop Camera
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Scan Bar */}
            <div 
              className="flex items-center shrink-0 w-full"
              style={{
                height: '65px',
                padding: '16px',
                gap: '12px',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'transparent'
              }}
            >
              <div 
                className="flex items-center justify-center shrink-0 rounded-full"
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <ScanLine style={{ width: '14px', height: '14px', color: '#FFFFFF' }} />
              </div>
              <p 
                className="font-sans font-normal"
                style={{
                  fontSize: '12px',
                  lineHeight: '16px',
                  letterSpacing: '0px',
                  color: 'rgba(168, 187, 206, 0.45)'
                }}
              >
                Hold camera steady · Auto-scans in 1–2 seconds
              </p>
            </div>
          </div>

          {/* Manual Entry */}
          <div className="bg-white rounded-[24px] p-[20px] shadow-[0_1px_3px_0_#1C2E5A0D,0_4px_16px_0_#1C2E5A12] border border-[#1C2E5A1A]">
            <p className="text-[10px] font-semibold leading-[15px] tracking-[1px] uppercase text-[#6B7590] mb-4 font-sans">
              Manual Code Entry
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (manualCode.trim()) {
                  lastMethodRef.current = "manual";
                  processCheckIn(manualCode.trim());
                }
              }}
              className="flex gap-[12px] h-[52px]"
            >
              <input 
                ref={manualInputRef}
                type="text" 
                placeholder="OAK-2026-XXXX-XXXX"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="min-w-0 w-full flex-1 bg-[#EEF1F5] border border-transparent rounded-[14px] px-[16px] py-[14px] text-[14px] text-[#0E1726] placeholder-[#6B7590] focus:outline-none focus:ring-2 focus:ring-[#1C2E5A] font-medium font-mono uppercase"
              />
              <button 
                type="submit"
                disabled={!manualCode.trim() || isProcessing}
                className="bg-[#1C2E5A] hover:opacity-90 text-white font-semibold px-[20px] py-[14px] rounded-[16px] shadow-[0_4px_20px_0_#1C2E5A4D] transition-colors shrink-0 w-[90px] h-full flex items-center justify-center text-[14px] disabled:opacity-50 cursor-pointer font-sans"
              >
                {isProcessing ? "Checking..." : "Check"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}







