import { Type, Static } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";

const envConfigSchema = Type.Object({
  SUPABASE_URL: Type.String(),
  SUPABASE_KEY: Type.String(),
});

export type EnvConfigType = Static<typeof envConfigSchema>;
export const envConfigValidator = new StandardValidator(envConfigSchema);

export default envConfigSchema;
