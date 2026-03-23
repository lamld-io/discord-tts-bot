/**
 * Discord Bot Client Setup
 * Khởi tạo client, đăng ký events và commands
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  ChatInputCommandInteraction,
  REST,
  Routes,
} from 'discord.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { TTSManager } from '../tts/manager.js';
import { VoiceConnectionManager } from '../voice/connection.js';
import { VoicePlayer } from '../voice/player.js';

// Import commands
import * as ttsCommand from './commands/tts.js';
import * as voiceChannelCommand from './commands/voice-channel.js';
import * as voiceCommand from './commands/voice.js';
import * as configCommand from './commands/config.js';
import * as setupCommand from './commands/setup.js';
import * as botAdminCommand from './commands/bot-admin.js';
import * as autottsCommand from './commands/autotts.js';
import { checkPermission } from './permissions.js';
import { setupAutoReader } from './auto-reader.js';

export class Bot {
  public client: Client;
  public ttsManager: TTSManager;
  public voiceManager: VoiceConnectionManager;
  public voicePlayer: VoicePlayer;

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.ttsManager = new TTSManager();
    this.voiceManager = new VoiceConnectionManager();
    this.voicePlayer = new VoicePlayer();

    this.setupEvents();

    // Setup auto-reader cho tự động đọc tin nhắn
    setupAutoReader(this.client, this.ttsManager, this.voiceManager, this.voicePlayer);
  }

  private setupEvents(): void {
    // Ready event
    this.client.once(Events.ClientReady, (readyClient) => {
      logger.info(`✅ Bot đã sẵn sàng: ${readyClient.user.tag}`);
      logger.info(`📡 Đang phục vụ ${readyClient.guilds.cache.size} server(s)`);
    });

    // Interaction (slash command) event
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      if (!interaction.guildId) {
        await interaction.reply({ content: '❌ Bot chỉ hoạt động trong server.', ephemeral: true });
        return;
      }

      try {
        // Kiểm tra quyền
        const permError = checkPermission(interaction);
        if (permError) {
          await interaction.reply({ content: permError, ephemeral: true });
          return;
        }

        await this.handleCommand(interaction);
      } catch (error) {
        logger.error('Command error:', error);
        const reply = {
          content: '❌ Đã xảy ra lỗi khi xử lý lệnh.',
          ephemeral: true,
        };

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(reply);
        } else {
          await interaction.reply(reply);
        }
      }
    });
  }

  private async handleCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const { commandName } = interaction;

    switch (commandName) {
      case 'tts':
        await ttsCommand.execute(interaction, this.ttsManager, this.voiceManager, this.voicePlayer);
        break;
      case 'join':
        await voiceChannelCommand.joinExecute(interaction, this.voiceManager);
        break;
      case 'leave':
        await voiceChannelCommand.leaveExecute(interaction, this.voiceManager, this.voicePlayer);
        break;
      case 'voice':
        await voiceCommand.execute(interaction, this.ttsManager);
        break;
      case 'config':
        await configCommand.execute(interaction);
        break;
      case 'setup':
        await setupCommand.execute(interaction);
        break;
      case 'bot':
        await botAdminCommand.execute(interaction, this.ttsManager, this.voiceManager, this.voicePlayer);
        break;
      case 'autotts':
        await autottsCommand.execute(interaction);
        break;
      default:
        await interaction.reply({ content: '❌ Lệnh không xác định.', ephemeral: true });
    }
  }

  /** Đăng ký slash commands lên Discord API */
  async registerCommands(): Promise<void> {
    const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);

    const commands = [
      ttsCommand.data.toJSON(),
      voiceChannelCommand.joinData.toJSON(),
      voiceChannelCommand.leaveData.toJSON(),
      voiceCommand.data.toJSON(),
      configCommand.data.toJSON(),
      setupCommand.data.toJSON(),
      botAdminCommand.data.toJSON(),
      autottsCommand.data.toJSON(),
    ];

    logger.info(`Đang đăng ký ${commands.length} slash commands...`);

    await rest.put(
      Routes.applicationCommands(env.DISCORD_CLIENT_ID),
      { body: commands },
    );

    logger.info('✅ Đã đăng ký slash commands thành công!');
  }

  /** Khởi động bot */
  async start(): Promise<void> {
    await this.client.login(env.DISCORD_TOKEN);
  }

  /** Dừng bot */
  async stop(): Promise<void> {
    this.client.destroy();
    logger.info('Bot stopped');
  }
}
