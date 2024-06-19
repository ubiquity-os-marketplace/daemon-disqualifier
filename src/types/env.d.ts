declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GITHUB_TOKEN: string;
      SUPABASE_KEY: string;
      SUPABASE_URL: string;
    }
  }
}

export {};
