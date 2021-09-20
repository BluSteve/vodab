// transient class made to handle one message
import {invertImage, stringListify} from "../../../utils/Utils";
import {FinalizedWord, MT, ServiceRequest, Word} from "../../../api/Word";
import {Card, DatabaseError} from "../../backend/CardDatabase";
import {Language, WordError, WordInfo} from "../../../api/services/WordService";
import {FreeDictionaryAPI} from "../../../api/services/FreeDictionaryAPI";
import {Wordnik} from "../../../api/services/Wordnik";
import {Linguee} from "../../../api/services/Linguee";
import {toCard, toString} from "../WordConverter";
import {
    DiscordAPIError,
    Message,
    MessageActionRow,
    MessageAttachment,
    MessageSelectMenu
} from "discord.js";
import {DiscordUser, UserSettings} from "./DiscordUser";
import {sha256} from "js-sha256";
import * as fs from "fs";
import {client} from "./DiscordFrontend";
import {version} from "../../../Main";

// noinspection ExceptionCaughtLocallyJS
export class MessageHandler {
    private static EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣',
        '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    private static CANCEL_EMOJI = '❌';
    private static MAX_SELECTION_OPTIONS = MessageHandler.EMOJIS.length;
    message: Message;
    send: Function;
    content: string;
    command: string;
    predicate: string;
    predList: string[]
    user: DiscordUser;
    private readonly settings: UserSettings;

    constructor(message, user: DiscordUser) {
        this.message = message;
        this.content = message.content.trim();
        this.user = user;
        this.settings = user.settings;
        this.send = content => message.channel.send(content);

        if (this.content.startsWith('!')) {
            this.command = this.content.split(' ')[0].substr(1);
            this.predicate = this.content.split(' ').slice(1).join(' ');
        }
        else if (this.settings.readingMode) {
            this.predicate = this.content;
        }

        this.predList = stringListify(this.predicate, ',,');
    }

    private static async toWord(rawWord: string, extended = false) {
        let s = rawWord.split('(');
        let rawWordInput = s[0].trim();
        let manualPos = s.length > 1 ? s[1].split(')')[0].trim() : undefined;

        let serviceRequest: ServiceRequest[];
        const freeDictionaryAPI = FreeDictionaryAPI.getInstance();
        const lingueeSen = Linguee.getInstance(Language.en, Language.fr);
        const lingueeTrans = Linguee.getInstance(Language.en, Language.zh);
        if (extended) {
            const wordnik = Wordnik.getInstance();
            serviceRequest = [
                [freeDictionaryAPI, WordInfo.meaning],
                [wordnik, WordInfo.def + WordInfo.pos],
                [lingueeSen, WordInfo.sens],
                [wordnik, WordInfo.sens],
                [lingueeTrans, WordInfo.translation]
            ];
        }
        else {
            serviceRequest = [
                [freeDictionaryAPI, WordInfo.meaning],
                [lingueeSen, WordInfo.sens],
                [lingueeTrans, WordInfo.translation]
            ];
        }
        return Word.of(rawWordInput, serviceRequest, manualPos);
    }

    private static async toImage(html: string, filename: string) {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({
            width: 720,
            height: 960,
            deviceScaleFactor: 1,
        });
        await page.setContent(html);
        await page.screenshot({path: `${filename}`});
        await browser.close();
    }

