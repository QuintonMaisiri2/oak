# Oak Foundation 1:1 Advisor Clinics & Booking Platform

A modern meeting reservation platform built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase (Postgres). It allows convening attendees to reserve 1:1 sessions with OAK advisors (e.g. Silvia Guizzardi, Senior Adviser for Impact), with full multi-advisor support so new clinics can be activated without code changes.

---

## Features

- **Multi-Advisor Support ("Clinics")**:
  - Seeded with **Silvia Guizzardi** (Senior Adviser for Impact, `silvia.guizzardi@oakfnd.ch`).
  - **Dynamic View Engine**: When only one advisor is active, the system skips the advisor selection step and renders their profile and slots directly. When a second advisor is activated, the card view appears automatically with bio expanders and "Book a session" buttons.
  - Dedicated advisor routes: `/book/[slug]` (e.g. `/book/silvia-guizzardi`).
- **Atomic Double-Booking Prevention**:
  - Enforces a partial `UNIQUE` index on `bookings(slot_id) WHERE status = 'confirmed'`.
  - Simultaneous requests for the same slot safely fail with a friendly message (*"Sorry, that slot was just taken. Please choose another."*), while permitting rebooking if a previous reservation is cancelled.
- **Two Automated Emails per Booking**:
  - **To the Advisor (`advisor.email`)**: Full booker contact details, organisation, discussion request, a `"Reply to [Booker]"` mailto button with `Reply-To` header set to the attendee's email, and an attached `.ics` iCalendar invite.
  - **To the Booker**: Confirmation summary, advisor name & title, link to the shared Drive for uploading slides/notes, an attached `.ics` file, and a secure one-click **"Cancel booking"** link.
- **Multi-Provider Email Dispatch & Automatic Retries**:
  - Supports **Resend** (HTTP API) and **Nodemailer** (SMTP).
  - Automatic retries (up to 2 retries with backoff delay).
  - Live diagnostics dashboard at `/admin/email-test`.
- **Cancellation & Rescheduling**:
  - Bookers can cancel their session directly via their secure signed `cancel_token` at `/book/cancel?token=...`.
  - Immediately frees the slot in the database and dispatches cancellation emails to both the attendee and the advisor.
- **Admin Management Portal (`/admin/bookings`)**:
  - Protected with `ADMIN_PASSWORD` (or authenticated staff session).
  - **Advisors Tab**: Create new advisors, edit bio and title, toggle active/inactive status, and bulk-add session slots.
  - **Bookings Tab**: Filter reservations by advisor, view real-time `email_status` (`sent` / `failed` / `pending`) and error diagnostic messages, resend emails with one click, export to CSV with advisor names, and cancel reservations.

---

## Email Setup & Troubleshooting

### Option 1: Google Workspace / Gmail SMTP (Recommended)

To send emails reliably without needing third-party DNS domain verification, configure Google Workspace SMTP using an individual mailbox:

1. **Choose a real individual Google Workspace mailbox**:
   - Use an active mailbox account (e.g. `bookings@uncommon.org` or your team account).
   - > [!IMPORTANT]
     > Aliases, Google Groups, and shared mailboxes **cannot** authenticate with Google SMTP. You must authenticate using an individual account.
