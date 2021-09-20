// transient class made to handle one message
import {stringListify} from "../../../utils/Utils";
import {FinalizedWord, MT, ServiceRequest, Word} from "../../../api/Word";
import {Card, DatabaseError} from "../../backend/CardDatabase";
import {Language, WordError, WordInfo} from "../../../api/services/WordService";
import {FreeDictionaryAPI} from "../../../api/services/FreeDictionaryAPI";
import {Wordnik} from "../../../api/services/Wordnik";
import {Linguee} from "../../../api/services/Linguee";
import {getCardFront, toCard, toString} from "../WordConverter";
import {MessageAttachment} from "discord.js";
import {DiscordUser} from "./DiscordUser";

const version = require('./package.json').version;
const TurndownService = require('turndown');
const turndownService = new TurndownService();

export class MessageHandler {
    message: any;
    send: Function;
    content: string;
    command: string;
    predicate: string;
    predList: string[]
    user: DiscordUser;

    private static EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣',
        '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    private static CANCEL_EMOJI = '❌';
    private static MAX_SELECTION_OPTIONS = MessageHandler.EMOJIS.length;

    constructor(message, user: DiscordUser) {
        this.message = message;
        this.content = message.content.trim();
        this.user = user;
        this.send = content => message.channel.send(content);

        if (this.content.startsWith('!')) {
            this.command = this.content.split(' ')[0].substr(1);
            this.predicate = this.content.split(' ').slice(1).join(' ');
        }
        else if (this.user.readingMode) {
            this.predicate = this.content;
        }

        this.predList = stringListify(this.predicate, ',,');
    }

    private async reactSelect(word: Word, mt: MT): Promise<number> {
        let replyStr: string;
        let mtCount: number;

        if (mt === MT.Meaning) mtCount = Math.min(word.possMeanings.length,
            MessageHandler.MAX_SELECTION_OPTIONS);
        if (mt === MT.Translation) mtCount =
            Math.min(word.possTranslations.length,
                MessageHandler.MAX_SELECTION_OPTIONS);

        if (mt === MT.Meaning) {
            replyStr = `Multiple definitions of "${word.text}" found:\n\`\`\``;

            for (let i = 0;
                 i < mtCount;
                 i++) {
                replyStr += `${i + 1}. (${word.possMeanings[i].pos})
             ${word.possMeanings[i].def}\n`;
            }
            if (word.possMeanings.length >
                MessageHandler.MAX_SELECTION_OPTIONS) replyStr += '...';

            replyStr += '```';
        }
        else if (mt === MT.Translation) {
            replyStr = `Multiple translations of "${word.text}" found:\n\`\`\``;

            for (let i = 0;
                 i < mtCount;
                 i++) {
                replyStr += `${i + 1}. ${word.possTranslations[i].trans}\n`;
            }
            if (word.possTranslations.length >
                MessageHandler.MAX_SELECTION_OPTIONS) replyStr +=
                '...';

            replyStr += '```';
        }

        const reply = await this.message.reply(replyStr);
        for (let i = 0; i < mtCount; i++) {
            reply.react(MessageHandler.EMOJIS[i]).catch(() => {
            });
        }
        reply.react(MessageHandler.CANCEL_EMOJI).catch(() => {
        });

        const filter = (reaction, user) => {
            return (reaction.emoji.name === MessageHandler.CANCEL_EMOJI ||
                    MessageHandler.EMOJIS.includes(reaction.emoji.name)) &&
                user.id === user.userId;
        };
        const collected = await reply.awaitReactions({filter, max: 1});
        const reaction = collected.first();

        await reply.delete();
        if (reaction.emoji.name === MessageHandler.CANCEL_EMOJI) {
            return undefined;
        }

        for (let i = 0; i < mtCount; i++) {
            if (reaction.emoji.name === MessageHandler.EMOJIS[i]) {
                return i;
            }
        }
    }

