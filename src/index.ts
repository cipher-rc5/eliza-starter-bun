import { type DirectClient, DirectClientInterface } from '@ai16z/client-direct';
import { TwitterClientInterface } from '@ai16z/client-twitter';
import { AgentRuntime, CacheManager, Character, defaultCharacter, elizaLogger, IAgentRuntime, ICacheManager, IDatabaseAdapter, ModelProviderName, settings, stringToUuid, validateCharacterConfig } from '@ai16z/eliza';
// import { solanaPlugin } from '@ai16z/plugin-solana';
import { FarcasterAgentClient } from '@elizaos/client-farcaster';
import { dirname, join, resolve } from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { BunSqliteDatabase } from '../BunSqliteDatabaseAdapter/bunSqliteDatabase';
import { character } from './character';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new BunSqliteDatabase();
await db.init();
console.log('Database initialized successfully');

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

function initializeDatabase(dataDir: string): BunSqliteDatabase {
  const filePath = process.env.SQLITE_FILE ?? resolve(dataDir, 'db.sqlite');
  return new BunSqliteDatabase(filePath);
}

export function parseArguments() {
  const args = process.argv.slice(2);
  const result: { character?: string, characters?: string } = {};

  for (let i = 0;i < args.length;i++) {
    if (args[i] === '--character') {
      result.character = args[i + 1];
      i++;
    } else if (args[i] === '--characters') {
      result.characters = args[i + 1];
      i++;
    }
  }

  return result;
}

async function tryLoadFile(filePath: string): Promise<string | null> {
  try {
    const file = Bun.file(filePath);
    if (await file.exists()) {
      return file.text();
    }
    return null;
  } catch (e) {
    return null;
  }
}

function isAllStrings(arr: unknown[]): boolean {
  return Array.isArray(arr) && arr.every((item) => typeof item === 'string');
}

export async function loadCharacters(charactersArg: string): Promise<Character[]> {
  let characterPaths = charactersArg?.split(',').map((filePath) => filePath.trim());
  const loadedCharacters = [];

  if (characterPaths?.length > 0) {
    for (const characterPath of characterPaths) {
      let content = null;
      let resolvedPath = '';

      // Get the base filename from the path
      const getBasename = (path: string) => path.split('/').pop() || path;

      const pathsToTry = [
        characterPath,
        `${process.cwd()}/${characterPath}`,
        `${process.cwd()}/agent/${characterPath}`,
        `${__dirname}/${characterPath}`,
        `${__dirname}/characters/${getBasename(characterPath)}`,
        `${__dirname}/../characters/${getBasename(characterPath)}`,
        `${__dirname}/../../characters/${getBasename(characterPath)}`
      ];

      elizaLogger.info('Trying paths:', pathsToTry.map((p) => ({ path: p, exists: Bun.file(p).exists() })));

      for (const tryPath of pathsToTry) {
        content = await tryLoadFile(tryPath);
        if (content !== null) {
          resolvedPath = tryPath;
          break;
        }
      }

      if (content === null) {
        elizaLogger.error(`Error loading character from ${characterPath}: File not found in any of the expected locations`);
        elizaLogger.error('Tried the following paths:');
        pathsToTry.forEach((p) => elizaLogger.error(` - ${p}`));
        process.exit(1);
      }

      try {
        const character = JSON.parse(content);
        validateCharacterConfig(character);

        const characterId = character.id || character.name;
        const characterPrefix = `CHARACTER.${characterId.toUpperCase().replace(/ /g, '_')}.`;

        const characterSettings = Object.entries(Bun.env).filter(([key]) => key.startsWith(characterPrefix)).reduce((settings, [key, value]) => {
          const settingKey = key.slice(characterPrefix.length);
          return { ...settings, [settingKey]: value };
        }, {});

        if (Object.keys(characterSettings).length > 0) {
          character.settings = character.settings || {};
          character.settings.secrets = { ...characterSettings, ...character.settings.secrets };
        }

        if (isAllStrings(character.plugins)) {
          elizaLogger.info('Plugins are: ', character.plugins);
          const importedPlugins = await Promise.all(character.plugins.map(async (plugin: string) => {
            const importedPlugin = await import(plugin);
            return importedPlugin.default;
          }));
          character.plugins = importedPlugins;
        }

        loadedCharacters.push(character);
        elizaLogger.info(`Successfully loaded character from: ${resolvedPath}`);
      } catch (e) {
        elizaLogger.error(`Error parsing character from ${resolvedPath}: ${e}`);
        process.exit(1);
      }
    }
  }

  if (loadedCharacters.length === 0) {
    elizaLogger.info('No characters found, using default character');
    loadedCharacters.push(defaultCharacter);
  }

  return loadedCharacters;
}

