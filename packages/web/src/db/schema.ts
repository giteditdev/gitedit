import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core"
import { createSchemaFactory } from "drizzle-zod"
import { z } from "zod"

const { createSelectSchema } = createSchemaFactory({ zodInstance: z })

// Better-auth tables (using camelCase as better-auth expects)
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified")
    .$defaultFn(() => false)
    .notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt")
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp("updatedAt")
    .$defaultFn(() => new Date())
    .notNull(),
})

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
})

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
})

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").$defaultFn(() => new Date()),
  updatedAt: timestamp("updatedAt").$defaultFn(() => new Date()),
})

// App tables (using snake_case for Electric sync compatibility)

// GitHub repos table - stores repos that users have viewed/tracked
export const github_repos = pgTable("github_repos", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  owner: varchar("owner", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  full_name: varchar("full_name", { length: 512 }).notNull().unique(),
  description: text("description"),
  default_branch: varchar("default_branch", { length: 255 }).default("main"),
  language: varchar("language", { length: 100 }),
  stargazers_count: integer("stargazers_count").default(0),
  forks_count: integer("forks_count").default(0),
  avatar_url: text("avatar_url"),
  html_url: text("html_url"),
  last_synced_at: timestamp("last_synced_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// GitHub releases table - stores releases for tracked repos
export const github_releases = pgTable("github_releases", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  repo_id: integer("repo_id")
    .notNull()
    .references(() => github_repos.id, { onDelete: "cascade" }),
  tag_name: varchar("tag_name", { length: 255 }).notNull(),
  name: varchar("name", { length: 512 }),
  body: text("body"), // Release notes/description
  html_url: text("html_url"),
  published_at: timestamp("published_at", { withTimezone: true }),
  is_prerelease: boolean("is_prerelease").default(false),
  is_draft: boolean("is_draft").default(false),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Changelogs between releases - our custom analysis
export const release_changelogs = pgTable("release_changelogs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  repo_id: integer("repo_id")
    .notNull()
    .references(() => github_repos.id, { onDelete: "cascade" }),
  from_release_id: integer("from_release_id").references(
    () => github_releases.id,
    { onDelete: "set null" },
  ),
  to_release_id: integer("to_release_id")
    .notNull()
    .references(() => github_releases.id, { onDelete: "cascade" }),
  from_tag: varchar("from_tag", { length: 255 }), // null means from beginning
  to_tag: varchar("to_tag", { length: 255 }).notNull(),
  summary: text("summary"), // AI-generated or manual summary
  breaking_changes: text("breaking_changes"), // List of breaking changes
  new_features: text("new_features"), // List of new features
  bug_fixes: text("bug_fixes"), // List of bug fixes
  commits_count: integer("commits_count").default(0),
  files_changed: integer("files_changed").default(0),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  generated_at: timestamp("generated_at", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const chat_threads = pgTable("chat_threads", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  user_id: text("user_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const chat_messages = pgTable("chat_messages", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  thread_id: integer("thread_id")
    .notNull()
    .references(() => chat_threads.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 32 }).notNull(),
  content: text("content").notNull(),
  created_at: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const selectUsersSchema = createSelectSchema(users)
export const selectChatThreadSchema = createSelectSchema(chat_threads)
export const selectChatMessageSchema = createSelectSchema(chat_messages)
export const selectGithubRepoSchema = createSelectSchema(github_repos)
export const selectGithubReleaseSchema = createSelectSchema(github_releases)
export const selectReleaseChangelogSchema = createSelectSchema(release_changelogs)

export type User = z.infer<typeof selectUsersSchema>
export type ChatThread = z.infer<typeof selectChatThreadSchema>
export type ChatMessage = z.infer<typeof selectChatMessageSchema>
export type GithubRepo = z.infer<typeof selectGithubRepoSchema>
export type GithubRelease = z.infer<typeof selectGithubReleaseSchema>
export type ReleaseChangelog = z.infer<typeof selectReleaseChangelogSchema>