2. **Turn on 2-Step Verification**:
   - Log into the account at [myaccount.google.com/security](https://myaccount.google.com/security).
   - Ensure **2-Step Verification** is enabled.
3. **Generate an App Password**:
   - Visit [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
   - Enter an app name (e.g. `OAK Convening Platform`) and click **Create**.
   - Copy the generated 16-character password (e.g. `abcd efgh ijkl mnop`).
   - *Note*: If the App Passwords page is missing, your Google Workspace administrator must enable user access to App Passwords in the Google Workspace Admin Console under **Security > Authentication > 2-Step Verification > Allow users to turn on 2-step verification and generate app passwords**.
4. **Configure Environment Variables**:
   Add to `.env` (locally) and in your **Vercel Project Settings > Environment Variables** (for production):
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=bookings@uncommon.org
   SMTP_PASS=your-16-character-app-password
   EMAIL_FROM="OAK Clinics <bookings@uncommon.org>"
   SMTP_SECURE=true
   ```
   > [!NOTE]
   > The email address in `EMAIL_FROM` must match `SMTP_USER`. Gmail rewrites or rejects mismatched sender addresses. If a mismatch is detected, the platform automatically logs a warning and falls back to `SMTP_USER` as the email address while keeping your display name.
5. **Redeploy**:
   After setting the environment variables in Vercel, trigger a **Redeploy** so the serverless workers receive the new credentials.

---

### Option 2: Resend (Alternative)
If you have access to DNS management and can verify your domain at [resend.com/domains](https://resend.com/domains):
```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
EMAIL_FROM="OAK Clinics <bookings@yourverifieddomain.com>"
```
*(Sandbox `onboarding@resend.dev` only delivers to the Resend account owner's email address).*

---

### Troubleshooting Common SMTP Errors

| Error Code / Message | Probable Cause | Exact Solution |
|---|---|---|
| **535 "Username and Password not accepted"** | (1) Incorrect App Password, (2) using standard account password instead of App Password, (3) using an alias or Google Group, or (4) App Passwords disabled by Workspace admin. | Generate a fresh 16-character App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords). Verify the user account is a primary mailbox, not an alias. |
| **Timeout (10s) / ESOCKETTIMEDOUT** | Network or hosting provider blocks port 465 or port 587. | Verify port is 465 (or try 587 with `SMTP_SECURE=false`). Check if firewall or ISP blocks outbound SMTP. |
| **ECONNREFUSED** | Hostname or port mistyped. | Ensure `SMTP_HOST=smtp.gmail.com` and `SMTP_PORT=465`. |
| **From Mismatch Warning** | `EMAIL_FROM` domain/address does not match `SMTP_USER`. | Set `EMAIL_FROM="OAK Clinics <your-smtp-user@yourdomain.com>"`. |

---

### Live Diagnostics & Testing (`/admin/email-test`)
1. Visit `/admin/email-test` in your browser (protected by `requireAdmin()` and `ADMIN_PASSWORD`).
2. The page inspects active environment variables, tests SMTP connection and authentication via `transporter.verify()`, and shows detailed plain-language diagnostic messages.
3. Use the form to send a live test email to any recipient.

---

## Database Migrations

Run the SQL migrations in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql):
1. **Initial Schema & 8 Slots**: [`supabase/migrations/20261102_meeting_slots_and_bookings.sql`](supabase/migrations/20261102_meeting_slots_and_bookings.sql)
2. **Multi-Advisor Clinics Upgrade**: [`supabase/migrations/20261102_advisors_and_clinics.sql`](supabase/migrations/20261102_advisors_and_clinics.sql)
3. **Email Error Diagnostics Column**: [`supabase/migrations/20261102_booking_email_error.sql`](supabase/migrations/20261102_booking_email_error.sql)
4. **Google Sheets Sync Tracking Columns**: [`supabase/migrations/20261104_booking_sheet_sync.sql`](supabase/migrations/20261104_booking_sheet_sync.sql)

---

## Google Sheets Webhook Sync Setup (Apps Script Web App)

Every booking, cancellation (by booker or admin), and email status update is automatically synced server-side to a Google Sheet via an Apps Script Web App webhook. The platform PostgreSQL database remains the single source of truth; the Google Sheet is a live mirror.

### 1. Prepare the Google Sheet & Apps Script
The sheet mirrors the "Booking time with Oak staff" layout: **one tab per adviser** (the tab name must contain the adviser's first name, e.g. `Bookings Silvia`, `Bookings Alice`), each with a header row and one pre-filled row per slot:

| Date | Time | Length of meeting | Name of the person booking | Email of the person booking | Organisation | Brief description of what you would like to discuss, or the question you would like to ask |
|---|---|---|---|---|---|---|
| Monday, 9 November | 17:10 - 17:40 | 30 min | | | | |

A booking fills the booker columns of the row whose day and start time match; a cancellation clears them again. Columns are found by header text, so their order doesn't matter. If a slot row is missing or already filled by someone else (e.g. typed in by hand), the booking is added as a new row underneath (highlighted red for a clash) rather than overwriting anything.

1. Open the target Google Sheet in Google Drive and check the adviser tabs follow the layout above.
2. Click **Extensions > Apps Script**.
3. Replace the contents of `Code.gs` with [`scripts/apps-script/booking-sheet-sync.gs`](scripts/apps-script/booking-sheet-sync.gs) and save.

> The older single-tab script ([`scripts/apps-script-webhook.gs`](scripts/apps-script-webhook.gs), one row per booking in a `Bookings` tab) still works with the same app payload if a flat log is preferred.

### 2. Set the `WEBHOOK_SECRET` Script Property
1. In the Apps Script editor left sidebar, click **Project Settings** (the gear icon ⚙️).
2. Scroll down to **Script Properties** and click **Add script property**.
3. Set:
   - **Property**: `WEBHOOK_SECRET`
   - **Value**: The exact same secret string configured in your server environment variable `SHEETS_WEBHOOK_SECRET`.
4. Click **Save script properties**.

### 3. Deploy as a Web App
1. In the top-right of the Apps Script editor, click **Deploy > New deployment**.
2. Click the gear icon next to **Select type** and choose **Web app**.
3. Configure the deployment:
   - **Description**: `OAK Bookings Webhook v1`
   - **Execute as**: **Me** (your Google account that owns/edits the Sheet)
   - **Who has access**: **Anyone** *(required so serverless backend requests can reach the endpoint without interactive Google OAuth browser login; authentication is enforced by `WEBHOOK_SECRET` in the JSON body)*
4. Click **Deploy** and authorize the script permissions when prompted by Google.
5. Copy the **Web app URL** (it must end in `/exec`) and set it as `SHEETS_WEBHOOK_URL` in your environment variables.

### 4. Redeploying a New Version After Script Edits
> [!IMPORTANT]
> Saving changes in the Apps Script editor (`Ctrl+S`) does **not** update a live `/exec` Web App URL automatically. You must deploy a **New version**:
1. Click **Deploy > Manage deployments**.
2. Click the **Edit** (pencil ✏️) icon on your active deployment.
3. Under **Version**, select **New version** from the dropdown.
4. Click **Deploy**. (This updates the live deployment in place while keeping the same `/exec` URL).

### 5. Google Sheets Webhook Troubleshooting Guide

| Symptom / Error | Root Cause | Solution |
|---|---|---|
| **`unauthorized`** | `SHEETS_WEBHOOK_SECRET` in the app environment does not match the `WEBHOOK_SECRET` Script Property in Apps Script, or the Script Property is missing. | Open Apps Script **Project Settings > Script Properties**, confirm the property is named `WEBHOOK_SECRET` (exact uppercase), and ensure its value matches `SHEETS_WEBHOOK_SECRET` with no trailing spaces. |
| **`302` or HTML response instead of JSON (`Apps Script returned an HTML page instead of JSON`)** | Web app deployment has **Who has access** set to *"Only myself"* or *"Anyone within organization"* (which redirects to a Google sign-in HTML page), or the script threw an unhandled syntax error before `doPost`. | In Apps Script, go to **Deploy > Manage deployments > Edit**, set **Execute as: Me** and **Who has access: Anyone**, select **Version: New version**, and click **Deploy**. |
| **Old deployed version (changes to `Code.gs` have no effect)** | Saving `Code.gs` only updates the HEAD draft (`/dev`), not the production `/exec` deployment. | Go to **Deploy > Manage deployments > Edit (pencil) > Version: New version > Deploy**. |
| **URL ending in `/dev` instead of `/exec`** | The test deployment URL (`/dev`) was copied instead of the production Web App URL (`/exec`). `/dev` URLs only work in a browser logged into the script owner's Google session. | Copy the **Web app URL** ending in `/exec` from **Deploy > Manage deployments** and update `SHEETS_WEBHOOK_URL`. |

---

## Running the Automated Test Suite

Verify validation, concurrency double-booking prevention, cancellation, and advisor transitions:
```bash
node scripts/test-booking-concurrency.cjs
```

---

## Shared Files (Google Drive Integration)

The platform connects to Google Drive through the Google Drive API v3 to publish presentations, meeting notes, guidelines, and images for attendees at `/drive`.

### Published/Incoming Approval Workflow
1. **Attendee Uploads**: Attendees upload presentations or notes via the public Google Form (`NEXT_PUBLIC_DRIVE_UPLOAD_FORM_URL`). Google Forms places incoming uploads into a private response folder.
2. **In-App Review & Approval (`/admin/drive/review`)**: 
   - Organizers can view, search, and preview pending submissions directly within the platform.
   - **Preview**: Secure in-browser preview for images and PDF documents through an authenticated streaming route (`/api/admin/drive/stream/[fileId]`). No public links are exposed.
   - **Approve**: Organizers choose the target category (**Presentations**, **Notes**, **Images**, or **Other = directly in Published**), optionally rename the file and add a description/caption. The platform moves the file atomically using Google Drive API `files.update` (`addParents` / `removeParents`), automatically creating the destination folder if it doesn't already exist.
   - **Bulk Actions**: Multiple files can be selected and approved or rejected simultaneously.
   - **Reject**: Moves the file into a private `Rejected/` folder outside `Published/` with an optional rejection reason. Files are never deleted permanently during normal rejection.
   - **Super Admin Governance**: Only `super_admin` accounts can view the `Rejected` archives, restore files back to the active review queue, or permanently delete items. Regular admins receive 403 Forbidden.
   - **Audit Trail**: Every approve, reject, restore, and delete action is recorded in the platform audit log with admin email, timestamp, file ID, file name, and destination/reason.
3. **Display**: The public platform strictly displays only what sits inside `Published/` and its direct subfolders. It never accesses, exposes, or allows downloads of files outside `Published/`.
4. **Cache & Instant Refresh**: File listings are cached in-memory and via Next.js revalidation for 60 seconds. Approving or rejecting a file immediately invalidates this cache so public visitors see approved files right away.

### Service Account Setup (For In-App Approvals & Moves)

To enable in-app file approvals, preview streaming, and folder moves, configure a Google Cloud Service Account with Drive write access:

1. **Create a Service Account**:
   - In [Google Cloud Console](https://console.cloud.google.com/), select your project and navigate to **IAM & Admin > Service Accounts**.
   - Click **Create Service Account**.
   - Name it (e.g. `oak-drive-manager`) and click **Create and Continue**.
   - Role: No project-level role is required (folder access is granted directly in Google Drive). Click **Done**.
2. **Generate a Service Account Key**:
   - Click on the created service account and go to the **Keys** tab.
   - Click **Add Key > Create new key > JSON**.
   - Download the JSON key file.
3. **Share Folders in Google Drive**:
   - Copy the service account's email address (e.g. `oak-drive-manager@project-id.iam.gserviceaccount.com`).
   - In Google Drive, open the **Incoming folder** (where Google Form responses land), click **Share**, paste the service account email, set the role to **Editor**, uncheck "Notify people", and click **Share**.
   - Open the **Published folder** (and/or parent Shared Files folder), click **Share**, paste the service account email, set role to **Editor**, and click **Share**.
4. **Configure Environment Variables**:
   Set in `.env` (local) and in host environment variables (production):
   ```env
   GOOGLE_SERVICE_ACCOUNT_EMAIL=oak-drive-manager@project-id.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC..."
   GOOGLE_DRIVE_INCOMING_FOLDER_ID=1tEB0aC4m5AXNapFlZKMstib75F-YE1Avj7Msjh97D6x9YWCy3Ov2I-D2R9TVaQTkxoDDHPak
   GOOGLE_DRIVE_PUBLISHED_FOLDER_ID=1g7OpDOroSaNcfSumoH0fy-oGeQo13Kbn
   ```
   > [!TIP]
   > The platform automatically normalises private keys: it accepts escaped `\n` sequences, actual newlines, quotes, or even the raw/base64-encoded Service Account JSON file directly in `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`.

### Service Account Troubleshooting Guide

| Issue | Root Cause | Step-by-Step Fix |
|---|---|---|
| **Service account not shared as Editor (403 / "File not found" / "The user does not have sufficient permissions")** | The service account email was not added to the Google Drive folders, or was added with "Viewer" instead of "Editor" access. | 1. In Google Drive, right-click the **Incoming folder** > **Share**.<br>2. Add the `GOOGLE_SERVICE_ACCOUNT_EMAIL` as **Editor**.<br>3. Right-click the **Published folder** > **Share** and add as **Editor**.<br>4. Open `/admin/drive` and verify the **"Drive write access"** status card turns green. |
| **Key format and newline issues ("error:0909006C:PEM routines:get_name:no start line")** | Line breaks in `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` were lost when pasting into cloud host dashboards (e.g. Vercel), or literal `\n` characters were not expanded. | 1. The platform automatically converts literal `\n` into real newlines.<br>2. Alternatively, base64-encode your entire service account JSON file: `base64 -w 0 credentials.json` and paste the base64 string directly into `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. |
| **Key creation blocked by Google Workspace organizational policy ("iam.disableServiceAccountKeyCreation")** | The Google Workspace or Google Cloud organization has enabled the boolean constraint `constraints/iam.disableServiceAccountKeyCreation`. | 1. Contact your Google Cloud Organization Administrator.<br>2. In the Google Cloud Console, navigate to **IAM & Admin > Organization Policies**.<br>3. Search for **Disable Service Account Key Creation**.<br>4. Either set policy to **Off/Enforce: False** for this project, or add the project to the policy exclusion list. |
| **Move failing because of file ownership or Shared Drive permissions ("The caller does not have permission to execute the specified operation")** | If files reside in a Google Workspace Shared Drive (Team Drive), moves require `supportsAllDrives=true` and Manager/Content Manager access. Or individual personal Drive files cannot have parents removed if owned by another domain. | 1. The platform automatically passes `supportsAllDrives: true` and `includeItemsFromAllDrives: true`.<br>2. In Google Drive, ensure the service account is added as a **Content Manager** or **Manager** on the Shared Drive.<br>3. Verify that the Incoming folder and Published folder are within the same Shared Drive or owned within the same Google Workspace domain. |

### Environment Variables
- `GOOGLE_DRIVE_API_KEY`: Server-side Google Drive API v3 key (never exposed to browser bundles or URLs).
- `GOOGLE_DRIVE_PUBLISHED_FOLDER_ID`: Folder ID of the Published folder (or its parent Drive folder).
- `NEXT_PUBLIC_DRIVE_UPLOAD_FORM_URL`: Direct link to the Google Form for attendee uploads.
- `MAX_DOWNLOAD_MB`: Maximum file size permitted for direct server streaming (defaults to `100` MB if unset). Files exceeding this threshold display a direct link to open the file in Google Drive.

### Troubleshooting Google Drive Issues
| Issue | Probable Cause | Solution |
|---|---|---|
| **403 "Google Drive API has not been used in project..."** | Google Drive API v3 is not enabled in Google Cloud Console. | Enable Google Drive API v3 in your Google Cloud Console for the project matching your API key. |
| **403 "API key not valid / IP / HTTP referer restricted"** | API Key restrictions block the server's outbound IP or required APIs. | In Google Cloud Console under **APIs & Services > Credentials**, ensure the key has access to Google Drive API v3 and that server IPs are not inadvertently blocked by client-side referer rules. |
| **Empty list / Files not showing up** | The folder or files are not shared with public read permissions. | In Google Drive, ensure the `Published/` folder is shared with **"Anyone with the link: Viewer"**. |
| **404 "Folder not found"** | `GOOGLE_DRIVE_PUBLISHED_FOLDER_ID` is mistyped or points to an invalid/deleted folder. | Copy the exact folder ID from your Google Drive URL (`https://drive.google.com/drive/folders/<ID>`) and set `GOOGLE_DRIVE_PUBLISHED_FOLDER_ID`. |
