import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { TURSO_AUTH_TOKEN, TURSO_DATABASE_URL } from "astro:env/server";
import * as appSchema from "../db/schema";
import * as authSchema from "../db/auth-schema";

const schema = { ...appSchema, ...authSchema };
type Schema = typeof schema;

const globalForDb = globalThis as unknown as {
  _libsqlClient?: Client;
  _drizzleDb?: LibSQLDatabase<Schema>;
};

if (!globalForDb._libsqlClient) {
  globalForDb._libsqlClient = createClient({
    url: TURSO_DATABASE_URL.trim(),
    authToken: TURSO_AUTH_TOKEN.trim(),
  });
  globalForDb._drizzleDb = drizzle(globalForDb._libsqlClient, { schema });
}

export const db: LibSQLDatabase<Schema> = globalForDb._drizzleDb!;
