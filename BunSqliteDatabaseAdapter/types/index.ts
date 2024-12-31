// BunSqliteDatabaseAdapter/types/index.ts - simple
export type UUID = string;

export interface Account {
  id: UUID;
  name: string;
  username: string;
  email: string;
  avatarUrl: string;
  details: Record<string, unknown>;
  createdAt?: number;
}

export interface Actor {
  id: UUID;
  name: string;
  username: string;
  details: Record<string, unknown>;
}

export interface Memory {
  id: UUID;
  type: string;
  content: unknown;
  embedding?: number[];
  userId?: UUID;
  roomId: UUID;
  agentId: UUID;
  createdAt?: number;
}

export interface Goal {
  description: null;
  id: UUID;
  roomId: UUID;
  userId?: UUID;
  name: string;
  status: GoalStatus;
  objectives: unknown[];
  createdAt?: number;
}

export interface Relationship {
  id: UUID;
  userA: UUID;
  userB: UUID;
  status?: string;
  userId: UUID;
  createdAt?: number;
}

export interface Participant {
  id: string;
  userId: string;
  roomId: string;
  createdAt?: Date;
  userState?: string;
  last_message_read?: string;
  userName?: string;
}

export interface Room {
  id: string;
  createdAt: Date;
}

export interface Log {
  id: string;
  createdAt: Date;
  userId: string;
  body: string;
  type: string;
  roomId: string;
}

export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export type Media = { id: string, url: string, title: string, source: string, description: string, text: string };

export interface IDatabaseAdapter {
  db: any;
  init?(): Promise<void>;
  getAccountById(userId: UUID): Promise<Account | null>;
  createAccount(account: Account): Promise<boolean>;
  getMemories(params: { roomId: UUID, count?: number, unique?: boolean, tableName: string, agentId?: UUID, start?: number, end?: number }): Promise<Memory[]>;
  getMemoryById(id: UUID): Promise<Memory | null>;
  getMemoriesByRoomIds(params: { agentId?: UUID, roomIds: UUID[] }): Promise<Memory[]>;
  getCachedEmbeddings(
    params: { query_table_name: string, query_threshold: number, query_input: string, query_field_name: string, query_field_sub_name: string, query_match_count: number }
  ): Promise<{ embedding: number[], levenshtein_score: number }[]>;
  log(params: { body: { [key: string]: unknown }, userId: UUID, roomId: UUID, type: string }): Promise<void>;
  getActorDetails(params: { roomId: UUID }): Promise<Actor[]>;
  searchMemories(params: { tableName: string, roomId: UUID, embedding: number[], match_threshold: number, match_count: number, unique: boolean }): Promise<Memory[]>;
  updateGoalStatus(params: { goalId: UUID, status: GoalStatus }): Promise<void>;
  searchMemoriesByEmbedding(
    embedding: number[],
    params: { match_threshold?: number, count?: number, roomId?: UUID, agentId?: UUID, unique?: boolean, tableName: string }
  ): Promise<Memory[]>;
  createMemory(memory: Memory, tableName: string, unique?: boolean): Promise<void>;
  removeMemory(memoryId: UUID, tableName: string): Promise<void>;
  removeAllMemories(roomId: UUID, tableName: string): Promise<void>;
  countMemories(roomId: UUID, unique?: boolean, tableName?: string): Promise<number>;
  getGoals(params: { roomId: UUID, userId?: UUID | null, onlyInProgress?: boolean, count?: number }): Promise<Goal[]>;
  updateGoal(goal: Goal): Promise<void>;
  createGoal(goal: Goal): Promise<void>;
  removeGoal(goalId: UUID): Promise<void>;
  removeAllGoals(roomId: UUID): Promise<void>;
  getRoom(roomId: UUID): Promise<UUID | null>;
  createRoom(roomId?: UUID): Promise<UUID>;
  removeRoom(roomId: UUID): Promise<void>;
  getRoomsForParticipant(userId: UUID): Promise<UUID[]>;
  getRoomsForParticipants(userIds: UUID[]): Promise<UUID[]>;
  addParticipant(userId: UUID, roomId: UUID): Promise<boolean>;
  removeParticipant(userId: UUID, roomId: UUID): Promise<boolean>;
  getParticipantsForAccount(userId: UUID): Promise<Participant[]>;
  getParticipantsForRoom(roomId: UUID): Promise<UUID[]>;
  getParticipantUserState(roomId: UUID, userId: UUID): Promise<'FOLLOWED' | 'MUTED' | null>;
  setParticipantUserState(roomId: UUID, userId: UUID, state: 'FOLLOWED' | 'MUTED' | null): Promise<void>;
  createRelationship(params: { userA: UUID, userB: UUID }): Promise<boolean>;
  getRelationship(params: { userA: UUID, userB: UUID }): Promise<Relationship | null>;
  getRelationships(params: { userId: UUID }): Promise<Relationship[]>;
}
export interface IDatabaseCacheAdapter {
  getCache(params: { agentId: UUID, key: string }): Promise<string | undefined>;
  setCache(params: { agentId: UUID, key: string, value: string }): Promise<boolean>;
  deleteCache(params: { agentId: UUID, key: string }): Promise<boolean>;
}
