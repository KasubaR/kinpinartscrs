// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import { sql } from 'drizzle-orm';
import { sqliteTable, integer, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const records = sqliteTable('records', { id: integer('id').primaryKey({autoIncrement:true}), kind: text('kind').notNull(), data: text('data').notNull(), source: integer('source').unique() }, (table) => [uniqueIndex('records_kind_document_number_unique').on(table.kind, sql`lower(trim(json_extract(${table.data}, '$.docNumber')))`)]);
export const counters=sqliteTable('counters',{kind:text('kind').primaryKey(),value:integer('value').notNull()});
