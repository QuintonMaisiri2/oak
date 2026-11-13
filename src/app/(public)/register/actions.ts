'use server';

import { headers, cookies } from 'next/headers';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient, isSupabaseAdminConfigured } from '@/lib/supabase/server';
import { registrationSchema } from '@/lib/validation/schemas';
import { generateEventCode } from '@/lib/qr';
import { getPartners } from '@/lib/directory/server';
import { AUTH_COOKIE_OPTIONS } from '@/lib/auth/policy';
import { PASS_ACCESS_COOKIE, PASS_ACCESS_MAX_AGE, signPassAccess } from '@/lib/auth/pass-access';
import { REGISTRATION_OPEN } from '@/lib/registration';

export type RegisterResult =
  | { success: true; attendeeId: string; eventCode: string }
  | {
      success: false;
      error: string;
      errors?: Record<string, string[]>;
      isAlreadyRegistered?: boolean;
      registeredEmail?: string;
    };

export async function registerAttendee(rawInput: unknown): Promise<RegisterResult> {
  // The event has ended: refuse new registrations even if the form is reached somehow.
  if (!REGISTRATION_OPEN) {
    return { success: false, error: 'Registration for the Oak Grantee Convening 2026 has closed.' };
  }

  const parsed = registrationSchema.safeParse(rawInput);
  if (!parsed.success) {
    const errors: Record<string, string[]> = {};
    for (const [key, value] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (value) errors[key] = value;
    }
    const firstErrorMessage = Object.values(errors)[0]?.[0] || 'Please fill in all required fields accurately.';
    return { success: false, error: firstErrorMessage, errors };
  }

  try {
    const secret = process.env.REGISTRATION_RPC_SECRET;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!secret || secret.length < 32 || !url || !key) {
      console.error('Public registration gateway is not configured.');
      return { success: false, error: 'Registration is temporarily unavailable. Please try again later.' };
    }

    const requestHeaders = await headers();
    // Vercel overwrites x-forwarded-for to prevent IP spoofing.
    // Outside Vercel use a shared bucket unless a trusted gateway is implemented.
    const forwarded = process.env.VERCEL === '1' ? requestHeaders.get('x-forwarded-for')?.split(',')[0].trim() : undefined;
    const address = forwarded && isIP(forwarded) ? forwarded : 'shared';
    const rateKey = createHmac('sha256', secret).update(address).digest('hex');
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const eventCode = generateEventCode();

    const normalizedEmail = parsed.data.email.trim().toLowerCase();
    let { data, error } = await client.rpc('register_public_attendee', {
      p_secret: secret,
      p_rate_key: rateKey,
      p_event_code: eventCode,
      p_input: { ...parsed.data, email: normalizedEmail },
    });

    // Compatibility fallback: If Supabase RPC has not yet been migrated to accept 'Grantee',
    // fallback to passing 'Partner' through the legacy RPC constraint and then restoring 'Grantee' in DB.
    if (data && !data.success && data.code === 'invalid_input' && parsed.data.role === 'Grantee') {
      const fallbackResult = await client.rpc('register_public_attendee', {
        p_secret: secret,
        p_rate_key: rateKey,
        p_event_code: eventCode,
        p_input: { ...parsed.data, email: normalizedEmail, role: 'Partner' },
      });
      if (fallbackResult.data) {
        data = fallbackResult.data;
        error = fallbackResult.error;
        if (data.success && data.attendeeId && isSupabaseAdminConfigured()) {
          try {
            const admin = createAdminClient();
            await admin.from('attendees').update({ role: 'Grantee' }).eq('id', data.attendeeId);
          } catch (updateErr) {
            console.error('Failed to update attendee role to Grantee in DB:', updateErr);
          }
        }
      }
    }

    if (error || !data) {
      console.error('Registration RPC failed:', error);
      return { success: false, error: 'Unable to complete registration. Please try again later.' };
    }

    if (!data.success) {
      const isAlreadyRegistered = data.code === 'already_registered';
      const errorMessage =
        data.code === 'rate_limited'
          ? 'Too many registration attempts. Please try again in 15 minutes.'
          : isAlreadyRegistered
          ? `The email address "${parsed.data.email}" is already registered for this event. Please sign in using Continue with Google to access your ticket.`
          : data.code === 'invalid_input'
          ? 'Some registration details are invalid or missing. Please review the highlighted fields and try again.'
          : 'Unable to complete registration. Please try again later.';

      return {
        success: false,
        error: errorMessage,
        isAlreadyRegistered,
        registeredEmail: isAlreadyRegistered ? parsed.data.email : undefined,
      };
    }

    // A convenience bookmark only: never used to authorize database access.
    (await cookies()).set(PASS_ACCESS_COOKIE, signPassAccess(data.eventCode, secret), {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: PASS_ACCESS_MAX_AGE,
    });
    (await cookies()).set('oak_partner_pass', data.eventCode, {
      ...AUTH_COOKIE_OPTIONS,
      expires: new Date('2026-11-11T23:59:59Z'),
    });

    return { success: true, attendeeId: data.attendeeId, eventCode: data.eventCode };
  } catch (error) {
    console.error('Public registration failed:', error);
    return { success: false, error: 'Unable to complete registration. Please try again later.' };
  }
}

export async function fetchPartners(): Promise<{ name: string }[]> {
  return (await getPartners()).map(({ name }) => ({ name })).sort((a, b) => a.name.localeCompare(b.name));
}
