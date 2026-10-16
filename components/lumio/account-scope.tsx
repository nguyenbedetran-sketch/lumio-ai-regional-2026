"use client";
import { createContext, useContext } from "react";

// Captured by the mounted workspace, so a stale tab cannot silently spend for
// a different cookie account after another tab signs in.
export const AccountScope = createContext("guest");
export function useAccountScope() {
  return useContext(AccountScope);
}
