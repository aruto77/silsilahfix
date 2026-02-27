import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { redirect } from '@sveltejs/kit';

export async function handle({ event, resolve }) {
    // Create a Supabase client on the server
    event.locals.supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
        auth: {
            flowType: 'pkce'
        }
    });

    // Get the session from cookies
    const session = event.cookies.get('sb-access-token');
    if (session) {
        event.locals.session = JSON.parse(session);
    }

    // Protect routes that require authentication
    if (event.url.pathname === '/' && !event.locals.session) {
        throw redirect(303, '/login');
    }

    return resolve(event);
}
