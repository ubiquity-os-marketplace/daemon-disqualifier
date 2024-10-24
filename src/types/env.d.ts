import { LogLevel } from "@ubiquity-os/ubiquity-os-logger";

export {};

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      LOG_LEVEL?: LogLevel;
    }
  }
}
