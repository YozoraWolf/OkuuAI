
import { Client, GatewayIntentBits, Message, Partials, TextChannel, EmbedBuilder } from 'discord.js';
import { Logger } from '../logger';
import { sendChat, ChatMessage } from '../chat';
import { enhancedToolSystem } from '../tools/enhancedToolSystem';

interface QueueItem {
    message: Message;
    resolve: (value: void | PromiseLike<void>) => void;
    reject: (reason?: any) => void;
}

export class DiscordManager {
    private client: Client;
    private queue: QueueItem[] = [];
    private processingCount = 0;
    private maxConcurrentRequests = 3; // Default to 3, can be configurable
    private isProcessing = false;

    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.DirectMessages
            ],
            partials: [
                Partials.Channel,
                Partials.Message
            ]
        });

        this.client.on('ready', () => {
            Logger.INFO(`Logged in as ${this.client.user?.tag}!`);
        });

        this.client.on('messageCreate', this.handleMessage.bind(this));
    }

    public async login(token: string) {
        try {
            await this.client.login(token);
        } catch (error) {
            Logger.ERROR(`Failed to login to Discord: ${error}`);
        }
    }

    private async handleMessage(message: Message) {
        if (message.author.bot) return;

        // Check if mentioned or in DM
        const isMentioned = this.client.user && message.mentions.users.has(this.client.user.id);
        const isDM = message.channel.type === 1; // DM

        if (!isMentioned && !isDM) return;

        Logger.INFO(`Received message from ${message.author.tag}: ${message.content}`);

        // Add to queue
        new Promise<void>((resolve, reject) => {
            this.queue.push({ message, resolve, reject });
            this.processQueue();
        });
    }

    private async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        while (this.queue.length > 0 && this.processingCount < this.maxConcurrentRequests) {
            const item = this.queue.shift();
            if (!item) break;

            this.processingCount++;
            this.processItem(item).finally(() => {
                this.processingCount--;
                this.processQueue(); // Trigger next item
            });
        }

        this.isProcessing = false;
    }

    private async processItem(item: QueueItem) {
        const { message, resolve, reject } = item;
        const channel = message.channel as TextChannel;

        try {
            channel.sendTyping();

            // Prepare ChatMessage
            const chatMsg: ChatMessage = {
                sessionId: `discord-${message.channel.id}`, // Use channel ID as session ID for continuity in channel
                user: message.member?.displayName ?? message.author.username,
                message: message.content.replace(/<@!?[0-9]+>/g, '').trim(), // Remove mention
                timestamp: Date.now(),
                lang: 'en-US', // Default, could detect
                stream: false, // Discord doesn't support streaming well in this context yet
                memoryUser: message.member?.displayName ?? message.author.username,
                metadata: {
                    discord_mention: `<@${message.author.id}>`
                }
            };

            // Send to Okuu
            const response = await sendChat(chatMsg);

            if (response) {
                const embeds: EmbedBuilder[] = [];

                // Check for Danbooru images
                if (response.metadata?.danbooru_images) {
                    const images = response.metadata.danbooru_images;
                    for (const img of images) {
                        // Determine color based on rating
                        let color = 0x00ff00; // Green for Safe
                        let ratingText = 'Safe';
                        if (img.rating === 'q') {
                            color = 0xffaa00; // Orange/Yellow for Questionable
                            ratingText = 'Questionable';
                        } else if (img.rating === 'e') {
                            color = 0xff0000; // Red for Explicit
                            ratingText = 'Explicit';
                        }

                        const embed = new EmbedBuilder()
                            .setColor(color)
                            .setTitle(`Danbooru Post #${img.id}`)
                            .setURL(img.source)
                            .setImage(img.url) // Use full file_url for better quality
                            .addFields(
                                { name: '🎨 Artist', value: img.artist || 'Unknown', inline: true },
                                { name: '⚠️ Rating', value: ratingText, inline: true }
                            )
                            .setFooter({ text: `Source: Danbooru` });

                        // Add character tags if available
                        if (img.tags) {
                            embed.addFields({ name: '👤 Characters', value: img.tags || 'None', inline: false });
                        }

                        embeds.push(embed);
                    }
                }

                // Check for generic image URLs (e.g. from web search)
                if (response.metadata?.image_urls) {
                    const images = response.metadata.image_urls;
                    for (const url of images) {
                        const embed = new EmbedBuilder()
                            .setImage(url)
                            .setColor(0x5865F2); // Discord blurple
                        embeds.push(embed);
                    }
                }

                // Reply with message and embeds
                await message.reply({
                    content: response.message,
                    embeds: embeds.length > 0 ? embeds : undefined
                });
            } else {
                await message.reply("I'm having trouble thinking right now.");
            }

            resolve();
        } catch (error) {
            Logger.ERROR(`Error processing Discord message: ${error}`);
            await message.reply("Sorry, something went wrong.");
            reject(error);
        }
    }
}

export const discordManager = new DiscordManager();
