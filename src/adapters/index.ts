import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types/context";
import { Database } from "../types/database";

export function createAdapters(supabaseClient: SupabaseClient<Database>, context: Context) {
  return {
    supabase: {
      repository: {
        async upsert(url: string, deadline: Date) {
          const { data } = await supabaseClient
            .from("repositories")
            .upsert({
              url,
              deadline: deadline.toISOString(),
            })
            .select()
            .single();
          return data;
        },
      },
    },
  };
}
