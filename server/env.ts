/**
 * The only place that reads process.env. Everything else imports `env`.
 * Edge-safe (no Node imports) because middleware uses it.
 *
 * Missing values do not throw here: each feature reports its own "not configured"
 * state so the app can start and tell you exactly what to set.
 */

import type { SquareMode } from "@/lib/types";

const read = (key: string) => process.env[key]?.trim() ?? "";
const flag = (key: string, fallback: boolean) => {
  const v = read(key).toLowerCase();
  return v === "" ? fallback : v !== "false" && v !== "0";
};

const squareEnv = read("SQUARE_ENV") === "sandbox" ? "sandbox" : "production";

export const env = {
  isProduction: process.env.NODE_ENV === "production",

  square: {
    accessToken: read("SQUARE_ACCESS_TOKEN"),
    /** "sandbox" | "production" — which Square API host to talk to */
    environment: squareEnv,
    /** How the app labels it: "sandbox" | "live" */
    mode: (squareEnv === "sandbox" ? "sandbox" : "live") as SquareMode,
    baseUrl: squareEnv === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com",
    apiVersion: "2025-01-23",
    /** Blank = the account's main location */
    locationId: read("SQUARE_LOCATION_ID"),
    /** Set stock to 1 per posted row */
    setStock: flag("SQUARE_SET_STOCK", true),
    get configured() {
      return !!this.accessToken;
    },
  },

  mongo: {
    uri: read("MONGODB_URI"),
    dbName: read("MONGODB_DB") || "lister",
    get configured() {
      return !!this.uri;
    },
  },

  auth: {
    user: read("LISTER_USER"),
    passwordHash: read("LISTER_PASSWORD_HASH"),
    /** Plain-text fallback for a first setup; prefer the hash */
    password: read("LISTER_PASSWORD"),
    secret: read("LISTER_SECRET"),
    minSecretLength: 32,
    sessionDays: 7,
  },
} as const;

export const SETUP = {
  square: "SQUARE_ACCESS_TOKEN is not set in .env.local.",
  mongo: "MONGODB_URI is not set in .env.local",
  authAccount: "Set LISTER_USER and LISTER_PASSWORD_HASH (npm run hash-password) in .env.local, then restart the app",
  authSecret: `Set LISTER_SECRET in .env.local to a random string of at least ${env.auth.minSecretLength} characters, then restart the app`,
} as const;
