// BunSqliteDatabaseAdapter/schema/index.ts
export const DATABASE_SCHEMA = `
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL
    );

  CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        name TEXT,
        username TEXT,
        email TEXT,
        avatarUrl TEXT,
        details TEXT,
        createdAt TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    roomId TEXT NOT NULL,
    userId TEXT,
    content TEXT,
    embedding TEXT,
    type TEXT NOT NULL DEFAULT 'default',
    agentId TEXT,
    createdAt INTEGER,
    FOREIGN KEY (roomId) REFERENCES rooms(id),
    FOREIGN KEY (userId) REFERENCES accounts(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    roomId TEXT NOT NULL,
    userId TEXT,
    content TEXT,
    embedding TEXT,
    type TEXT NOT NULL DEFAULT 'message',
    createdAt INTEGER,
    FOREIGN KEY (roomId) REFERENCES rooms(id),
    FOREIGN KEY (userId) REFERENCES accounts(id)
);

    CREATE TABLE IF NOT EXISTS goals (
        id TEXT PRIMARY KEY,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        userId TEXT,
        name TEXT,
        status TEXT,
        description TEXT,
        roomId TEXT,
        objectives TEXT DEFAULT '[]' NOT NULL,
        FOREIGN KEY (userId) REFERENCES accounts(id),
        FOREIGN KEY (roomId) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        userId TEXT NOT NULL,
        body TEXT NOT NULL,
        type TEXT NOT NULL,
        roomId TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES accounts(id),
        FOREIGN KEY (roomId) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS participants (
        id TEXT PRIMARY KEY,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        userId TEXT,
        roomId TEXT,
        userState TEXT,
        last_message_read TEXT,
        FOREIGN KEY (userId) REFERENCES accounts(id),
        FOREIGN KEY (roomId) REFERENCES rooms(id)
    );

    CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        userId TEXT NOT NULL,
        targetId TEXT NOT NULL,
        status TEXT,
        FOREIGN KEY (userId) REFERENCES accounts(id),
        FOREIGN KEY (targetId) REFERENCES accounts(id)
    );

    CREATE TABLE IF NOT EXISTS cache (
        key TEXT NOT NULL,
        agentId TEXT NOT NULL,
        value TEXT DEFAULT '{}',
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        expiresAt TEXT,
        PRIMARY KEY (key, agentId)
    );
    CREATE INDEX IF NOT EXISTS idx_rooms_id ON rooms(id);
    CREATE INDEX IF NOT EXISTS idx_memories_roomId ON memories(roomId);
    CREATE INDEX IF NOT EXISTS idx_memories_userId ON memories(userId);
`;
