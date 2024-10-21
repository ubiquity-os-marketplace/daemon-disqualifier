import { LOG_LEVEL } from "@ubiquity-dao/ubiquibot-logger";

export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOG_LEVEL?: LOG_LEVEL;
    }
  }
}