export function getTokenForProvider(provider: ModelProviderName, character: Character) {
  switch (provider) {
    case ModelProviderName.OPENAI:
      return character.settings?.secrets?.OPENAI_API_KEY || settings.OPENAI_API_KEY;
    case ModelProviderName.LLAMACLOUD:
      return (character.settings?.secrets?.LLAMACLOUD_API_KEY ||
        settings.LLAMACLOUD_API_KEY ||
        character.settings?.secrets?.TOGETHER_API_KEY ||
        settings.TOGETHER_API_KEY ||
        character.settings?.secrets?.XAI_API_KEY ||
        settings.XAI_API_KEY ||
        character.settings?.secrets?.OPENAI_API_KEY ||
        settings.OPENAI_API_KEY);
    case ModelProviderName.ANTHROPIC:
      return character.settings?.secrets?.ANTHROPIC_API_KEY || character.settings?.secrets?.CLAUDE_API_KEY || settings.ANTHROPIC_API_KEY || settings.CLAUDE_API_KEY;
    case ModelProviderName.REDPILL:
      return character.settings?.secrets?.REDPILL_API_KEY || settings.REDPILL_API_KEY;
    case ModelProviderName.OPENROUTER:
      return character.settings?.secrets?.OPENROUTER || settings.OPENROUTER_API_KEY;
    case ModelProviderName.GROK:
      return character.settings?.secrets?.GROK_API_KEY || settings.GROK_API_KEY;
    case ModelProviderName.HEURIST:
      return character.settings?.secrets?.HEURIST_API_KEY || settings.HEURIST_API_KEY;
    case ModelProviderName.GROQ:
      return character.settings?.secrets?.GROQ_API_KEY || settings.GROQ_API_KEY;
  }
}

export async function initializeClients(character: Character, runtime: IAgentRuntime) {
  const clients: { [key: string]: any } = {};
  const clientTypes = character.clients?.map((str) => str.toLowerCase()) || [];

  if (clientTypes.includes('twitter')) {
    const twitterClients = await TwitterClientInterface.start(runtime);
    clients.push(twitterClients);
  }

  if (clientTypes.includes('farcaster')) {
    const runtimeAdapter = { ...runtime, imageModelProvider: null, documentsManager: null, knowledgeManager: null, clients: [] };
    const farcasterClient = new FarcasterAgentClient(runtimeAdapter as any);
    if (farcasterClient) {
      farcasterClient.start();
      clients.farcaster = farcasterClient;
    }
  }

  if (character.plugins?.length > 0) {
    for (const plugin of character.plugins) {
      if (plugin.clients) {
        for (const client of plugin.clients) {
          clients.push(await client.start(runtime));
        }
      }
    }
  }

  return clients;
}

export function createAgent(character: Character, db: BunSqliteDatabase, cache: ICacheManager, token: string) {
  elizaLogger.success(elizaLogger.successesTitle, 'Creating runtime for character', character.name);
  return new AgentRuntime({
    databaseAdapter: db as unknown as IDatabaseAdapter,
    token,
    modelProvider: character.modelProvider,
    evaluators: [],
    character,
    // plugins: character.settings?.secrets?.WALLET_PUBLIC_KEY ? [solanaPlugin] : [], //suspending until reviewing changes to latest package deps
    plugins: [],
    providers: [],
    actions: [],
    services: [],
    managers: [],
    cacheManager: cache
  });
}

