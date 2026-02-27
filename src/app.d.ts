import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './Database.types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			session: any;
		}
		interface PageData {
			session: any;
		}
	}
}

export { };
