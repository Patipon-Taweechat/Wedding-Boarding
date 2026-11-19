"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { computeSessionToken, SESSION_COOKIE } from "@/lib/session";

export async function login(pin: string): Promise<{ ok: boolean }> {
  const expectedPin = process.env.STAFF_PIN;

  // No PIN configured — the gate is off, so let anything through.
  if (!expectedPin) return { ok: true };

  if (pin.trim() !== expectedPin) return { ok: false };

  const token = await computeSessionToken(expectedPin);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // A wedding day, generously: the device sits at the door from
    // load-in until the last guest leaves.
    maxAge: 60 * 60 * 18,
    path: "/",
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
