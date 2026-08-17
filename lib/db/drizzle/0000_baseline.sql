-- Baseline migration for LabOps
CREATE TYPE "public"."collector_status" AS ENUM('active', 'revoked');
CREATE TYPE "public"."reachability_job_status" AS ENUM('queued', 'leased', 'completed', 'expired');
CREATE TYPE "public"."user_roles" AS ENUM('admin', 'operator', 'viewer');

-- Tables will be created by drizzle-kit push
