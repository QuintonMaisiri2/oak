import { NextResponse } from "next/server";
import { getEmailConfigStatus, sendEmailWithRetry, verifySmtpConnection, escapeHtml } from "@/lib/email";
import { requireSuperAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

// GET: returns current email provider configuration status and runs SMTP verify (Super Admin only)
export async function GET(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.response) {
    return auth.response;
  }

  const config = getEmailConfigStatus();
  let smtpVerification: any = null;

  if (config.provider === "smtp" && config.isConfigured) {
    smtpVerification = await verifySmtpConnection();
  }

  return NextResponse.json({
    ...config,
    smtpVerification,
  });
}

// POST: sends test email (Super Admin only)
export async function POST(request: Request) {
  try {
    const auth = await requireSuperAdmin();
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const { to, subject = "Test Email from Oak Convening", message = "This is a test email sent from the Oak Clinics admin test suite." } = body;

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return NextResponse.json({ error: "Please provide a valid recipient email address ('to')" }, { status: 400 });
    }

    const config = getEmailConfigStatus();
    if (!config.isConfigured) {
      return NextResponse.json({
        success: false,
        provider: config.provider,
        error: `Email sending is not configured. Missing environment variable(s): ${config.missingVars.join(", ")}`,
        config,
      }, { status: 400 });
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0;">
        <h2 style="color: #0f172a; margin-top: 0;">Oak Clinics Email Test</h2>
        <p style="font-size: 14px; color: #475569;">
          This is an automated test email confirming that your email provider is correctly configured and operational.
        </p>
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px; margin: 16px 0; border: 1px solid #e2e8f0; font-size: 13px;">
          <p style="margin: 4px 0;"><strong>Active Provider:</strong> ${escapeHtml(config.provider.toUpperCase())}</p>
          <p style="margin: 4px 0;"><strong>Sender Address:</strong> ${escapeHtml(config.fromEmail)}</p>
          <p style="margin: 4px 0;"><strong>Recipient:</strong> ${escapeHtml(to)}</p>
          <p style="margin: 4px 0;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        </div>
        <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px; font-size: 13px; color: #1e40af; border-radius: 0 8px 8px 0;">
          <strong>Message:</strong><br />
          ${escapeHtml(message)}
        </div>
      </div>
    `;

    const text = `OAK CLINICS EMAIL TEST

This is an automated test email confirming that your email provider is operational.

Provider: ${config.provider.toUpperCase()}
Sender: ${config.fromEmail}
Recipient: ${to}
Timestamp: ${new Date().toISOString()}

Message:
${message}
`;

    const sendResult = await sendEmailWithRetry({
      to,
      subject,
      html,
      text,
    });

    return NextResponse.json({
      success: sendResult.success,
      provider: sendResult.provider,
      messageId: sendResult.messageId || null,
      error: sendResult.error || null,
      recipient: to,
      config,
    });
  } catch (err: any) {
    console.error("Error in email test route:", err);
    return NextResponse.json({ error: err.message || "Failed to process test email" }, { status: 500 });
  }
}
