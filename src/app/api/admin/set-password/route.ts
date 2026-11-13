import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, isSupabaseServerConfigured } from '@/lib/supabase/server';
import { isValidAdminEmailDomain } from '@/lib/auth/policy';
import { getAdminUser } from '@/lib/auth/admin-users';

export async function POST(request: NextRequest) {
  try {
    // Require a server-only setup token header to prevent public account creation.
    const setupToken = request.headers.get('x-setup-token') || '';
    const expected = process.env.ADMIN_SETUP_TOKEN || '';

    if (!expected || setupToken !== expected) {
      return NextResponse.json(
        { error: 'Unauthorized.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email address is required.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidAdminEmailDomain(cleanEmail)) {
      return NextResponse.json(
        { error: 'Admin registration is restricted to authorized organization domains (oakfnd.org, oakfnd.ch, uncommon.org).' },
        { status: 403 }
      );
    }

    const adminUser = await getAdminUser(cleanEmail);
    if (!adminUser || !adminUser.is_active) {
      return NextResponse.json(
        { error: 'Account is not in the active admin allowlist.' },
        { status: 403 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const cleanPassword = password.trim();

    // If Supabase is configured, create or update user in Supabase Auth
    if (isSupabaseServerConfigured()) {
      try {
        const adminClient = createAdminClient();
        const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers();

        if (listError) {
          console.warn('Could not list users from Supabase Auth:', listError);
        }

        const existingUser = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === cleanEmail
        );

        if (existingUser) {
          const { error: updateError } = await adminClient.auth.admin.updateUserById(
            existingUser.id,
            { password: cleanPassword }
          );

          if (updateError) {
            console.error('Supabase password update error:', updateError);
            return NextResponse.json(
              { error: updateError.message || 'Failed to update admin password in authentication system.' },
              { status: 500 }
            );
          }
        } else {
          const { error: createError } = await adminClient.auth.admin.createUser({
            email: cleanEmail,
            password: cleanPassword,
            email_confirm: true,
          });

          if (createError) {
            console.error('Supabase user creation error:', createError);
            return NextResponse.json(
              { error: createError.message || 'Failed to create admin user in authentication system.' },
              { status: 500 }
            );
          }
        }
      } catch (authErr: any) {
        console.error('Unexpected Supabase Auth error:', authErr);
        return NextResponse.json(
          { error: authErr.message || 'Unexpected authentication service error.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      message: 'Admin password set successfully.',
    });
  } catch (error: any) {
    console.error('Set password route error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error processing password set request.' },
      { status: 500 }
    );
  }
}
