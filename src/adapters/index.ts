import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types/context";
import { Database } from "../types/database";

export function createAdapters(supabaseClient: SupabaseClient<Database>, context: Context) {
  return {
    supabase: {
      repository: {
        async upsert(url: string, deadline: Date, createdAt?: Date) {
          const { data, error } = await supabaseClient
            .from("repositories")
            .upsert(
              {
                url,
                deadline: deadline.toISOString(),
                created_at: createdAt?.toISOString(),
              },
              {
                onConflict: "url",
              }
            )
            .select()
            .single();
          if (error) {
            context.logger.error(`Could not upsert repository ${url}.`, error);
          }
          return data;
        },
        async delete(url: string) {
          const { data, error } = await supabaseClient.from("repositories").delete().eq("url", url).select().single();
          if (error) {
            context.logger.error(`Could not delete repository ${url}.`, error);
          }
          return data;
        },
      },
    },
  };
}
