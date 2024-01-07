// transient class made to handle one message
import {invertImage, sortAlphabetical, stringListify} from "../../../utils/Utils";
import {FinalizedWord, MT, ServiceRequest, Word} from "../../../api/Word";
import {Card, DatabaseError} from "../../backend/CardDatabase";
import {WordError, WordInfo} from "../../../api/services/WordService";
import {toCard, toString} from "../WordConverter";
import {DiscordAPIError, Message, MessageActionRow, MessageAttachment, MessageSelectMenu} from "discord.js";
import {DiscordUser} from "./DiscordUser";
import {sha256} from "js-sha256";
import * as fs from "fs";
import {client} from "./DiscordFrontend";
import {docs, version} from "../../../Main";
import {Anki} from "../../backend/Anki";
import _ = require("lodash");
const publicip = require('fix-esm').require('public-ip');

type reqTypes = 'normal' | 'extended' | 'basic';

// noinspection ExceptionCaughtLocallyJS
export class MessageHandler {
    message: Message;
    send: Function;
    content: string;
    command: string;
    predicate: string;
    predList: string[]
    user: DiscordUser;

    private constructor(message: Message, user: DiscordUser) {
        this.message = message;
        this.content = message.content.trim();
        this.user = user;
        this.send = content => message.channel.send(content);

        if (this.content.startsWith('!')) {
            this.command = this.content.split(' ')[0].substr(1);
            this.predicate = this.content.split(' ').slice(1).join(' ');
        } else if (this.user.settings.readingMode) {
            this.predicate = this.content;
        }

        this.predList = stringListify(this.predicate, ',,');
    }

    static getInstance(message: Message, user: DiscordUser): MessageHandler | undefined {
        if (message.content.trim().startsWith('!') || user.settings.readingMode)
            return new MessageHandler(message, user);
        return undefined;
    }

    private static safetyCheck(rawWord: string) {
        if (!/^[\p{L}\-() ]*$/u.test(rawWord)) {
            throw new Error(`Invalid characters in ${rawWord}`);
        }
    }

    async handleMessage() {
        let isDBModified = false;

        if (this.command === 'ping') {
            await this.send(`Pong! Version = ${version}`);
        } else if (this.command === 'help') {
            await this.send(docs);
        } else {
            try {
                if (this.command === 'login') {
                    const [username, password] = this.predicate.split(' ')
                    await this.ankiLogin(username, password);
                }
                else if (this.command === 'asdfip') { // TODO REMOVE BEFORE PRODUCTION!!
                    await this.send(await publicip.publicIpv4());
                }
                else if (this.command === 'r') {
                    await this.toggleReadingMode();
                } else if (this.command === 'ps') {
                    await this.printSettings();
                } else if (this.command === 'cs') {
                    await this.changeSettings(`\{${this.predicate}\}`);
                } else {
                    if (!this.user.settings.ankiUsername) {
                        throw new DatabaseError('You are not logged in to Anki!');
                    }
                    await Anki.login(this.user.settings.ankiUsername, this.user.settings.ankiPassword);

                    if (this.command === 'cd') {
                        await this.changeDeck(this.predicate);
                    } else if (/^lw$/.test(this.command)) {
                        await this.listWords();
                    } else if (/^downw$/.test(this.command)) {
                        await this.downloadWords();
                    } else {
                        for (const rawWord of this.predList) {
                            try {
                                if (/^d[eb]?l?i?$/.test(this.command)) {
                                    MessageHandler.safetyCheck(rawWord);
                                    await this.defineWord(rawWord);
                                } else if (/^wf?[eb]?l?$/.test(this.command) ||
                                    this.user.settings.readingMode &&
                                    !this.command) {
                                    await this.addWord(rawWord);
                                    isDBModified = true;
                                } else if (/^fw$/.test(this.command)) {
                                    await this.findWord(rawWord);
                                } else if (/^mwf?$/.test(this.command)) {
                                    await this.addManualWord(rawWord);
                                    isDBModified = true;
                                } else if (/^delw$/.test(this.command)) {
                                    await this.deleteWord(rawWord);
                                    isDBModified = true;
                                }
                            } catch (e) {
                                if (e instanceof DatabaseError || e instanceof WordError) {
                                    console.error(e);
                                    await this.send(`Error ("${rawWord}"): ${e.message}`);
                                } else throw e;
                            }
                        }
                    }
                }
            } catch (e) {
                if (e instanceof DatabaseError || e instanceof WordError) {
                    console.error(e);
                    await this.send(`Error: ${e.message}`);
                } else throw e;
            }
        }

        if (isDBModified) await (await this.user.getDB()).sync();
    }

