import crypto from "node:crypto";
import { AuditAction, AuditLogEntry } from "@/core/types";
import { getDb } from "@/lib/store";

const AUDIT_LIMIT = 1000;

function nowISO(): string {
  return new Date().toISOString();
}

export function logAdminAction(
  action: AuditAction,
  detail: string,
  metadata?: Record<string, unknown>,
): void {
  const db = getDb();
  const entry: AuditLogEntry = {
    id: crypto.randomUUID(),
    createdAt: nowISO(),
    action,
    detail,
    metadataJson: metadata ? JSON.stringify(metadata) : undefined,
  };
  db.prepare(
    `INSERT INTO admin_audit_log (id, created_at, action, detail, metadata_json)
     VALUES (?, ?, ?, ?, ?)`
  ).run(entry.id, entry.createdAt, entry.action, entry.detail, entry.metadataJson ?? null);

  // Keep only the latest AUDIT_LIMIT entries
  db.prepare(
    `DELETE FROM admin_audit_log WHERE id NOT IN (
       SELECT id FROM admin_audit_log ORDER BY created_at DESC LIMIT ?
     )`
  ).run(AUDIT_LIMIT);
}

export function readAuditLog(limit: number = 100): AuditLogEntry[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, created_at, action, detail, metadata_json FROM admin_audit_log ORDER BY created_at DESC LIMIT ?"
  ).all(limit) as Array<{
    id: string;
    created_at: string;
    action: string;
    detail: string;
    metadata_json: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    action: row.action as AuditAction,
    detail: row.detail,
    metadataJson: row.metadata_json ?? undefined,
  }));
}
