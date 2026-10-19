import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Faltan TURSO_DATABASE_URL o TURSO_AUTH_TOKEN. Ejecuta con: node --env-file=.env scripts/migrate-states.mjs");
  process.exit(1);
}

const client = createClient({ url: url.trim(), authToken: authToken.trim() });

try {
  const before = await client.execute(
    "SELECT COUNT(*) AS total FROM user_anime WHERE status IN ('PAUSED', 'DROPPED')"
  );
  const affected = Number(before.rows[0]?.total ?? 0);

  if (affected === 0) {
    console.log("No hay registros con estado PAUSED o DROPPED. Nada que migrar.");
  } else {
    const result = await client.execute(
      "UPDATE user_anime SET status = 'PLANNING' WHERE status IN ('PAUSED', 'DROPPED')"
    );
    console.log(`Migración completada: ${result.rowsAffected ?? affected} registro(s) movidos de PAUSED/DROPPED a PLANNING.`);
  }
} catch (error) {
  console.error("Error durante la migración:", error);
  process.exitCode = 1;
} finally {
  client.close();
}
