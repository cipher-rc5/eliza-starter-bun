// BunSqliteDatabaseAdapter/bunSqliteDatabase.ts
import { Database } from 'bun:sqlite';
import { v4 as uuidv4 } from 'uuid';
import { AccountRepository } from './repositories/account_repository';
import { MemoryRepository } from './repositories/memory_repository';
import { DATABASE_SCHEMA } from './schema';
import { type Account, type Goal, type GoalStatus, type Memory, type Participant, type UUID } from './types';

export class BunSqliteDatabase {
  db: Database;
  public accounts: AccountRepository;
  public memories: MemoryRepository;

  constructor (dbPath?: string) {
    this.db = new Database(dbPath || ':memory:');
    this.accounts = new AccountRepository(this.db);
    this.memories = new MemoryRepository(this.db);
  }

  async init(): Promise<void> {
    try {
      // Execute schema
      this.db.exec(DATABASE_SCHEMA);

      // Verify tables
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];

      const expectedTables = ['rooms', 'accounts', 'memories', 'goals', 'logs', 'participants', 'relationships', 'cache'];

      const missingTables = expectedTables.filter(table => !tables.some(t => t.name === table));

      if (missingTables.length > 0) {
        throw new Error(`Missing tables: ${missingTables.join(', ')}`);
      }

      console.log('Database initialized successfully with all required tables');
    } catch (error) {
      console.error('Database initialization failed:', error);
      throw error;
    }
  }

  // ICacheAdapter implementation
  async get(key: string): Promise<string | undefined> {
    return this.getCache({ key, agentId: '' });
  }

  async set(key: string, value: string): Promise<void> {
    await this.setCache({ key, agentId: '', value });
  }

  async delete(key: string): Promise<void> {
    await this.deleteCache({ key, agentId: '' });
  }

  // IDatabaseCacheAdapter implementation
  async getCache(params: { key: string, agentId: string }): Promise<string | undefined> {
    const cached = this.db.prepare('SELECT value FROM cache WHERE key = ? AND agentId = ?').get(params.key, params.agentId) as { value: string } | undefined;

    return cached?.value;
  }

  async setCache(params: { key: string, agentId: string, value: string }): Promise<boolean> {
    try {
      this.db.prepare('INSERT OR REPLACE INTO cache (key, agentId, value) VALUES (?, ?, ?)').run(params.key, params.agentId, params.value);
      return true;
    } catch (error) {
      console.error('Error setting cache', error);
      return false;
    }
  }

  async deleteCache(params: { key: string, agentId: string }): Promise<boolean> {
    try {
      this.db.prepare('DELETE FROM cache WHERE key = ? AND agentId = ?').run(params.key, params.agentId);
      return true;
    } catch (error) {
      console.error('Error deleting cache', error);
      return false;
    }
  }

  async getAccountById(userId: UUID): Promise<Account | null> {
    return this.accounts.getById(userId);
  }

  async createAccount(account: Account): Promise<boolean> {
    return this.accounts.create(account);
  }

  async getParticipantsForAccount(userId: string): Promise<Participant[]> {
    const participants = this.db.prepare(`
        SELECT p.*, r.id as roomId, r.createdAt as roomCreatedAt 
        FROM participants p
        JOIN rooms r ON p.roomId = r.id
        WHERE p.userId = ?
    `).all(userId) as Participant[];
    return participants;
  }

  async createRoom(room: { id: string, created_at?: Date }): Promise<void> {
    try {
      const result = this.db.prepare(`
            INSERT OR IGNORE INTO rooms (id, createdAt) 
            VALUES (?, ?)
        `).run(room.id, (room.created_at || new Date()).toISOString());

      if (result.changes > 0) {
        console.log(`Room ${room.id} created successfully`);
      } else {
        console.log(`Room ${room.id} already exists`);
      }
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  async getRoom(roomId: string): Promise<any> {
    try {
      const room = this.db.prepare('SELECT * FROM rooms WHERE id = ?').run(roomId);

      if (room?.changes > 0) {
        console.log(`Found room: ${roomId}`);
        return room;
      }
      return null;
    } catch (error) {
      console.error('Error getting room:', error);
      return null;
    }
  }

  async addParticipant(participant: Participant): Promise<void> {
    try {
      const now = new Date().toISOString();
      this.db.prepare(`
            INSERT OR IGNORE INTO participants (
                id, 
                roomId, 
                userId, 
                createdAt,
                userState,
                last_message_read
            ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
        participant.id,
        participant.roomId,
        participant.userId,
        participant.createdAt?.toISOString() || now,
        participant.userState || null,
        participant.last_message_read || null
      );
    } catch (error) {
      console.error('Error adding participant:', error);
      throw error;
    }
  }

  async log(params: { body: { [key: string]: unknown }, userId: string, roomId: string, type: string }): Promise<void> {
    const id = uuidv4();
    this.db.prepare(`
        INSERT INTO logs (id, userId, body, type, roomId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, params.userId, JSON.stringify(params.body), params.type, params.roomId, new Date().toISOString());
  }

  // When creating a memory
  async createMemory(memory: Memory, tableName: string): Promise<void> {
    try {
      // First verify the room exists
      const roomExists = await this.getRoom(memory.roomId);
      if (!roomExists) {
        // If room doesn't exist, create it
        await this.createRoom({ id: memory.roomId, created_at: new Date() });
        console.log(`Created new room ${memory.roomId} for memory`);
      }

      // Convert embedding to JSON string if exists
      const embeddingString = memory.embedding ? JSON.stringify(memory.embedding) : null;
      const type = memory.type || 'default';

      const stmt = this.db.prepare(`
            INSERT INTO memories (
                id, 
                roomId, 
                userId, 
                content, 
                embedding, 
                type, 
                agentId, 
                createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

      stmt.run(memory.id, memory.roomId, memory.userId || null, JSON.stringify(memory.content), embeddingString, type, memory.agentId, memory.createdAt || Date.now());
    } catch (error) {
      console.error('Memory creation failed:', { roomId: memory.roomId, userId: memory.userId, type: memory.type, error });
      throw error;
    }
  }

  async searchMemories(params: { tableName: string, roomId: UUID, embedding: number[], match_threshold: number, match_count: number, unique: boolean }): Promise<Memory[]> {
    try {
      // Use memories table instead of fragments
      const query = `
            SELECT * FROM memories
            WHERE roomId = ?
            ORDER BY createdAt DESC
            LIMIT ?
        `;

      const results = this.db.prepare(query).all(params.roomId, params.match_count) as Memory[];

      return results.map(memory => ({
        ...memory,
        content: typeof memory.content === 'string' ? JSON.parse(memory.content) : memory.content,
        embedding: memory.embedding ? JSON.parse(memory.embedding as unknown as string) : undefined
      }));
    } catch (error) {
      console.error('Error in searchMemories:', error);
      return [];
    }
  }

  // When retrieving memories, parse the embedding back to an array
  async getMemories(params: { roomId: UUID, count?: number, unique?: boolean, tableName: string, agentId: string, start?: number, end?: number }): Promise<Memory[]> {
    const memories = this.db.prepare(`
        SELECT * FROM memories 
        WHERE roomId = ? AND agentId = ?
        ORDER BY createdAt DESC
        LIMIT ?
    `).all(params.roomId, params.agentId, params.count || 100) as Memory[];

    return memories.map(memory => ({
      ...memory,
      content: JSON.parse(memory.content as string),
      embedding: memory.embedding ? JSON.parse(memory.embedding as unknown as string) : undefined
    }));
  }

  async searchMemoriesByEmbedding(
    embedding: number[],
    params: { match_threshold?: number, count?: number, roomId?: UUID, agentId: string, unique?: boolean, tableName: string }
  ): Promise<Memory[]> {
    return this.memories.searchMemoriesByEmbedding(embedding, params);
  }

  async getMemoryById(id: string): Promise<Memory | null> {
    const memory = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as Memory | undefined;
    return memory || null;
  }

  async getMemoriesByRoomIds(params: { agentId?: string, roomIds: string[] }): Promise<Memory[]> {
    const placeholders = params.roomIds.map(() => '?').join(',');
    const query = `
            SELECT * FROM memories 
            WHERE roomId IN (${placeholders})
            ${params.agentId ? 'AND agentId = ?' : ''}
        `;

    const parameters = [...params.roomIds];
    if (params.agentId) {
      parameters.push(params.agentId);
    }

    return this.db.prepare(query).all() as Memory[];
  }
  async getCachedEmbeddings(
    params: { query_table_name: string, query_threshold: number, query_input: string, query_field_name: string, query_field_sub_name: string, query_match_count: number }
  ): Promise<{ embedding: number[], levenshtein_score: number }[]> {
    try {
      // Validate if the table exists first
      const tableExists = this.db.prepare(`
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name=?
        `).get(params.query_table_name);

      if (!tableExists) {
        console.log(`Table ${params.query_table_name} not found, falling back to memories table`);
        params.query_table_name = 'memories'; // Fallback to memories table
      }

      const query = `
            SELECT 
                embedding, 
                length(${params.query_field_name}) as match_length
            FROM ${params.query_table_name}
            WHERE ${params.query_field_name} LIKE ?
                AND embedding IS NOT NULL
            LIMIT ?
        `;

      console.log('Executing query:', query);
      console.log('Parameters:', { searchTerm: `%${params.query_input}%`, matchCount: params.query_match_count });

      const results = this.db.prepare(query).all(`%${params.query_input}%`, params.query_match_count) as { embedding: string, match_length: number }[];

      return results.map(result => ({ embedding: result.embedding ? JSON.parse(result.embedding) : [], levenshtein_score: result.match_length })).filter(result =>
        Array.isArray(result.embedding)
      );
    } catch (error) {
      console.error('Error in getCachedEmbeddings:', { error, params });
      return [];
    }
  }

  async getRoomsForParticipants(participants: string[]): Promise<string[]> {
    try {
      // Create placeholders for the number of participants
      const placeholders = participants.map(() => '?').join(',');

      const query = `
            SELECT DISTINCT roomId 
            FROM participants 
            WHERE userId IN (${placeholders})
            GROUP BY roomId
            HAVING COUNT(DISTINCT userId) = ?
        `;

      // Add the number of participants as the last parameter
      const queryParams = [...participants, participants.length];

      const rooms = this.db.prepare(query).all(...queryParams) as { roomId: string }[];

      return rooms.map(room => room.roomId);
    } catch (error) {
      console.error('Error getting rooms for participants:', error);
      return [];
    }
  }

  async getGoals(params: { roomId: UUID, userId?: UUID | null, onlyInProgress?: boolean, count?: number }): Promise<Goal[]> {
    try {
      let sql = `
            SELECT * FROM goals 
            WHERE roomId = ?
        `;
      const queryParams: any[] = [params.roomId];

      if (params.userId) {
        sql += ` AND userId = ?`;
        queryParams.push(params.userId);
      }

      if (params.onlyInProgress) {
        sql += ` AND status = 'IN_PROGRESS'`;
      }

      sql += ` ORDER BY createdAt DESC`;

      if (params.count) {
        sql += ` LIMIT ?`;
        queryParams.push(params.count);
      }

      const goals = this.db.prepare(sql).all(...queryParams) as Goal[];

      return goals.map(goal => ({
        ...goal,
        objectives: JSON.parse(goal.objectives as unknown as string),
        createdAt: typeof goal.createdAt === 'string' ? Date.parse(goal.createdAt) : goal.createdAt
      }));
    } catch (error) {
      console.error('Error getting goals:', error);
      return [];
    }
  }

  async updateGoal(goal: Goal): Promise<void> {
    try {
      const stmt = this.db.prepare(`
            UPDATE goals 
            SET name = ?,
                status = ?,
                description = ?,
                objectives = ?
            WHERE id = ? AND roomId = ?
        `);

      stmt.run(goal.name, goal.status, goal.description || null, JSON.stringify(goal.objectives), goal.id, goal.roomId);
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    }
  }

  async createGoal(goal: Goal): Promise<void> {
    try {
      const stmt = this.db.prepare(`
            INSERT INTO goals (
                id, 
                roomId, 
                userId, 
                name, 
                status, 
                description, 
                objectives,
                createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

      stmt.run(
        goal.id,
        goal.roomId,
        goal.userId || null,
        goal.name,
        goal.status,
        goal.description || null,
        JSON.stringify(goal.objectives),
        goal.createdAt || new Date().toISOString()
      );
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    }
  }

  async removeGoal(goalId: UUID): Promise<void> {
    try {
      this.db.prepare('DELETE FROM goals WHERE id = ?').run(goalId);
    } catch (error) {
      console.error('Error removing goal:', error);
      throw error;
    }
  }

  async removeAllGoals(roomId: UUID): Promise<void> {
    try {
      this.db.prepare('DELETE FROM goals WHERE roomId = ?').run(roomId);
    } catch (error) {
      console.error('Error removing all goals:', error);
      throw error;
    }
  }

  async updateGoalStatus(params: { goalId: UUID, status: GoalStatus }): Promise<void> {
    try {
      this.db.prepare('UPDATE goals SET status = ? WHERE id = ?').run(params.status, params.goalId);
    } catch (error) {
      console.error('Error updating goal status:', error);
      throw error;
    }
  }

  async getParticipantsForRoom(roomId: string): Promise<Participant[]> {
    try {
      const participants = this.db.prepare(`
            SELECT p.*, u.name as userName
            FROM participants p
            LEFT JOIN accounts u ON p.userId = u.id
            WHERE p.roomId = ?
        `).all(roomId) as Participant[];

      return participants.map(p => ({ ...p, createdAt: new Date() }));
    } catch (error) {
      console.error('Error getting participants for room:', error);
      return [];
    }
  }

  async getRoomParticipant(roomId: string, userId: string): Promise<Participant | null> {
    try {
      const participant = this.db.prepare(`
            SELECT p.*, u.name as userName
            FROM participants p
            LEFT JOIN accounts u ON p.userId = u.id
            WHERE p.roomId = ? AND p.userId = ?
        `).get(roomId, userId) as Participant | undefined;

      if (!participant) return null;

      return { ...participant, createdAt: new Date() };
    } catch (error) {
      console.error('Error getting room participant:', error);
      return null;
    }
  }

  async removeParticipantFromRoom(roomId: string, userId: string): Promise<boolean> {
    try {
      this.db.prepare(`
            DELETE FROM participants
            WHERE roomId = ? AND userId = ?
        `).run(roomId, userId);
      return true;
    } catch (error) {
      console.error('Error removing participant from room:', error);
      return false;
    }
  }

  async updateParticipant(participant: Participant): Promise<boolean> {
    try {
      this.db.prepare(`
            UPDATE participants
            SET userState = ?,
                last_message_read = ?
            WHERE roomId = ? AND userId = ?
        `).run(participant.userState || null, participant.last_message_read || null, participant.roomId, participant.userId);
      return true;
    } catch (error) {
      console.error('Error updating participant:', error);
      return false;
    }
  }

  async testSchema(): Promise<void> {
    try {
      // Test creating a room
      const now = new Date();
      await this.createRoom({ id: 'test-room', created_at: now });

      // Test creating a participant
      await this.addParticipant({ id: 'test-participant', userId: 'test-user', roomId: 'test-room', createdAt: now });

      console.log('Schema test successful');
    } catch (error) {
      console.error('Schema test failed:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
