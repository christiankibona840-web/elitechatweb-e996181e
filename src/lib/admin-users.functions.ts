import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

interface CreateUserInput {
  email: string;
  password: string;
  member_id: string;
  username?: string;
  display_name?: string;
  make_admin?: boolean;
  make_reel_manager?: boolean;
}

export const adminCreateUser = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CreateUserInput) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid input');
    const email = String(input.email || '').trim().toLowerCase();
    const password = String(input.password || '');
    const member_id = String(input.member_id || '').trim().toUpperCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Invalid email');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    if (!/^#\d{3}-\d{3}$/.test(member_id)) throw new Error('Member ID must be like #360-001');
    const username = input.username
      ? String(input.username).trim().toLowerCase()
      : email.split('@')[0].replace(/[^a-z0-9_]/g, '').slice(0, 20);
    const display_name = input.display_name ? String(input.display_name).trim() : username;
    return {
      email,
      password,
      member_id,
      username,
      display_name,
      make_admin: !!input.make_admin,
      make_reel_manager: !!input.make_reel_manager,
    };
  })
  .handler(async ({ data, context }) => {
    // Verify caller is admin
    const { data: isAdmin, error: roleErr } = await context.supabase
      .rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (roleErr) throw new Error(roleErr.message);
    if (!isAdmin) throw new Error('Forbidden: admins only');

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

    // Ensure the approved ID exists & is available
    const { data: idRow } = await supabaseAdmin
      .from('approved_ids')
      .select('member_id, status')
      .eq('member_id', data.member_id)
      .maybeSingle();

    if (!idRow) {
      const { error: insErr } = await supabaseAdmin
        .from('approved_ids')
        .insert({ member_id: data.member_id, status: 'available', created_by: context.userId });
      if (insErr) throw new Error(`Could not register member ID: ${insErr.message}`);
    } else if (idRow.status === 'claimed') {
      throw new Error('This Member ID is already in use');
    } else if (idRow.status === 'disabled') {
      throw new Error('This Member ID is disabled');
    }

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        member_id: data.member_id,
        username: data.username,
        display_name: data.display_name,
      },
    });
    if (createErr || !created?.user) {
      throw new Error(createErr?.message || 'Could not create user');
    }

    const newUserId = created.user.id;

    if (data.make_admin) {
      await supabaseAdmin.from('user_roles').insert({ user_id: newUserId, role: 'admin' });
    }
    if (data.make_reel_manager) {
      await supabaseAdmin.from('user_roles').insert({ user_id: newUserId, role: 'reel_manager' });
    }

    return { id: newUserId, email: data.email, member_id: data.member_id };
  });
