-- Phase 19: Authorization RBAC schema migration
-- Adds roles and user-role-memberships tables for role-based access control

-- Create the enum type for roles
CREATE TYPE user_roles AS ENUM ('admin', 'operator', 'viewer');

-- Create roles table
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  role user_roles NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create user_role_memberships table
CREATE TABLE user_role_memberships (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by INTEGER REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE (user_id, role_id)
);

-- Create index for faster lookups
CREATE INDEX idx_user_role_memberships_user_id ON user_role_memberships(user_id);
CREATE INDEX idx_user_role_memberships_expires_at ON user_role_memberships(expires_at);

-- Insert default roles
INSERT INTO roles (role) VALUES ('viewer'), ('operator'), ('admin');

-- By default, first user gets admin role (if bootstrap is configured)
-- OR we grant viewer role to all authenticated users by default
-- This can be adjusted via a seed script or manual intervention