function intializeDbCache(character: Character, db: BunSqliteDatabase) {
  if (!character.id) {
    throw new Error('Character ID is required');
  }
  return new CacheManager(db);
}

async function startAgent(character: Character, directClient: DirectClient) {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    if (!token) {
      throw new Error(`No API token found for provider ${character.modelProvider}`);
    }

    const dataDir = join(__dirname, '../data');

    try {
      await Bun.write(dataDir + '/.keep', '');
    } catch (err) {
      console.error('Error creating data directory:', err);
    }

    const db = initializeDatabase(dataDir);
    await db.init();

    const cache = intializeDbCache(character, db);
    const runtime = createAgent(character, db, cache, token);

    await runtime.initialize();
    const clients = await initializeClients(character, runtime);
    directClient.registerAgent(runtime);

    return clients;
  } catch (error) {
    elizaLogger.error(`Error starting agent for character ${character.name}:`, error);
    console.error(error);
    throw error;
  }
}

const startAgents = async () => {
  const directClient = await DirectClientInterface.start();
  const args = parseArguments();

  let charactersArg = args.characters || args.character;

  let characters = [character];
  console.log('charactersArg', charactersArg);
  if (charactersArg) {
    characters = await loadCharacters(charactersArg);
  }
  console.log('characters', characters);
  try {
    for (const character of characters) {
      await startAgent(character, directClient as DirectClient);
    }
  } catch (error) {
    elizaLogger.error('Error starting agents:', error);
  }

  function chat() {
    const agentId = characters[0].name ?? 'Agent';
    rl.question('You: ', async (input) => {
      await handleUserInput(input, agentId);
      if (input.toLowerCase() !== 'exit') {
        chat();
      }
    });
  }

  elizaLogger.log("Chat started. Type 'exit' to quit.");
  chat();
};

startAgents().catch((error) => {
  elizaLogger.error('Unhandled error in startAgents:', error);
  process.exit(1);
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.on('SIGINT', () => {
  rl.close();
  process.exit(0);
});

async function handleUserInput(input: string, agentId: string) {
  if (input.toLowerCase() === 'exit') {
    rl.close();
    process.exit(0);
  }

  try {
    const serverPort = parseInt(settings.SERVER_PORT || '3000');
    const userId = '9229f9f2-b61a-0cec-a3ab-220661fc7e27'; // Use consistent ID
    const roomId = 'd088caa1-9e40-0c4d-9754-5fa1c057a9a1'; // Use consistent ID

    // Initialize database
    const db = new BunSqliteDatabase();
    await db.init();

    // Ensure room exists
    await db.createRoom({ id: roomId, created_at: new Date() });

    // Create account if needed
    const accountCreated = await db.createAccount({ id: userId, name: 'User', username: 'user', email: 'user@example.com', avatarUrl: '', details: {}, createdAt: Date.now() });

    // Add participant
    try {
      await db.addParticipant({ id: `participant-${userId}`, userId: userId, roomId: roomId, createdAt: new Date() });
    } catch (error) {
      // Ignore participant already exists error for now, will address in updates
    }

    // Make API request
    const response = await fetch(`http://localhost:${serverPort}/${agentId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, userId: userId, userName: 'User', roomId: roomId })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (!data) {
      throw new Error('No data received from server');
    }

    if (Array.isArray(data)) {
      data.forEach((message: { text: any }) => {
        console.log(`${agentId}: ${message.text}`);
      });
    } else {
      console.log(`${agentId}: ${data.text}`);
    }
  } catch (error) {
    console.error('Error in handleUserInput:', error);
  }
}
