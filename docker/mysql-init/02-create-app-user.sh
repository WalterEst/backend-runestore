#!/bin/sh
# Crea el usuario MySQL de la aplicación con privilegios mínimos:
# solo SELECT/INSERT/UPDATE/DELETE sobre tienda_anime. Sin DROP/GRANT/SUPER (ver CLAUDE.md).
# Se ejecuta automáticamente por el entrypoint oficial de la imagen mysql tras 01-schema.sql.
set -e

mysql -u root -p"${MYSQL_ROOT_PASSWORD}" <<-EOSQL
  CREATE USER IF NOT EXISTS '${APP_DB_USER}'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
  GRANT SELECT, INSERT, UPDATE, DELETE ON tienda_anime.* TO '${APP_DB_USER}'@'%';
  FLUSH PRIVILEGES;
EOSQL
