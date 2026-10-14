import { integer, sqliteTable, text, index } from "drizzle-orm/sqlite-core";
export const addonSettings = sqliteTable("addon_settings", { id: integer("id").primaryKey(), left: text("left").notNull().default("off"), right: text("right").notNull().default("off") });

export const sponsorSettings = sqliteTable("sponsor_settings", {
  id: integer("id").primaryKey(),
  imageKey: text("image_key").notNull().default(""),
  width: integer("width").notNull().default(240),
  right: integer("right").notNull().default(98),
  top: integer("top").notNull().default(75),
  opacity: integer("opacity").notNull().default(100),
  visible: integer("visible", { mode: "boolean" }).notNull().default(true),
});

export const scorebugSettings = sqliteTable("scorebug_settings", {
  id: integer("id").primaryKey(),
  gameId: text("game_id").notNull(),
  showClock: integer("show_clock", { mode: "boolean" }).notNull().default(true),
  autoAdvance: integer("auto_advance", { mode: "boolean" }).notNull().default(false),
  activeStartedAt: integer("active_started_at"),
  autoAdvanceEndsAt: integer("auto_advance_ends_at"),
  manualClockEnabled: integer("manual_clock_enabled", { mode: "boolean" }).notNull().default(false),
  manualClockRunning: integer("manual_clock_running", { mode: "boolean" }).notNull().default(false),
  manualClockRemainingSeconds: integer("manual_clock_remaining_seconds").notNull().default(600),
  manualClockEndsAt: integer("manual_clock_ends_at"),
  gameQueue: text("game_queue").notNull().default("[]"),
  queueIndex: integer("queue_index").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const gameOverrides = sqliteTable("game_overrides", {
  gameId: text("game_id").primaryKey(),
  visitorScore: integer("visitor_score"),
  homeScore: integer("home_score"),
  period: integer("period"),
});

export const controlUsers = sqliteTable("control_users", {
  email: text("email").primaryKey(),
  userId: text("user_id"),
  role: text("role").notNull().default("operator"),
});

export const logSessions = sqliteTable("log_sessions", {
  id: text("id").primaryKey(), gameId: text("game_id").notNull(), startedAt: integer("started_at").notNull(),
  initialized: integer("initialized").notNull().default(0), lastPeriod: integer("last_period"),
});
export const gameEventLogs = sqliteTable("game_event_logs", {
  id: text("id").primaryKey(), sessionId: text("session_id").notNull(), gameId: text("game_id").notNull(),
  sourceEventId: text("source_event_id"), type: text("type").notNull(), payload: text("payload").notNull(),
  receivedAt: integer("received_at"), elapsedSeconds: integer("elapsed_seconds"), updatedAt: integer("updated_at").notNull(),
}, table => [index("idx_game_event_logs_game").on(table.gameId), index("idx_game_event_logs_source").on(table.sessionId, table.sourceEventId)]);