    async handleMessage() {
        let isDBModified = false;

        if (this.command === 'ping') {
            await this.send(`Pong! Version = ${version}`);
        }
        else {
            if (this.command === 'r') {
                await this.toggleReadingMode();
            }

            else if (/^cd$/.test(this.command)) {
                await this.changeDeck(this.predicate);
            }

            else if (/^lw$/.test(this.command)) {
                await this.listWords();
            }

            else if (/^downw$/.test(this.command)) {
                await this.downloadWords();
            }

            else {
                for (const rawWord of this.predList) {
                    try {
                        if (/^de?$/.test(this.command)) {
                            await this.defineWord(rawWord);
                        }

                        else if (/^fw$/.test(this.command)) {
                            await this.findWord(rawWord);
                        }

                        else if (/^wf?e?l?$/.test(this.command) ||
                            this.user.readingMode && !this.command) {
                            await this.addWord(rawWord);
                            isDBModified = true;
                        }

                        else if (/^mwf?$/.test(this.command)) {
                            await this.addManualWord(rawWord);
                            isDBModified = true;
                        }

                        else if (/^delw$/.test(this.command)) {
                            await this.deleteWord(rawWord);
                            isDBModified = true;
                        }
                    } catch (e) {
                        if (e instanceof DatabaseError ||
                            e instanceof WordError) {
                            await this.send(`Error: ${e.message}`);
                        }
                    }
                }
            }
        }
    }

    private static async toWord(rawWord: string, extended = false) {
        let s = rawWord.split('(');
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

    private async changeDeck(newDeckName: string) {
        this.user.deckName = newDeckName;
        await this.user.updateDB();
    }

    private async toggleReadingMode() {
        this.user.readingMode = !this.user.readingMode;
        if (this.user.readingMode) await this.send('Reading mode activated');
        else await this.send('Reading mode deactivated');
    }

    private async finalizeWord(word: Word): Promise<FinalizedWord> {
        const mindex = word.possMeanings.length > 1 ?
            await this.reactSelect(word, MT.Meaning) : 0;
        const tindex = word.possTranslations.length > 1 ?
            await this.reactSelect(word, MT.Translation) : 0;
        return word.finalized(mindex, tindex);
    }

    private async defineWord(rawWord: string) {
        const word: Word = this.command === 'de' ?
            await MessageHandler.toWord(rawWord, true)
            : await MessageHandler.toWord(rawWord);

        await this.send(toString(await this.finalizeWord(word)));
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
        const word = (/^wf?el?$/.test(this.command)) ?
            await MessageHandler.toWord(rawWord, true) :
            await MessageHandler.toWord(rawWord);
        const db = await this.user.getDB();

        let match: Card = await db.find(getCardFront(word));

        // if forced or no existing alike words
        if (/^wfe?l?$/.test(this.command) || !match) {
            let finalWord: FinalizedWord;

            // I'm feeling lucky
            if (/^wf?l$/.test(this.command) ||
                this.user.readingMode && !this.command) {
                finalWord = word.finalized();
            }
            else finalWord = await this.finalizeWord(word);

            await this.send(toString(finalWord));
            const card = toCard(finalWord);

            if (match) {
                await db.update(card);
                await this.send(
                    `Back updated for "${card.Front}"`);
            }
            else {
                await db.add(card);
                await this.send(`"${card.Front}" added successfully!'`);
            }
        }
        else {
            await this.send(`"${match.Front}" already exists!`);
        }
    }

    private async addManualWord(rawWord: string) {
        let Front: string;
        let Back: string;
        [Front, Back] = stringListify(rawWord, '|');
        Front = Front.trim();
        if (Back) Back = Back.trim().replace(/\n/g, ' <br> ');
        const card: Card = {Front, Back};

        const db = await this.user.getDB();
        const isForced = /^m[wo]f$/.test(this.command);
        let match: Card = await db.find(Front);

        if (isForced || !match) {
            if (match) {
                await db.update(card);
                await this.send(`Back updated for "${Front}"`);
            }
            else {
                await db.add(card);
                await this.send(`"${card.Front}" added successfully!'`);
            }
        }
        else {
            await this.send(`"${match.Front}" already exists!`);
        }
    }

    private async deleteWord(rawWord: string) {
        const db = await this.user.getDB();
        await db.delete(rawWord);
        await this.send(`"${rawWord}" deleted successfully!`);
    }
}