    private async ankiLogin(username: string, password: string) {
        await Anki.login(username, password)
        this.user.settings.ankiUsername = username;
        this.user.settings.ankiPassword = password;
        await this.user.updateDB();
        await this.send(`Logged in as ${username}!`);
    }

    private async toWord(rawWord: string, reqType: reqTypes) {
        let s = rawWord.split('(');
        let rawWordInput = s[0].trim();
        let manualPos = s.length > 1 ? s[1].split(')')[0].trim() : undefined;

        let reqs: ServiceRequest[];
        if (reqType === 'normal') {
            reqs = this.user.settings.normalReq;
        } else if (reqType === 'extended') {
            reqs = this.user.settings.extendedReq;
        } else if (reqType === 'basic') {
            reqs = this.user.settings.basicReq;
        }

        let meaningExpected = false;
        let translationExpected = false;
        for (const req of reqs) {
            const infoWanted = req[1];
            if (infoWanted & WordInfo.meaning) meaningExpected = true;
            if (infoWanted & WordInfo.translation) translationExpected = true;
        }

        const word = await Word.of(rawWordInput, reqs, manualPos);

        if (meaningExpected && word.possMeanings.length === 0)
            await this.send(`No definitions are found for "${word.rawInput}"!`);
        if (translationExpected && word.possTranslations.length === 0)
            await this.send(`No translations are found for "${word.rawInput}"!`);

        return word;
    }

    private async sendImage(rawWord: string, html: string): Promise<void> {
        const filename = `./${sha256(html)}.png`;

        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({
            width: 720,
            height: 0,
            deviceScaleFactor: 1,
        });
        await page.setContent(html);
        await page.screenshot({path: `${filename}`, fullPage: true});
        await browser.close();

        if (this.user.settings.darkMode) await invertImage(filename);
        await this.send({
            'content': `"${rawWord}":\n`,
            files: [filename]
        });

        fs.unlinkSync(filename);
    }

    private async reactSelect(word: Word, mt: MT): Promise<number> {
        let replyStr: string = "";
        let mtCount: number;

        if (mt === MT.Meaning) mtCount = word.possMeanings.length;
        else if (mt === MT.Translation) mtCount = word.possTranslations.length;

        const cancel = 'cancel';
        const options: {
            label: string, description?: string,
            value: string
        }[] = [{label: '❌ Cancel ❌', value: cancel}];

        if (mtCount >= 24) {
            replyStr += "Multiple-choice option limit of 24 exceeded! Please try again with greater restrictions.";
            mtCount = 24;
        }

        if (mt === MT.Meaning) {
            replyStr += `Multiple meanings of "${word.text}" found:\`\`\`\n`;

            for (let i = 0; i < mtCount; i++) {
                replyStr += `${i + 1}. (${word.possMeanings[i].pos}) ` + `${word.possMeanings[i].def}\n`;

                options.push({
                    label: `${i + 1}. ${word.possMeanings[i].pos}`,
                    description: `${word.possMeanings[i].def}`.slice(0, 100),
                    value: `${i}`
                });
            }
        } else if (mt === MT.Translation) {
            replyStr += `Multiple translations of "${word.text}" found:\`\`\`\n`;

            for (let i = 0; i < mtCount; i++) {
                replyStr += `${i + 1}. ${word.possTranslations[i].trans}\n`;

                options.push({
                    label: `${i + 1}. ${word.possTranslations[i].trans}`.slice(0, 100),
                    value: `${i}`
                });
            }
        }

        if (replyStr.length > 1996) replyStr = replyStr.slice(0, 1996) + '…';

        replyStr += '```';

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
        return word.finalized(mindex, tindex, this.user.settings.senLimit, this.user.settings.senCharLimit);
    }

    private async changeDeck(newDeckName: string) {
        this.user.settings.deckName = newDeckName;
        await this.user.updateDB();
        this.send(`Deck name changed to "${newDeckName}".`);
    }

    private async toggleReadingMode() {
        this.user.settings.readingMode = !this.user.settings.readingMode;
        if (this.user.settings.readingMode) await this.send(
            'Reading mode activated.');
        else await this.send('Reading mode deactivated.');
    }

    private async defineWord(rawWord: string) {
        let reqType;
        if (/^dl?i?$/.test(this.command)) {
            reqType = 'normal';
        } else if (/^del?i?$/.test(this.command)) {
            reqType = 'extended';
        } else if (/^dbl?i?$/.test(this.command)) {
            reqType = 'basic';
        } else if (this.user.settings.readingMode) reqType = 'normal';
        const word: Word = await this.toWord(rawWord, reqType);

        let finalWord;
        if (/^d[eb]?li?$/.test(this.command)) {
            finalWord = word.finalized(0, 0,
                this.user.settings.senLimit,
                this.user.settings.senCharLimit);
        } else finalWord = await this.finalizeWord(word);

        if (/^d[eb]?l?i$/.test(this.command)) {
            const card = toCard(finalWord);
            await this.sendImage(word.text, card.Back);
        } else {
            await this.sendLongString(toString(finalWord));
        }
    }

