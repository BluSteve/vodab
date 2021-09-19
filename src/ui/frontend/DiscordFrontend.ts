import {Anki, ANKI_WORDS} from '../backend/Anki';
import {FinalizedWord, MT, ServiceRequest, Word} from '../../api/Word';
import {adminId, discordToken} from '../Config';
import {stringListify} from "../../utils/Utils";
import {Language, WordError, WordInfo} from "../../api/services/WordService";
import {Linguee} from "../../api/services/Linguee";
import {Wordnik} from "../../api/services/Wordnik";
import {FreeDictionaryAPI} from "../../api/services/FreeDictionaryAPI";
import {toString} from "./WordConverter";
import {Card, CardDatabase, DatabaseError} from "../backend/CardDatabase";
import {MessageAttachment} from "discord.js";

const {Client} = require('discord.js');
const TurndownService = require('turndown');
const turndownService = new TurndownService();
const version = '1.0.0b';

console.log(`version = ${version}`)

const client = new Client(
    {
        intents: ['GUILDS', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS']
    });

client.once('ready', () => {
    console.log('Ready!');
});

const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣',
    '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const cancelEmoji = '❌';
const MAX_SELECTION_OPTIONS = emojis.length;

function getMTCount(word: Word, mt: MT): number {
    if (mt === MT.Meaning) return Math.min(word.possMeanings.length,
        MAX_SELECTION_OPTIONS);
    if (mt === MT.Translation) return Math.min(word.possTranslations.length,
        MAX_SELECTION_OPTIONS);
}

async function reactSelect(word: Word, message, mt: MT): Promise<number> {
    let replyStr: string;
    let mtCount: number = getMTCount(word, mt);
    if (mt === MT.Meaning) {
        replyStr = `Multiple definitions of "${word.text}" found:\n\`\`\``;

        for (let i = 0;
             i < mtCount;
             i++) {
            replyStr += `${i + 1}. (${word.possMeanings[i].pos})
             ${word.possMeanings[i].def}\n`;
        }
        if (word.possMeanings.length > MAX_SELECTION_OPTIONS) replyStr += '...';

        replyStr += '```';
    }
    else if (mt === MT.Translation) {
        replyStr = `Multiple translations of "${word.text}" found:\n\`\`\``;

        for (let i = 0;
             i < mtCount;
             i++) {
            replyStr += `${i + 1}. ${word.possTranslations[i].trans}\n`;
        }
        if (word.possTranslations.length > MAX_SELECTION_OPTIONS) replyStr +=
            '...';

        replyStr += '```';
    }

    const reply = await message.reply(replyStr);
    for (let i = 0; i < mtCount; i++) {
        reply.react(emojis[i]).catch(() => {
        });
    }
    reply.react(cancelEmoji).catch(() => {
    });

    const filter = (reaction, user) => {
        return (reaction.emoji.name === cancelEmoji ||
                emojis.includes(reaction.emoji.name)) &&
            user.id === message.author.id;
    };
    const collected = await reply.awaitReactions({filter, max: 1});
    const reaction = collected.first();

    await reply.delete();
    if (reaction.emoji.name === cancelEmoji) {
        return undefined;
    }

    for (let i = 0; i < mtCount; i++) {
        if (reaction.emoji.name === emojis[i]) {
            return i;
        }
    }
}

async function toWord(raw: string, extended = false) {
    let s = raw.split('(');
    let rawWordInput = s[0].trim();
    let manualPos = s.length > 1 ? s[1].split(')')[0].trim() : undefined;

    let serviceRequest: ServiceRequest[];
    if (extended) {
        serviceRequest = [
            [FreeDictionaryAPI.getInstance(),
                WordInfo.meaning - WordInfo.sens],
            [Wordnik.getInstance(),
                WordInfo.def + WordInfo.pos + WordInfo.sens],
            [Linguee.getInstance(Language.en, Language.zh),
                WordInfo.translation + WordInfo.sens]];
    }
    else {
        serviceRequest = [
            [FreeDictionaryAPI.getInstance(),
                WordInfo.meaning - WordInfo.sens],
            [Linguee.getInstance(Language.en, Language.zh),
                WordInfo.translation + WordInfo.sens]];
    }
    return Word.of(rawWordInput, serviceRequest, manualPos);
}

// transient class made to handle one message
class MessageHandler {
    message: any;
    send: Function;
    content: string;
    command: string;
    words: string;
    raw: string[]
    user: User;

    constructor(message, user: User) {
        this.message = message;
        this.content = message.content.trim();
        this.user = user;
        this.send = content => message.channel.send(content);

        if (this.content.startsWith('!')) {
            this.command = this.content.split(' ')[0].substr(1);
            this.words = this.content.split(' ').slice(1).join(' ');
        }
        else if (readingMode) {
            this.words = this.content;
        }

        this.raw = stringListify(this.words, ',,');
    }

    async handleMessage() {
        if (this.command === 'ping') {
            await this.send(`pong! version=${version}`);
        }

        else {
            if (this.command === 'r') {
                await this.toggleReadingMode();
            }

            else if (/^l[wo]$/.test(this.command)) {
                await this.listWords();
            }

            else if (/^down[wo]$/.test(this.command)) {
                await this.downloadWords();
            }

            else {
                for (const rawWord of this.raw) {
                    if (/^de?$/.test(this.command)) {
                        await this.defineWord(rawWord);
                    }

                    else if (/^f[wo]$/.test(this.command)) {
                        await this.findWord(rawWord);
                    }

                    else if (/^wf?e?l?$/.test(this.command) || readingMode &&
                        !this.command) {

                    }
                }
            }


        else
            if (/^m[wo]f?$/.test(this.command)) {
                let Front: string;
                let Back: string;
                [Front, Back] = stringListify(params, '|');
                Front = Front.trim();
                if (Back) Back = Back.trim().replace(/\n/g, '<br>');

                const isForced = /^m[wo]f$/.test(this.command);
                // let match = await fh.find(Front);
                let ankiMatches: number[] = await dbase.find(Front);

                if (isForced || ankiMatches.length === 0) {
                    if (ankiMatches.length > 0) {
                        await dbase.updateBacks(ankiMatches, Back);
                        // await fh.updateBack(match.Front, Back)
                        await this.send(
                            `Back updated for "${Front}"`);
                    }
                    else {
                        await dbase.add(Front, Back);
                        // await fh.save(Front, Back)
                        await this.send(
                            '"' + Front + '" added successfully!');
                    }

                    await dbase.sync();
                }
                else {
                    await this.send(
                        '"' + Front + '" already exists!');
                }
            }


            else if (/^del[wo]$/.test(this.command)) {
                for (const Front of this.raw) {
                    let ankiMatches: number[] =
                        await dbase.find(Front);
                    // let canDelete = await fh.delete(Front);
                    if (ankiMatches.length === 0) {
                        await this.send(`"${Front}" not found`);
                    }
                    else {
                        await dbase.delete(ankiMatches);
                        await this.send(
                            `Note deleted for "${Front}"`);
                    }
                }
            }
        }
    }

    // todo change deck command

    private async toggleReadingMode() {
        this.user.readingMode = !this.user.readingMode;
        if (readingMode) await this.send('Reading mode activated');
        else await this.send('Reading mode deactivated');
    }

    private async defineWord(rawWord: string) {
        const word: Word = this.command === 'de' ?
            await toWord(rawWord, true) : await toWord(rawWord);

        const mindex = word.possMeanings.length > 1 ?
            await reactSelect(word, this.message, MT.Meaning) : 0;
        const tindex = word.possTranslations.length > 1 ?
            await reactSelect(word, this.message, MT.Translation) : 0;
        const finalWord: FinalizedWord =
            word.finalized(mindex, tindex);

        await this.send(toString(finalWord));
    }

    private async findWord(rawWord: string) {
        let card = await (await this.user.getDB()).find(rawWord);
        if (card.Back === '') {
            await this.send(`"${rawWord}" is found but has empty definition`);
        }
        else {
            let Back: string = turndownService.turndown(card.Back);
            await this.send(`"${rawWord}":\n>>> ${Back}`);
        }
    }

    private async listWords() {
        let list = await (await this.user.getDB()).listFront();
        if (list.length === 0) {
            await this.send('Deck is empty');
        }

        let counter = 0;
        while (counter < list.length) {
            let msg = '```';
            for (; counter < list.length; counter++) {
                let toAdd = list[counter] + ',, ';
                if (msg.length + toAdd.length < 1997) {
                    msg += toAdd;
                }
                else break;
            }
            await this.send(msg + '```');
        }
    }

    private async downloadWords() {
        let list: Card[] = await (await this.user.getDB()).list();
        let str = '';
        for (const card of list) {
            str += card.Front + '\t' + card.Back + '\n';
        }
        let attachment = new MessageAttachment(
            Buffer.from(str, 'utf-8'), 'export.txt');
        this.message.channel.this.send({
            'content': `Here you go! (${list.length} notes)`,
            files: [attachment]
        });
    }

    private async addWord(rawWord: string) {
        console.log(this.raw);

        const word = (/^wf?el?$/.test(this.command)) ?
            await toWord(rawWord, true) :
            await toWord(rawWord);

        const dbase = await this.user.getDB();

        let matches: number[] = await dbase.find(word.getFront());

        // if forced or no existing alike words
        if (/^wfe?l?$/.test(this.command) ||
            matches.length === 0) {

            let selected = !word.isPendingSel;
            if (!selected) {
                // I'm feeling lucky
                if (/^wf?l$/.test(this.command) ||
                    readingMode &&
                    !this.command) {
                    word.selectMeaning(0)
                    selected = true;
                }
                else selected =
                    await reactSelect(word, message);
            }

            if (selected) {
                if (isAdmin) await word.getMoreExamples();

                await this.send(getWordOut(word));
                if (matches.length > 0) {
                    await dbase.updateBacks(
                        matches,
                        word.getBack());
                    await this.send(
                        `Back updated for "${word.getFront()}"`);
                }
                else {
                    await dbase.add(word.getFront(),
                        word.getBack());
                    // await fh.save(word.getFront(),
                    //     word.getBack());
                    await this.send(
                        '"' + word.getFront() +
                        '" added successfully!');
                }
            }
        }
        else {
            await this.send(
                '"' + word.getFront() +
                '" already exists!');
        }


        await dbase.sync();
    }
}

// stores persistent info on the user
class User {
    static users: Map<string, User> = new Map();
    userId: string;
    isAdmin: boolean;
    readingMode: boolean = false;
    deckName: string = ANKI_WORDS;
    private db: CardDatabase | undefined; // lazy loaded on request

    private constructor(userId: string) {
        this.userId = userId;
        if (userId === adminId) {
            this.isAdmin = true;
        }
    }

    static getUser(userId: string): User {
        if (!this.users.get(userId)) {
            this.users.set(userId, new this(userId));
        }
        return this.users.get(userId);
    }

    async getDB(): Promise<CardDatabase> {
        if (!this.db) {
            if (this.isAdmin) {
                this.db = await Anki.getInstance(this.deckName);
            }
        }

        return this.db;
    }

    async handleMessage(message): Promise<void> {
        const messageHandler: MessageHandler =
            new MessageHandler(message, this);
        await messageHandler.handleMessage();
    }
}

let readingMode: boolean = false;
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    let content: string = message.content.trim();
    let userId: string = message.author.id;
    let send = content => message.channel.send(content);
    try {
        let command: string;
        let params: string;
        if (content.startsWith('!')) {
            command = content.split(' ')[0].substr(1);
            params = content.split(' ').slice(1).join(' ');
        }
        else if (readingMode) {
            params = content;
        }
        else return;
        console.log('command=' + command);


    } catch (e) {
        console.log(e);
        if (e instanceof WordError || e instanceof DatabaseError) {
            await send(e.message);
        }
        else await send('Invalid input!');
    }
});

client.login(discordToken).then();
