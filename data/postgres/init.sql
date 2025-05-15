-- thank you kind stranger https://stackoverflow.com/questions/18389124/simulate-create-database-if-not-exists-for-postgresql
SELECT 'CREATE DATABASE openhab'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'openhab')\gexec;
