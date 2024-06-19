import { SupabaseClient } from "@supabase/supabase-js";
import { Context } from "../types/context";
import { Database } from "../types/database";

export function createAdapters(supabaseClient: SupabaseClient<Database>, context: Context) {
  return {
    supabase: {
      issues: {
        async upsert({
          url,
          deadline,
          lastReminder,
          createdAt,
          lastCheck,
        }: {
          url: string;
          deadline: Date;
          createdAt?: Date;
          lastReminder?: Date;
          lastCheck: Date;
        }) {
          const { data, error } = await supabaseClient
            .from("issues")
            .upsert(
              {
                url,
                deadline: deadline.toISOString(),
                created_at: createdAt?.toISOString(),
                last_reminder: lastReminder?.toISOString(),
                last_check: lastCheck.toISOString(),
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
          const { data, error } = await supabaseClient.from("issues").delete().eq("url", url).select().single();
          if (error) {
            context.logger.error(`Could not delete repository ${url}.`, error);
          }
          return data;
        },
        async get() {
          const { data, error } = await supabaseClient.from("issues").select();
          if (error) {
            context.logger.error(`Could not get repositories.`, error);
          }
          return data;
        },
        async getSingle(url: string) {
          const { data, error } = await supabaseClient.from("issues").select().eq("url", url).single();
          if (error) {
            context.logger.error(`Could not get repository.`, error);
          }
          return data;
        },
      },
    },
  };
}
