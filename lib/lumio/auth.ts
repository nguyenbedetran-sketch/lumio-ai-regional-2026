import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import {
  ensureIdentity,
  findIdentity,
  getUser,
  getUserByStorageKey,
  claimIdentity,
} from "../server/store";
import type { User, IdentityProvider } from "../server/types";
import { isPublicDemo } from "../server/public-demo";
import { isDesktopPreview } from "../server/desktop-mode";
export type LinkContext = { token: string; userId: string };
export function providerStatus() {
  if (isPublicDemo() || isDesktopPreview())
    return { google: false, facebook: false, ai: false as const };
  const localProxy = process.env.NODE_ENV === "development" && process.env.AUTH_TRUST_HOST === "true" && process.env.LUMIO_DEV_ORIGIN_SELECTION === "true";
  const base = !!process.env.NEXTAUTH_SECRET && (!!process.env.NEXTAUTH_URL || localProxy);
  return {
    google:
      base &&
      !!process.env.GOOGLE_CLIENT_ID &&
      !!process.env.GOOGLE_CLIENT_SECRET,
    facebook:
      base &&
      !!process.env.FACEBOOK_CLIENT_ID &&
      !!process.env.FACEBOOK_CLIENT_SECRET,
    ai: false as const,
  };
}
export function authOptions(context?: {
  link?: LinkContext;
  invalidLink?: boolean;
}): NextAuthOptions {
  const status = providerStatus();
  let signedInUser: User | undefined;
  return {
    secret: process.env.NEXTAUTH_SECRET,
    providers: [
      ...(status.google
        ? [
            GoogleProvider({
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            }),
          ]
        : []),
      ...(status.facebook
        ? [
            FacebookProvider({
              clientId: process.env.FACEBOOK_CLIENT_ID!,
              clientSecret: process.env.FACEBOOK_CLIENT_SECRET!,
            }),
          ]
        : []),
    ],
    session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
    pages: { signIn: "/", error: "/" },
    callbacks: {
      async signIn({ account, profile, user }) {
        if (
          !account ||
          !["google", "facebook"].includes(account.provider) ||
          context?.invalidLink
        )
          return false;
        try {
          const identity = {
            provider: account.provider as IdentityProvider,
            providerAccountId: account.providerAccountId,
            email: user.email,
            name: user.name,
            emailVerified:
              account.provider === "google" &&
              (profile as { email_verified?: boolean } | undefined)
                ?.email_verified === true,
          };
          signedInUser = context?.link
            ? claimIdentity({
                userId: context.link.userId,
                token: context.link.token,
                identity,
              })
            : ensureIdentity(identity);
          return !signedInUser.disabled;
        } catch {
          return false;
        }
      },
      async jwt({ token, account }) {
        if (account) {
          const user =
            signedInUser ||
            findIdentity(
              account.provider as IdentityProvider,
              account.providerAccountId,
            );
          if (!user || user.disabled) return {};
          token.userId = user.id;
          token.accountKey = user.storageKey;
          token.sessionVersion = user.sessionVersion;
          token.authenticatedAt = Date.now();
          token.name = user.name;
          token.email = user.email;
        } else if (!token.userId && typeof token.accountKey === "string") {
          // Upgrade only a signed legacy JWT. Never grant admin from its email.
          const match = /^(google|facebook):([A-Za-z0-9._:-]{1,200})$/.exec(
            token.accountKey,
          );
          if (match) {
            const existing = getUserByStorageKey(token.accountKey);
            // Legacy JWTs have no version; never assign them a new version after
            // suspension/revocation. A fresh provider login is required instead.
            if (
              existing &&
              (existing.disabled || existing.sessionVersion !== 1)
            )
              return {};
            const user =
              existing ||
              ensureIdentity({
                provider: match[1] as IdentityProvider,
                providerAccountId: match[2],
                name: token.name,
                email: token.email,
                emailVerified: false,
              });
            token.userId = user.id;
            token.sessionVersion = user.sessionVersion;
            token.authenticatedAt = 0;
          }
        }
        if (typeof token.userId === "string") {
          const user = getUser(token.userId);
          if (
            !user ||
            user.disabled ||
            token.sessionVersion !== user.sessionVersion
          )
            return {};
        }
        return token;
      },
      async session({ session, token }) {
        if (typeof token.userId !== "string")
          return { ...session, user: undefined, accountKey: undefined };
        const user = getUser(token.userId);
        if (
          !user ||
          user.disabled ||
          token.sessionVersion !== user.sessionVersion
        )
          return { ...session, user: undefined, accountKey: undefined };
        return {
          ...session,
          user: { ...session.user, name: user.name, email: user.email },
          accountKey: user.storageKey,
          userId: user.id,
          sessionVersion: user.sessionVersion,
          authenticatedAt: token.authenticatedAt,
        };
      },
      async redirect({ url, baseUrl }) {
        if (url.startsWith("/") && !url.startsWith("//"))
          return `${baseUrl}${url}`;
        try {
          if (new URL(url).origin === baseUrl) return url;
        } catch {}
        return baseUrl;
      },
    },
    debug: false,
  };
}
