// BunSqliteDatabaseAdapter/repositories/memory_repository.ts
import { Database } from "bun:sqlite";
import { Memory, UUID } from "../types";
import { v4 } from "uuid";

export class MemoryRepository {
    constructor(private db: Database) {}

    async createMemory(memory: Memory, tableName: string): Promise<void> {
        let isUnique = true;
    
        if (memory.embedding) {
            const similarMemories = await this.searchMemoriesByEmbedding(memory.embedding, {
                tableName,
                agentId: memory.agentId,
                roomId: memory.roomId,
                match_threshold: 0.95,
                count: 1,
            });
            isUnique = similarMemories.length === 0;
        }
    
        try {
            const stmt = this.db.prepare(
                "INSERT OR REPLACE INTO memories (id, type, content, embedding, userId, roomId, agentId, `unique`, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            
            const params = [
                memory.id ?? v4(),
                tableName,
                JSON.stringify(memory.content),
                memory.embedding ? Buffer.from(new Float32Array(memory.embedding).buffer) : null,
                memory.userId || '', 
                memory.roomId,
                memory.agentId,
                isUnique ? 1 : 0,
                memory.createdAt ?? Date.now()
            ] satisfies [string, string, string, Buffer | null, string, string, string, number, number];
    
            await stmt.run(...params);
        } catch (error) {
            throw new Error(`Failed to create memory: ${error}`);
        }
    }

    async getMemories(params: {
        roomId: UUID;
        count?: number;
        unique?: boolean;
        tableName: string;
        agentId: UUID;
        start?: number;
        end?: number;
    }): Promise<Memory[]> {
        if (!params.tableName || !params.roomId) {
            throw new Error("tableName and roomId are required");
        }

        let sql = `SELECT * FROM memories WHERE type = ? AND agentId = ? AND roomId = ?`;
        const queryParams: any[] = [params.tableName, params.agentId, params.roomId];

        if (params.unique) {
            sql += " AND `unique` = 1";
        }

        if (params.start) {
            sql += ` AND createdAt >= ?`;
            queryParams.push(params.start);
        }

        if (params.end) {
            sql += ` AND createdAt <= ?`;
            queryParams.push(params.end);
        }

        sql += " ORDER BY createdAt DESC";

        if (params.count) {
            sql += " LIMIT ?";
            queryParams.push(params.count);
        }

        const memories = this.db.prepare(sql).all(...queryParams) as Memory[];

        return memories.map(memory => ({
            ...memory,
            createdAt: typeof memory.createdAt === "string" ? Date.parse(memory.createdAt) : memory.createdAt,
            content: JSON.parse(memory.content as unknown as string)
        }));
    }

    // Vector similarity search
    async searchMemoriesByEmbedding(
        embedding: number[],
        params: {
            match_threshold?: number;
            count?: number;
            roomId?: UUID;
            agentId: UUID;
            unique?: boolean;
            tableName: string;
        }
    ): Promise<Memory[]> {
        const queryParams = [
            new Float32Array(embedding),
            params.tableName,
            params.agentId
        ];

        let sql = `
        SELECT *, length(embedding) AS similarity
        FROM memories
        WHERE embedding IS NOT NULL 
        AND type = ? 
        AND agentId = ?`;

        if (params.unique) {
            sql += " AND `unique` = 1";
        }

        if (params.roomId) {
            sql += " AND roomId = ?";
            queryParams.push(params.roomId);
        }

        sql += ` ORDER BY similarity DESC`;

        if (params.count) {
            sql += " LIMIT ?";
            queryParams.push(params.count.toString());
        }

        const memories = this.db.prepare(sql).all(...queryParams) as (Memory & { similarity: number })[];
        
        return memories.map(memory => ({
            ...memory,
            createdAt: typeof memory.createdAt === "string" ? Date.parse(memory.createdAt) : memory.createdAt,
            content: JSON.parse(memory.content as unknown as string)
        }));
    }
}