    async handleMessage() {
        let isDBModified = false;

        if (this.command === 'ping') {
            await this.send(`Pong! Version = ${version}`);
        }
        else {
            try {
                if (this.command === 'r') {
                    await this.toggleReadingMode();
                }

                else if (this.command === 'cd') {
                    await this.changeDeck(this.predicate);
                }

                else if (this.command === 'ps') {
                    await this.printSettings();
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
                                this.settings.readingMode && !this.command) {
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
                                console.error(e);
                                await this.send(`Error: ${e.message}`);
                            }
                            else throw e;
                        }
                    }
                }
            } catch (e) {
                if (e instanceof DatabaseError ||
                    e instanceof WordError) {
                    console.error(e);
                    await this.send(`Error: ${e.message}`);
                }
                else throw e;
            }
        }

        if (isDBModified) await (await this.user.getDB()).sync();
    }

    private async reactSelect(word: Word, mt: MT): Promise<number> {
        let replyStr: string;
        let mtCount: number;

        if (mt === MT.Meaning) mtCount = Math.min(word.possMeanings.length,
            MessageHandler.MAX_SELECTION_OPTIONS);
        if (mt === MT.Translation) mtCount =
            Math.min(word.possTranslations.length,
                MessageHandler.MAX_SELECTION_OPTIONS);

        const cancel = 'cancel';
        const options: {
            label: string, description?: string,
            value: string
        }[] = [{label: 'Cancel', value: cancel}];

        if (mt === MT.Meaning) {
            replyStr = `Multiple meanings of "${word.text}" found:`;

            for (let i = 0; i < mtCount; i++) {
                options.push({
                    label: `${word.possMeanings[i].pos}`,
                    description: `${word.possMeanings[i].def}`,
                    value: `${i}`
                });
            }
        }
        else if (mt === MT.Translation) {
            replyStr = `Multiple translations of "${word.text}" found:`;

            for (let i = 0; i < mtCount; i++) {
                options.push({
                    label: `${word.possTranslations[i].trans}`,
                    value: `${i}`
                });
            }
        }

        const filter: (m: any) => boolean =
            m => m.author.id === this.user.userId;

        const selectMT = 'selectMT';
        const row = new MessageActionRow().addComponents(
            new MessageSelectMenu()
                .setCustomId(selectMT)
                .setPlaceholder('Nothing selected')
                .addOptions(options),
        )

        const reply = await this.message.reply({
            content: replyStr,
            components: [row]
        });

        return new Promise<number>(async (resolve, reject) => {
            client.on('interactionCreate', async interaction => {
                if (!interaction.isSelectMenu() ||
                    interaction.user.id !== this.user.userId) return;
                if (interaction.customId === cancel) {
                    reject();
                }
                if (interaction.customId === selectMT) {
                    const index = parseInt(interaction.values[0]);
                    try {
                        // I don't know why this try catch is necessary...
                        await reply.delete();
                    } catch (e) {
                        if (!(e instanceof DiscordAPIError)) throw e;
                    }
                    resolve(index);
                }
            });
        });
    }

    private async finalizeWord(word: Word): Promise<FinalizedWord> {
        let mindex, tindex;
        if (word.possMeanings.length !== 0) {
            mindex = word.possMeanings.length > 1 ?
                await this.reactSelect(word, MT.Meaning) : 0;
        }
        if (word.possTranslations.length !== 0) {
            tindex = word.possTranslations.length > 1 ?
                await this.reactSelect(word, MT.Translation) : 0;
        }
        return word.finalized(mindex, tindex);
    }

    private async changeDeck(newDeckName: string) {
        this.settings.deckName = newDeckName;
        await this.user.updateDB();
        this.send(`Deck name changed to ${newDeckName}`);
    }

    private async toggleReadingMode() {
        this.settings.readingMode = !this.settings.readingMode;
        if (this.settings.readingMode) await this.send(
            'Reading mode activated');
        else await this.send('Reading mode deactivated');
    }

    private async defineWord(rawWord: string) {
        const word: Word = this.command === 'de' ?
            await MessageHandler.toWord(rawWord, true)
            : await MessageHandler.toWord(rawWord);

        await this.send(toString(await this.finalizeWord(word)));
    }

    private async findWord(rawWord: string) {
        let card = await (await this.user.getDB()).find(rawWord);
        if (!card) {
            await this.send(`"${rawWord}" not found!`);
        }
        else if (card.Back === '') {
            await this.send(`"${rawWord}" is found but has empty definition`);
        }
        else {
            const filename = `./${sha256(card.Back)}.png`;
            await MessageHandler.toImage(card.Back, filename);
            if (this.settings.darkMode) await invertImage(filename);
            await this.send({
                'content': `"${rawWord}":\n`,
                files: [filename]
            });
            fs.unlinkSync(filename);
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
            msg = msg.slice(0, msg.length - 3);
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
        this.send({
            'content': `Here you go! (${list.length} cards)`,
            files: [attachment]
        });
    }

    private async addWord(rawWord: string) {
        const db = await this.user.getDB();
        let match: Card = await db.find(rawWord);

        // if forced or no existing alike words
        if (/^wfe?l?$/.test(this.command) || !match) {
            const word = (/^wf?el?$/.test(this.command)) ?
                await MessageHandler.toWord(rawWord, true) :
                await MessageHandler.toWord(rawWord);

            let finalWord: FinalizedWord;

            // I'm feeling lucky
            if (/^wf?l$/.test(this.command) ||
                this.settings.readingMode && !this.command) {
                finalWord = word.finalized(0, 0);
            }
            else finalWord = await this.finalizeWord(word);

            await this.send(toString(finalWord));
            console.log(finalWord)
            const card = toCard(finalWord);

            if (match) {
                await db.update(card);
                await this.send(`Back updated for "${card.Front}"`);
            }
            else {
                await db.add(card);
                await this.send(`"${card.Front}" added successfully!`);
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
                await this.send(`"${card.Front}" added successfully!`);
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

    private async printSettings() {
        await this.send(this.message.author.tag +
            ': \n```' + JSON.stringify(this.settings, null, 2) + '```');
    }
}