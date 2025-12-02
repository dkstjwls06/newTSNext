import crypto from "crypto";

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

export function tokenExpiresInMinutes(minutes: number): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}