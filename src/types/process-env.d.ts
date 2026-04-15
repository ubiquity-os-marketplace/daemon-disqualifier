declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL?: string;
      GITHUB_TOKEN: string;
    }
  }
}

export {};
