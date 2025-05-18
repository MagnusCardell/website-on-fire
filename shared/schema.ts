import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// File system object schema
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  path: text("path").notNull(),
  name: text("name").notNull(),
  content: text("content"),
  isDirectory: boolean("is_directory").notNull().default(false),
  parentId: integer("parent_id"),
});

// Terminal command history schema
export const commandHistory = pgTable("command_history", {
  id: serial("id").primaryKey(),
  command: text("command").notNull(),
  output: text("output"),
  timestamp: text("timestamp").notNull(),
});

// Session schema to store user session data
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  currentDirectory: text("current_directory").notNull().default("~"),
  terminalState: jsonb("terminal_state"),
});

// Insert schemas
export const insertFileSchema = createInsertSchema(files).pick({
  path: true,
  name: true,
  content: true,
  isDirectory: true,
  parentId: true,
});

export const insertCommandHistorySchema = createInsertSchema(commandHistory).pick({
  command: true,
  output: true,
  timestamp: true,
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  currentDirectory: true,
  terminalState: true,
});

// Types
export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

export type InsertCommandHistory = z.infer<typeof insertCommandHistorySchema>;
export type CommandHistory = typeof commandHistory.$inferSelect;

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
