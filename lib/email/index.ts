// Email adapter (DT-16): Resend when RESEND_API_KEY is set, otherwise the console in development
// and preview. Production requires Resend.

import { loadConfig } from "../config";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

const consoleProvider: EmailProvider = {
  async send({ to, subject, text }) {
    console.log(`[email console] to ${to}: ${subject}\n${text}`);
  },
};

function resendProvider(apiKey: string, from: string): EmailProvider {
  return {
    async send({ to, subject, text }) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, subject, text }),
      });
      if (!response.ok) {
        throw new Error(`Resend answered ${response.status}`);
      }
    },
  };
}

export function getEmailProvider(
  env: Record<string, string | undefined> = process.env,
): EmailProvider {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();
  if (apiKey && from) return resendProvider(apiKey, from);
  if (loadConfig(env).appEnv === "production") {
    throw new Error("RESEND_API_KEY and EMAIL_FROM are required in production");
  }
  return consoleProvider;
}
