# eliza-starter-bun

Summary: Bun Package Manager and Runtime variant of AI16Z Eliza-Starter [link](https://github.com/elizaOS/eliza-starter), unit intended to reduce the need for installation of external dependencies, include native [build](https://bun.sh/docs/bundler), and improve deployment user-experience

> Start basic, work backwards

> 🚨 NOTE: this version is using packages from ELIZA version: v0.1.4-alpha.3 as latest include runtime changes which I have not yet reviewed

## 🚀 Quick Start Guide

### Prerequisites

Before you begin, ensure you have:

- A Unix-like environment (Linux, macOS, or WSL2 on Windows)
- Basic familiarity with terminal/command line
- Text editor of your choice (VS Code recommended)

### Installation Steps

1. First, install the Bun runtime. Bun is a fast all-in-one JavaScript runtime and toolkit:

```sh
curl -fsSL https://bun.sh/install | bash
```

2. Verify your Bun installation:

```sh
bun --version
```

3. Clone this repository and navigate to it:

```sh
git clone https://github.com/cipher-rc5/eliza-starter-bun.git
cd eliza-starter-bun
```

4. Install project dependencies:

```sh
bun install
```

5. Set up your environment configuration:

```sh
cp .env.example .env
```

### Starting the Service

Choose one of these commands based on your needs:

```sh
bun run start        # Basic start - runs the main service
bun run start:all    # Starts all available services
bun run start:dev    # Development mode with hot reload (recommended for development)
```

## 🎮 Configuration Guide

### Character Configuration

Your AI agent's personality and behavior can be customized in two ways:

1. **Direct Configuration**:
   - Edit `src/character.ts` to modify the default character
   - This is recommended for single-character deployments

2. **Custom Character Files**:
   - Create JSON files in the `characters` directory
   - Load them using the --characters flag:
   ```sh
   bun run start --characters="characters/mycustom.character.json"
   ```
   - Load multiple characters:
   ```sh
   bun run start --characters="characters/char1.json,characters/char2.json"
   ```

### Platform Integration

#### Available Platforms

Liza supports multiple platforms that your AI agent can interact with:

- Discord
- Twitter
- Direct interface
- More platforms coming soon!

Enable platforms in your character configuration:

```typescript
{
  "name": "MyAgent",
  "clients": ["twitter", "discord"],  // Add or remove platforms as needed
  "personality": "Helpful and friendly"
}
```

### Environment Configuration

Your `.env` file needs different variables depending on which platforms you're using. Here's what you need for each:

#### Discord Setup

```env
# Required for Discord integration
DISCORD_APPLICATION_ID="Your_Discord_Application_ID"  # From Discord Developer Portal
DISCORD_API_TOKEN="Your_Discord_Bot_Token"           # Your bot's token
```

#### Twitter Setup

```env
# Required for Twitter integration
TWITTER_USERNAME="your_twitter_username"  # Your Twitter handle
TWITTER_PASSWORD="your_password"          # Account password
TWITTER_EMAIL="your@email.com"            # Associated email
```

#### AI Integration

```env
# Required for AI functionality
OPENROUTER_API_KEY="sk-xx-xx-xxx"  # Your OpenRouter API key
```

## 🛠 Development Guide

### Available Commands

```sh
bun run type-check  # Run TypeScript validation
bun run build      # Build for production
```

### Project Structure

```
liza/
├── src/
│   ├── character.ts     # Main character configuration
│   ├── index.ts         # Entry point
│   └── services/        # Platform-specific services
├── characters/          # Custom character JSON files
├── .env                 # Environment configuration
└── package.json         # Project dependencies
```

### Technical Details

This project uses:

- ESM modules with TypeScript support
- Bundler-style module resolution
- Strict type checking
- Path aliases for clean imports
- Bun runtime (version >=1.0.0 required)
- Formatting via Dprint [website](https://dprint.dev/) [github](https://github.com/dprint/dprint)

## 📚 Additional Resources

- [Bun Documentation](https://bun.sh/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Discord Developer Portal](https://discord.com/developers/docs)
- [Twitter API Documentation](https://developer.twitter.com/en/docs)

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Submit a Pull Request

## 🐛 Troubleshooting

Common issues and solutions:

1. **Bun installation fails**:
   - Ensure you're on a supported OS
   - Try running the curl command with sudo

2. **Dependencies won't install**:
   - Clear Bun's cache: `bun pm cache rm` [documentation reference available here](https://bun.sh/docs/cli/pm)
   - Try removing node_modules `rm -rf node_modules` and reinstalling `bun install`

3. **Environment variables not working**:
   - Ensure `.env` file is in the root directory
   - Check for typos in variable names
   - Make sure values are properly quoted

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

Need help?

- Open an issue on GitHub
