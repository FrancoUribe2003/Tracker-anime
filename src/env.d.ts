/// <reference path="../.astro/types.d.ts" />

type BetterAuthUser = import("better-auth").User;
type BetterAuthSession = import("better-auth").Session;

declare namespace App {
  interface Locals {
    user: BetterAuthUser | null;
    session: BetterAuthSession | null;
  }
}
