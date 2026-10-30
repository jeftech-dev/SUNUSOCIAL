// SMS adapter (DB-7, DT-2, DT-29). Selected by SMS_PROVIDER.
// `console` prints messages to the Convex logs in development and preview; production refuses it.
// The real provider is pending the board (BOARD_QUESTIONS.md Q1): add it here once chosen.

import { assertProvidersAllowed, loadConfig } from "../config";

export interface SmsProvider {
  send(to: string, text: string): Promise<void>;
}

const consoleProvider: SmsProvider = {
  async send(to, text) {
    console.log(`[SMS console] to ${to}: ${text}`);
  },
};

export function getSmsProvider(env: Record<string, string | undefined> = process.env): SmsProvider {
  const config = loadConfig(env);
  assertProvidersAllowed(config);
  if (config.smsProvider === "console") return consoleProvider;
  throw new Error(`SMS provider "${config.smsProvider}" is not implemented yet`);
}
