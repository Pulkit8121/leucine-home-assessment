#!/bin/sh
# Creates the second database that `npm test` uses, so integration tests never touch
# the development data. Runs once, on first initialisation of the volume.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-SQL
  CREATE DATABASE cleen_test;
SQL