    private async findWord(rawWord: string) {
        let card = await (await this.user.getDB()).find(rawWord);
        if (!card) {
            await this.send(`"${rawWord}" not found!`);
        } else if (card.Back === '') {
            await this.send(`"${rawWord}" is found but has empty definition.`);
        } else {
            await this.sendImage(rawWord, card.Back);
        }
    }

    private async listWords() {
        let list = sortAlphabetical(
            await (await this.user.getDB()).listFront());
        if (list.length === 0) {
            await this.send('Deck is empty.');
        }

        let counter = 0;
        while (counter < list.length) {
            let msg = '```';
            for (; counter < list.length; counter++) {
                let toAdd = list[counter] + ',, ';
                if (msg.length + toAdd.length < 1997) {
                    msg += toAdd;
                } else break;
            }

            if (counter === list.length) msg = msg.slice(0, msg.length - 3);
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

        const rawWordL = stringListify(rawWord, '::');
        let manualSens: string[] = [];
        if (rawWordL.length > 1) {
            rawWord = rawWordL[0].trim();
            manualSens.push(...rawWordL.slice(1).map(i => i.trim()));
        }

        MessageHandler.safetyCheck(rawWord);

        let match: Card = await db.find(rawWord);

        // if forced or no existing alike words
        if (/^wf[eb]?l?$/.test(this.command) || !match) {
            let reqType;
            if (/^wf?l?$/.test(this.command)) {
                reqType = 'normal';
            } else if (/^wf?el?$/.test(this.command)) {
                reqType = 'extended';
            } else if (/^wf?bl?$/.test(this.command)) {
                reqType = 'basic';
            } else if (this.user.settings.readingMode) reqType = 'normal';

            const word: Word = await this.toWord(rawWord, reqType);

            let finalWord: FinalizedWord;

            // I'm feeling lucky
            if (/^wf?[eb]?l$/.test(this.command) ||
                this.user.settings.readingMode && !this.command) {
                const mindex = word.possMeanings.length > 0 ? 0 : undefined;
                const tindex = word.possTranslations.length > 0 ? 0 : undefined;
                finalWord = word.finalized(mindex, tindex,
                    this.user.settings.senLimit,
                    this.user.settings.senCharLimit);
            } else finalWord = await this.finalizeWord(word);

            if (manualSens.length > 0) {
                manualSens = manualSens.map(
                    sen => "<b> " + sen.replace(new RegExp(finalWord.text, 'gi'), a => `<u>${a}</u>`) + " </b>");
                manualSens.push(...finalWord.meaning.sens);
                finalWord.meaning.sens = manualSens;
            }

            console.log(finalWord)
            const card = toCard(finalWord);
            await this.sendImage(word.text, card.Back);

            if (match) {
                await db.update(card);
                await this.send(`Back updated for "${card.Front}".`);
            } else {
                await db.add(card);
                await this.send(`"${card.Front}" added successfully!`);
            }
        } else {
            await this.send(`"${match.Front}" already exists!`);
        }
    }

    private async addManualWord(rawWord: string) { // todo sentence example for manual word
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
            } else {
                await db.add(card);
                await this.send(`"${card.Front}" added successfully!`);
            }
        } else {
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
            ': \n```' + JSON.stringify(this.user.settings, null, 2) + '```');
    }

    private async changeSettings(json: string): Promise<void> {
        const invalidSettings = 'Invalid settings!';
        try {
            let newSettings = JSON.parse(json);
            const existingKeys = Object.keys(this.user.settings);
            const newKeys = Object.keys(newSettings);
            if (newKeys.every(v => existingKeys.includes(v))) {
                _.merge(this.user.settings, newSettings);
                await this.send('Settings updated.');
                await this.printSettings();
            } else {
                await this.send(invalidSettings);
            }
        } catch (e) {
            if (e instanceof SyntaxError) {
                await this.send(invalidSettings);
            }
        }
    }

    private async sendLongString(str: string,
                                 prefix: string = '>>> '): Promise<void> {
        const array: string[] = []
        const discordLimit = 2000;
        while (str) {
            const cutoff = discordLimit - 1 - prefix.length;
            array.push(prefix + str.slice(0, cutoff) + '…');
            str = str.slice(cutoff);
        }

        array[array.length - 1] = array[array.length - 1].slice(0,
            array[array.length - 1].length - 1);

        for (const s of array) await this.send(s);
    }
}
