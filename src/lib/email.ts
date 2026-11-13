import nodemailer from "nodemailer";
import { generateIcsContent } from "./ics";

export interface BookingEmailDetails {
  bookingId?: string;
  slotDate: string;
  slotTime: string;
  durationMinutes: number;
  note?: string | null;
  startTimeIso: string;
  endTimeIso: string;
  bookerName: string;
  bookerEmail: string;
  organisation: string;
  message: string;
  advisorName: string;
  advisorTitle?: string;
  advisorEmail: string;
  cancelToken?: string;
}

export interface CancellationEmailDetails {
  slotDate: string;
  slotTime: string;
  bookerName: string;
  bookerEmail: string;
  organisation: string;
  advisorName: string;
  advisorEmail: string;
}

export interface EmailAttachment {
  filename: string;
  content: string; // Base64 encoded string
  contentType?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  from?: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  provider: "resend" | "smtp" | "none";
  messageId?: string;
  error?: string;
  recipient?: string;
}

export function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface EmailConfigStatus {
  provider: "resend" | "smtp" | "none";
  isConfigured: boolean;
  fromEmail: string;
  smtpVerified?: boolean;
  smtpVerifyError?: string;
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

/**
 * Parses and ensures the From address matches SMTP_USER for Gmail SMTP compliance.
 * Gmail rewrites or rejects messages whose From address doesn't match the authenticated mailbox.
 * If EMAIL_FROM does not match SMTP_USER, logs a clear warning and falls back to using
 * SMTP_USER as the address while preserving the display name.
 */
export function resolveSmtpFromAddress(configuredFrom: string, smtpUser: string): string {
  const trimmedUser = smtpUser.trim().toLowerCase();
  const trimmedFrom = (configuredFrom || "").trim();

  if (!trimmedFrom) {
    return smtpUser;
  }

  // Parse display name and email address: e.g. "OAK Clinics <hello@domain.com>" or "hello@domain.com"
  const match = trimmedFrom.match(/^(?:(.*)<([^>]+)>|([^<]+))$/);
  let displayName = "";
  let emailAddress = trimmedFrom;

  if (match) {
    if (match[2]) {
      displayName = (match[1] || "").trim();
      emailAddress = match[2].trim();
    } else if (match[3]) {
      emailAddress = match[3].trim();
    }
  }

  // Remove surrounding quotes from display name if present
  displayName = displayName.replace(/^["']|["']$/g, "").trim();

  if (emailAddress.toLowerCase() !== trimmedUser) {
    console.warn(
      `[SMTP FROM MISMATCH] EMAIL_FROM address (${emailAddress}) does not match SMTP_USER (${smtpUser}). Gmail rewrites or rejects mismatched sender addresses. Falling back to SMTP_USER as the sender address while preserving display name.`
    );
    return displayName ? `"${displayName}" <${smtpUser}>` : smtpUser;
  }

  return trimmedFrom;
}

/**
 * Creates a Nodemailer transporter for SMTP with Google Workspace (Gmail SMTP) compliance:
 * - Port 465: Direct SSL/TLS (secure: true)
 * - Port 587: STARTTLS (secure: false, requireTLS: true)
 * - 10-second connection, greeting, and socket timeouts so invalid configs fail fast instead of hanging.
 */
export function createSmtpTransporter() {
  const host = (process.env.SMTP_HOST || "smtp.gmail.com").trim();
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = (process.env.SMTP_USER || "").trim();
  const rawPass = (process.env.SMTP_PASS || "").trim();
  // Google displays App Passwords as "abcd efgh ijkl mnop"; Gmail only accepts them without spaces.
  const pass = host.endsWith("gmail.com") ? rawPass.replace(/\s+/g, "") : rawPass;

  const isPort465 = port === 465;
  const isPort587 = port === 587;
  const secure = process.env.SMTP_SECURE === "true" || isPort465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: isPort587 || !secure,
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

/**
 * Translates common SMTP errors into plain-language explanations.
 */
export function formatSmtpError(err: any): string {
  const message = err?.message || String(err);
  const code = err?.responseCode || err?.code;
  const response = err?.response || "";

  if (
    code === 535 ||
    response.includes("535") ||
    message.includes("535") ||
    message.toLowerCase().includes("badcredentials") ||
    message.toLowerCase().includes("username and password not accepted") ||
    message.toLowerCase().includes("invalid login")
  ) {
    return `SMTP Authentication Failed (Code 535): Username and password not accepted by Gmail. Common causes: (1) The Google App Password is incorrect or revoked (standard Google account passwords cannot be used with 2-Step Verification), (2) The account is an alias, Google Group, or shared mailbox (Gmail SMTP requires an individual Google Workspace mailbox to authenticate), or (3) Less secure apps / App Passwords are restricted by your Google Workspace administrator. [Raw: ${message}]`;
  }

  if (
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT" ||
    message.toLowerCase().includes("timeout") ||
    message.toLowerCase().includes("greeting")
  ) {
    return `SMTP Connection Timeout: Connection to ${process.env.SMTP_HOST || "smtp.gmail.com"}:${process.env.SMTP_PORT || "465"} timed out after 10s. Check if your hosting provider (e.g. Vercel) or local network blocks outbound SMTP connections on port ${process.env.SMTP_PORT || "465"}. [Raw: ${message}]`;
  }

  if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
    return `SMTP Connection Refused: The SMTP server at ${process.env.SMTP_HOST || "host"}:${process.env.SMTP_PORT || "port"} refused the connection. Verify that the SMTP_HOST and SMTP_PORT are correct. [Raw: ${message}]`;
  }

  if (code === "ENOTFOUND" || message.includes("ENOTFOUND")) {
    return `SMTP Host Not Found: Could not resolve hostname "${process.env.SMTP_HOST}". Verify that SMTP_HOST is spelled correctly. [Raw: ${message}]`;
  }

  if (code === "EAUTH" || message.includes("EAUTH")) {
    return `SMTP Authentication Error: Credentials rejected by mail server. [Raw: ${message}]`;
  }

  return `SMTP Error: ${message}`;
}

/**
 * Verifies connection and authentication against the SMTP server.
 * Always awaited, sets 10s timeouts, and translates errors.
 */
export async function verifySmtpConnection(): Promise<{
  success: boolean;
  message: string;
  error?: string;
  rawError?: string;
}> {
  const config = getEmailConfigStatus();
  if (config.provider !== "smtp") {
    return {
      success: false,
      message: `Active email provider is "${config.provider}", not SMTP. Set EMAIL_PROVIDER=smtp to test SMTP.`,
    };
  }

  if (!config.isConfigured) {
    const err = `SMTP not configured. Missing required variable(s): ${config.missingVars.join(", ")}`;
    return {
      success: false,
      message: err,
      error: err,
    };
  }

  try {
    const transporter = createSmtpTransporter();
    await transporter.verify();
    return {
      success: true,
      message: `SMTP connection and authentication verified successfully with ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} as ${process.env.SMTP_USER}.`,
    };
  } catch (err: any) {
    const translated = formatSmtpError(err);
    console.error("[SMTP VERIFY FAILED]", translated);
    return {
      success: false,
      message: translated,
      error: translated,
      rawError: err.message || String(err),
    };
  }
}

/**
 * Returns safe environment variable check for email configurations (booleans only, never secrets).
 */
export function getEmailConfigStatus(): EmailConfigStatus {
  const emailProvider = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  const resendApiKey = Boolean(process.env.RESEND_API_KEY?.trim());
  const emailFrom = Boolean(process.env.EMAIL_FROM?.trim());
  const smtpHost = Boolean(process.env.SMTP_HOST?.trim());
  const smtpPort = Boolean(process.env.SMTP_PORT?.trim());
  const smtpUser = Boolean(process.env.SMTP_USER?.trim());
  const smtpPass = Boolean(process.env.SMTP_PASS?.trim());
  const smtpSecure = Boolean(process.env.SMTP_SECURE?.trim());

  let selectedProvider: "resend" | "smtp" | "none" = "none";
  const missingVars: string[] = [];

  // Determine provider: explicitly 'resend', explicitly 'smtp', or inferred
  if (emailProvider === "resend") {
    selectedProvider = "resend";
    if (!resendApiKey) missingVars.push("RESEND_API_KEY");
    if (!emailFrom) missingVars.push("EMAIL_FROM");
  } else if (emailProvider === "smtp" || smtpHost || smtpUser) {
    selectedProvider = "smtp";
    if (!smtpHost) missingVars.push("SMTP_HOST");
    if (!smtpPort) missingVars.push("SMTP_PORT");
    if (!smtpUser) missingVars.push("SMTP_USER");
    if (!smtpPass) missingVars.push("SMTP_PASS");
    if (!emailFrom) missingVars.push("EMAIL_FROM");
  } else if (resendApiKey) {
    selectedProvider = "resend";
    if (!emailFrom) missingVars.push("EMAIL_FROM");
  } else {
    selectedProvider = "none";
    missingVars.push("SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM (or RESEND_API_KEY)");
  }

  const isConfigured = missingVars.length === 0 && selectedProvider !== "none";

  let resolvedFrom = "";
  if (selectedProvider === "smtp") {
    const rawFrom = process.env.EMAIL_FROM?.trim() || process.env.SMTP_USER?.trim() || "";
    resolvedFrom = process.env.SMTP_USER ? resolveSmtpFromAddress(rawFrom, process.env.SMTP_USER) : rawFrom;
  } else if (selectedProvider === "resend") {
    resolvedFrom = process.env.EMAIL_FROM?.trim() || "Oak Clinics <onboarding@resend.dev>";
  } else {
    resolvedFrom = process.env.EMAIL_FROM?.trim() || "";
  }

  return {
    provider: selectedProvider,
    isConfigured,
    fromEmail: resolvedFrom,
    vars: {
      RESEND_API_KEY: resendApiKey,
      EMAIL_FROM: emailFrom,
      EMAIL_PROVIDER: Boolean(emailProvider),
      SMTP_HOST: smtpHost,
      SMTP_PORT: smtpPort,
      SMTP_USER: smtpUser,
      SMTP_PASS: smtpPass,
      SMTP_SECURE: smtpSecure,
    },
    missingVars,
  };
}

/**
 * Core sendEmail helper supporting Nodemailer (SMTP) and Resend (HTTP).
 * Validates required variables, sets timeouts, always awaited.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const config = getEmailConfigStatus();
  const recipientStr = Array.isArray(options.to) ? options.to.join(", ") : options.to;

  if (!config.isConfigured) {
    const errMsg = `Email sending is not configured. Missing required environment variable(s): ${config.missingVars.join(", ")}`;
    console.error(`[EMAIL ERROR] Cannot send email to ${recipientStr}: ${errMsg}`);
    return {
      success: false,
      provider: config.provider,
      error: errMsg,
      recipient: recipientStr,
    };
  }

  // 1. SMTP Provider (Nodemailer - Google Workspace / Gmail SMTP)
  if (config.provider === "smtp") {
    try {
      const from = resolveSmtpFromAddress(options.from || config.fromEmail, process.env.SMTP_USER!);
      console.log(`[EMAIL DISPATCH SMTP] To: ${recipientStr} | Subject: "${options.subject}" | From: ${from}`);

      const transporter = createSmtpTransporter();

      const mailOptions: any = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      if (options.replyTo) {
        mailOptions.replyTo = options.replyTo;
      }

      if (options.attachments && options.attachments.length > 0) {
        mailOptions.attachments = options.attachments.map((att) => ({
          filename: att.filename,
          content: Buffer.from(att.content, "base64"),
          contentType: att.contentType || "application/octet-stream",
        }));
      }

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EMAIL SMTP SUCCESS] To: ${recipientStr} | Message ID: ${info.messageId}`);
      return {
        success: true,
        provider: "smtp",
        messageId: info.messageId,
        recipient: recipientStr,
      };
    } catch (err: any) {
      const translated = formatSmtpError(err);
      console.error(`[EMAIL SMTP FAILED] To: ${recipientStr} | Error:`, translated);
      return {
        success: false,
        provider: "smtp",
        error: translated,
        recipient: recipientStr,
      };
    }
  }

  // 2. Resend Provider (Fallback when EMAIL_PROVIDER=resend)
  if (config.provider === "resend") {
    const apiKey = process.env.RESEND_API_KEY!.trim();
    const from = options.from || config.fromEmail;
    console.log(`[EMAIL DISPATCH RESEND] To: ${recipientStr} | Subject: "${options.subject}" | From: ${from}`);

    try {
      const payload: any = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      if (options.replyTo) {
        payload.reply_to = options.replyTo;
      }

      if (options.attachments && options.attachments.length > 0) {
        payload.attachments = options.attachments.map((att) => ({
          filename: att.filename,
          content: att.content,
        }));
      }

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json().catch(() => null);

      if (!response.ok) {
        const errorDetail = responseData?.message || responseData?.error || response.statusText || `HTTP ${response.status}`;
        console.error(`[EMAIL RESEND FAILED] To: ${recipientStr} | Status: ${response.status} | Error:`, errorDetail);
        return {
          success: false,
          provider: "resend",
          error: `Resend error (${response.status}): ${errorDetail}`,
          recipient: recipientStr,
        };
      }

      const messageId = responseData?.id || "resend-ok";
      console.log(`[EMAIL RESEND SUCCESS] To: ${recipientStr} | Message ID: ${messageId}`);
      return {
        success: true,
        provider: "resend",
        messageId,
        recipient: recipientStr,
      };
    } catch (err: any) {
      console.error(`[EMAIL RESEND NETWORK ERROR] To: ${recipientStr} | Error:`, err);
      return {
        success: false,
        provider: "resend",
        error: `Network error connecting to Resend: ${err.message || String(err)}`,
        recipient: recipientStr,
      };
    }
  }

  return {
    success: false,
    provider: "none",
    error: "No supported email provider configured.",
    recipient: recipientStr,
  };
}

/**
 * Distinguishes temporary retryable errors (timeouts, network drops, 4xx)
 * from permanent non-retryable failures (535 authentication, bad credentials, missing config).
 */
export function isTemporaryFailure(result: SendEmailResult): boolean {
  if (result.success) return false;
  const err = (result.error || "").toLowerCase();

  // Authentication errors are permanent - never retry
  if (
    err.includes("535") ||
    err.includes("authentication failed") ||
    err.includes("not accepted") ||
    err.includes("eauth") ||
    err.includes("badcredentials") ||
    err.includes("missing required environment variable") ||
    err.includes("invalid login") ||
    err.includes("401")
  ) {
    return false;
  }

  // Resend 403 domain not verified is permanent
  if (err.includes("403") && (err.includes("not verified") || err.includes("testing emails"))) {
    return false;
  }

  // Temporary / network failures: timeouts, connection drops, 4xx
  if (
    err.includes("timeout") ||
    err.includes("etimedout") ||
    err.includes("esockettimedout") ||
    err.includes("econnreset") ||
    err.includes("econnrefused") ||
    err.includes("network error") ||
    err.includes("421") ||
    err.includes("450") ||
    err.includes("451") ||
    err.includes("452") ||
    err.includes("rate limit")
  ) {
    return true;
  }

  return false;
}

/**
 * Sends an email with retry logic (up to maxRetries attempts with exponential/linear backoff).
 * Retries on temporary failures only; never retries authentication failures.
 */
export async function sendEmailWithRetry(
  options: SendEmailOptions,
  maxRetries = 2,
  delayMs = 1000
): Promise<SendEmailResult> {
  let attempt = 0;
  let lastResult: SendEmailResult | null = null;

  while (attempt <= maxRetries) {
    attempt++;
    lastResult = await sendEmail(options);
    if (lastResult.success) {
      return lastResult;
    }

    // Only retry on temporary failures (never on 535 auth failures)
    if (attempt <= maxRetries && isTemporaryFailure(lastResult)) {
      const waitTime = delayMs * attempt;
      console.warn(`[EMAIL RETRY] Temporary failure on attempt ${attempt}. Retrying in ${waitTime}ms for ${options.to}... Error: ${lastResult.error}`);
      await new Promise((res) => setTimeout(res, waitTime));
    } else {
      break;
    }
  }

  return lastResult || {
    success: false,
    provider: "none",
    error: "Maximum retries reached.",
  };
}

/**
 * Sends both booking confirmation emails (To Advisor and To Booker) with calendar invites.
 * Always awaited, catches errors safely, and returns detailed status.
 */
export async function sendBookingEmails(details: BookingEmailDetails): Promise<{
  success: boolean;
  status: "sent" | "failed";
  advisorResult: SendEmailResult;
  bookerResult: SendEmailResult;
  error?: string;
}> {
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://oak.uncommon.org";
  const sharedDriveUrl = process.env.SHARED_DRIVE_URL || "https://drive.google.com";
  const uploadFormUrl = process.env.NEXT_PUBLIC_DRIVE_UPLOAD_FORM_URL || "https://drive.google.com";
  const sharedFilesUrl = `${appBaseUrl}/drive`;

  // 1. Generate ICS Attachment
  const icsContent = generateIcsContent({
    title: `1:1 Session: ${details.advisorName} & ${details.bookerName} (${details.organisation})`,
    description: `Discussion Topic / Question:\n${details.message}\n\nAttendee: ${details.bookerName} (${details.organisation})\nEmail: ${details.bookerEmail}`,
    startTime: new Date(details.startTimeIso),
    endTime: new Date(details.endTimeIso),
    organizerName: details.advisorName,
    organizerEmail: details.advisorEmail,
    attendeeName: details.bookerName,
    attendeeEmail: details.bookerEmail,
  });
  const icsBase64 = Buffer.from(icsContent).toString("base64");
  const cancelUrl = `${appBaseUrl}/book/cancel?token=${encodeURIComponent(details.cancelToken || "")}`;

  // 2. Email Content for Advisor
  const advisorSubject = `New booking: ${details.bookerName}, ${details.organisation} on ${details.slotDate} at ${details.slotTime}`;
  const advisorText = `NEW 1:1 SESSION BOOKED

You have a new meeting booked for your advisor clinic:

Date: ${details.slotDate}
Time: ${details.slotTime} (SAST / CAT)
Length: ${details.durationMinutes} minutes
${details.note ? `Note: ${details.note}\n` : ""}Booker: ${details.bookerName}
Email: ${details.bookerEmail}
Organisation: ${details.organisation}

Topic / Discussion Request:
${details.message}

Want to share slides or notes before your session? Upload them here: ${uploadFormUrl}. Once approved, they will appear on the Shared Files page: ${sharedFilesUrl}.

Reply to Booker: ${details.bookerEmail}

A calendar invite (.ics) has been attached to this email.`;

  const advisorHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; color: #1e293b; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 22px;">New 1:1 Session Booked</h2>
      <p style="font-size: 15px; color: #475569;">You have a new meeting booked for your advisor clinic:</p>

      <div style="background: #f8fafc; border-radius: 12px; padding: 18px; margin: 20px 0; border: 1px solid #e2e8f0; font-size: 14px;">
        <p style="margin: 6px 0;"><strong>Date:</strong> ${escapeHtml(details.slotDate)}</p>
        <p style="margin: 6px 0;"><strong>Time:</strong> ${escapeHtml(details.slotTime)} (SAST / CAT)</p>
        <p style="margin: 6px 0;"><strong>Length:</strong> ${details.durationMinutes} minutes</p>
        ${details.note ? `<p style="margin: 6px 0; color: #0284c7;"><strong>Note:</strong> ${escapeHtml(details.note)}</p>` : ""}
        <p style="margin: 6px 0;"><strong>Booker:</strong> ${escapeHtml(details.bookerName)}</p>
        <p style="margin: 6px 0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(details.bookerEmail)}" style="color: #2563eb;">${escapeHtml(details.bookerEmail)}</a></p>
        <p style="margin: 6px 0;"><strong>Organisation:</strong> ${escapeHtml(details.organisation)}</p>
      </div>

      <h4 style="color: #334155; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Topic / Discussion Request:</h4>
      <div style="background: #ffffff; border-left: 4px solid #10b981; padding: 14px; margin-bottom: 24px; color: #334155; font-size: 14px; line-height: 1.6; border-radius: 0 8px 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        ${escapeHtml(details.message)}
      </div>

      <div style="background: #f1f5f9; border-radius: 8px; padding: 12px; margin: 20px 0; font-size: 13px; color: #334155; line-height: 1.5;">
        Want to share slides or notes before your session? Upload them here: <a href="${escapeHtml(uploadFormUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(uploadFormUrl)}</a>. Once approved, they will appear on the Shared Files page: <a href="${escapeHtml(sharedFilesUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(sharedFilesUrl)}</a>.
      </div>

      <p style="margin-top: 24px;">
        <a href="mailto:${escapeHtml(details.bookerEmail)}?subject=Re: ${encodeURIComponent(advisorSubject)}" style="display: inline-block; background: #1C2C4F; color: #ffffff; padding: 10px 20px; border-radius: 10px; font-weight: 600; text-decoration: none; font-size: 13px;">
          Reply to ${escapeHtml(details.bookerName)}
        </a>
      </p>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        A calendar invite (.ics) has been attached to this email.
      </p>
    </div>
  `;

  // 3. Email Content for Booker
  const bookerSubject = `Your session with ${details.advisorName} is confirmed`;
  const bookerText = `SESSION CONFIRMED

Hi ${details.bookerName},

Your 1:1 session with ${details.advisorName} (${details.advisorTitle || "OAK Advisor"}) is confirmed.

Advisor: ${details.advisorName}
Date: ${details.slotDate}
Time: ${details.slotTime} (SAST / CAT)
Length: ${details.durationMinutes} minutes
${details.note ? `Note: ${details.note}\n` : ""}Organisation: ${details.organisation}

Your Requested Topic:
${details.message}

Ongoing Conversation:
The clinic is intended as the start of an ongoing conversation. While it may not be possible to address every question during the session itself, ${details.advisorName} will be available for follow-up discussions to ensure your needs are fully supported.

Want to share slides or notes before your session? Upload them here: ${uploadFormUrl}. Once approved, they will appear on the Shared Files page: ${sharedFilesUrl}.

Need to cancel? Use this link:
${cancelUrl}

A calendar invite (.ics) is attached to this email.`;

  const bookerHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; color: #1e293b; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
      <h2 style="color: #0f172a; margin-top: 0; font-size: 22px;">Session Confirmed</h2>
      <p style="font-size: 15px; color: #475569;">Hi ${escapeHtml(details.bookerName)},</p>
      <p style="font-size: 15px; color: #475569;">Your 1:1 session with <strong>${escapeHtml(details.advisorName)}</strong> (${escapeHtml(details.advisorTitle || "OAK Advisor")}) is confirmed.</p>

      <div style="background: #f8fafc; border-radius: 12px; padding: 18px; margin: 20px 0; border: 1px solid #e2e8f0; font-size: 14px;">
        <p style="margin: 6px 0;"><strong>Advisor:</strong> ${escapeHtml(details.advisorName)}</p>
        <p style="margin: 6px 0;"><strong>Date:</strong> ${escapeHtml(details.slotDate)}</p>
        <p style="margin: 6px 0;"><strong>Time:</strong> ${escapeHtml(details.slotTime)} (SAST / CAT)</p>
        <p style="margin: 6px 0;"><strong>Length:</strong> ${details.durationMinutes} minutes</p>
        ${details.note ? `<p style="margin: 6px 0; color: #0284c7;"><strong>Note:</strong> ${escapeHtml(details.note)}</p>` : ""}
        <p style="margin: 6px 0;"><strong>Organisation:</strong> ${escapeHtml(details.organisation)}</p>
      </div>

      <h4 style="color: #334155; margin-bottom: 8px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Your Requested Topic:</h4>
      <div style="background: #ffffff; border-left: 4px solid #3b82f6; padding: 14px; margin-bottom: 20px; color: #334155; font-size: 14px; line-height: 1.6; border-radius: 0 8px 8px 0; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        ${escapeHtml(details.message)}
      </div>

      <div style="background: #eff6ff; border-radius: 10px; padding: 14px; margin: 20px 0; border: 1px solid #bfdbfe; font-size: 13px; color: #1e40af; line-height: 1.5;">
        <strong>Ongoing Conversation:</strong> The clinic is intended as the start of an ongoing conversation. While it may not be possible to address every question during the session itself, ${escapeHtml(details.advisorName)} will be available for follow-up discussions to ensure your needs are fully supported.
      </div>

      <div style="background: #f8fafc; border-radius: 10px; padding: 14px; margin: 20px 0; border: 1px solid #e2e8f0; font-size: 13px; color: #334155; line-height: 1.5;">
        Want to share slides or notes before your session? Upload them here: <a href="${escapeHtml(uploadFormUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(uploadFormUrl)}</a>. Once approved, they will appear on the Shared Files page: <a href="${escapeHtml(sharedFilesUrl)}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(sharedFilesUrl)}</a>.
      </div>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
        <span>Need to cancel? </span>
        <a href="${escapeHtml(cancelUrl)}" style="color: #ef4444; font-weight: 600; text-decoration: underline;">
          Cancel this booking
        </a>
      </div>
    </div>
  `;

  const attachments: EmailAttachment[] = [
    {
      filename: "session-invite.ics",
      content: icsBase64,
      contentType: "text/calendar; method=REQUEST; charset=UTF-8",
    },
  ];

  // 4. Send both emails with retries
  const [advisorResult, bookerResult] = await Promise.all([
    sendEmailWithRetry({
      to: details.advisorEmail,
      subject: advisorSubject,
      html: advisorHtml,
      text: advisorText,
      replyTo: details.bookerEmail,
      attachments,
    }),
    sendEmailWithRetry({
      to: details.bookerEmail,
      subject: bookerSubject,
      html: bookerHtml,
      text: bookerText,
      replyTo: details.advisorEmail,
      attachments,
    }),
  ]);

  const bothSucceeded = advisorResult.success && bookerResult.success;
  const status: "sent" | "failed" = bothSucceeded ? "sent" : "failed";

  const errorMessages: string[] = [];
  if (!advisorResult.success) {
    errorMessages.push(`Advisor (${details.advisorEmail}): ${advisorResult.error}`);
  }
  if (!bookerResult.success) {
    errorMessages.push(`Booker (${details.bookerEmail}): ${bookerResult.error}`);
  }

  const combinedError = errorMessages.length > 0 ? errorMessages.join("; ") : undefined;

  return {
    success: bothSucceeded,
    status,
    advisorResult,
    bookerResult,
    error: combinedError,
  };
}

/**
 * Sends session cancellation emails.
 */
export async function sendCancellationEmails(details: CancellationEmailDetails): Promise<{
  success: boolean;
  advisorResult: SendEmailResult;
  bookerResult: SendEmailResult;
}> {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; color: #1e293b; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0;">
      <h2 style="color: #ef4444; margin-top: 0; font-size: 20px;">1:1 Session Cancelled</h2>
      <p style="font-size: 14px; color: #475569;">The following session has been cancelled and the slot has been returned to the available schedule:</p>

      <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin: 20px 0; border: 1px solid #fecaca; font-size: 14px;">
        <p style="margin: 6px 0;"><strong>Advisor:</strong> ${escapeHtml(details.advisorName)}</p>
        <p style="margin: 6px 0;"><strong>Attendee:</strong> ${escapeHtml(details.bookerName)} (${escapeHtml(details.organisation)})</p>
        <p style="margin: 6px 0;"><strong>Email:</strong> ${escapeHtml(details.bookerEmail)}</p>
        <p style="margin: 6px 0;"><strong>Date & Time:</strong> ${escapeHtml(details.slotDate)} at ${escapeHtml(details.slotTime)} (SAST / CAT)</p>
      </div>
    </div>
  `;

  const text = `1:1 SESSION CANCELLED

The following session has been cancelled:

Advisor: ${details.advisorName}
Attendee: ${details.bookerName} (${details.organisation})
Email: ${details.bookerEmail}
Date & Time: ${details.slotDate} at ${details.slotTime} (SAST / CAT)
`;

  const [advisorResult, bookerResult] = await Promise.all([
    sendEmailWithRetry({
      to: details.advisorEmail,
      subject: `Session Cancelled: ${details.bookerName} on ${details.slotDate}`,
      html,
      text,
      replyTo: details.bookerEmail,
    }),
    sendEmailWithRetry({
      to: details.bookerEmail,
      subject: `Session Cancelled: Your session with ${details.advisorName}`,
      html,
      text,
      replyTo: details.advisorEmail,
    }),
  ]);

  return {
    success: advisorResult.success && bookerResult.success,
    advisorResult,
    bookerResult,
  };
}

/**
 * Safely updates booking email status and error in the database.
 * If email_error column is not yet migrated, gracefully falls back to updating email_status only.
 */
export async function updateBookingEmailRecord(
  adminClient: any,
  bookingId: string,
  status: "sent" | "failed" | "pending",
  errorText?: string | null
): Promise<void> {
  try {
    const updatePayload: any = { email_status: status };
    if (errorText !== undefined) {
      updatePayload.email_error = errorText;
    }

    const { error } = await adminClient
      .from("bookings")
      .update(updatePayload)
      .eq("id", bookingId);

    if (error) {
      // Fallback if email_error column does not exist in the database
      if (error.message?.includes("column") && error.message?.includes("email_error")) {
        await adminClient
          .from("bookings")
          .update({ email_status: status })
          .eq("id", bookingId);
      } else {
        console.error("Failed to update booking email status:", error);
      }
    }
  } catch (err) {
    console.error("Error in updateBookingEmailRecord:", err);
  }
}
