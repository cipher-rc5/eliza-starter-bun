// BunSqliteDatabaseAdapter/repositories/account_repository.ts
import { Database } from 'bun:sqlite';
import { type Account, type UUID } from '../types';

export class AccountRepository {
  constructor (private db: Database) {}

  async getById(userId: UUID): Promise<Account | null> {
    const account = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(userId) as Account | null;

    if (!account) return null;
    account.details = JSON.parse(account.details as unknown as string);
    return account;
  }

  async create(account: Account): Promise<boolean> {
    try {
      const stmt = this.db.prepare(`
            INSERT INTO accounts (
                id, 
                name, 
                username, 
                email, 
                avatarUrl, 
                details, 
                createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

      stmt.run(
        account.id,
        account.name,
        account.username,
        account.email,
        account.avatarUrl,
        JSON.stringify(account.details),
        account.createdAt?.toString() || new Date().toISOString()
      );
      return true;
    } catch (error) {
      console.error('Error creating account:', error);
      return false;
    }
  }
}
