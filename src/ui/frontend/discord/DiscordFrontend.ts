import {discordToken} from '../../UIConfig';
import {DiscordUser} from "./DiscordUser";

const {Client} = require('discord.js');

export const client = new Client(
    {
        intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'DIRECT_MESSAGES', 'DIRECT_MESSAGE_REACTIONS'],
        partials: [
            'CHANNEL', 'MESSAGE'
        ]
    });

export async function main(): Promise<void> {
    client.once('ready', () => {
        console.log('Ready!');
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot) return;
        try {
            const userId: string = message.author.id;
            const user: DiscordUser = DiscordUser.getUser(userId);
            await user.handleMessage(message);
        } catch (e) {
            console.log(e);
            await message.channel.send(
                'Invalid input! Critical error: ' + e.message);
        }
    });

    await client.login(discordToken);
}
