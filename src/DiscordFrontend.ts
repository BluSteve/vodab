import {
    ANKI_OTHERS,
    ANKI_WORDS,
    AnkiHandler,
    DummyAnkiHandler,
} from './database/AnkiAdd';
import {
    FIREBASE_OTHERS,
    FIREBASE_WORDS,
    FirebaseHandler
} from "./database/FirebaseAdd";
import {Word} from './Word';
import {adminId, discordToken} from './config';
import {MessageAttachment} from "discord.js";
import {Card} from "./database/CardDatabase";

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

function getWordOut(word: Word) {
    let wordOut: string = '>>> **' + word.text +
        '**'
    if (word.manualPos) wordOut += '  *' + word.manualPos + '*';
    if (word.ipa) wordOut +=
        '\n\nPronunciation: ' + word.ipa;
    wordOut += '\n\nDefinition: *' + word.def + '*';

    if (word.translation) wordOut +=
        '\n\nTranslation: ' + word.translation;
    if (word.sens.length > 0) wordOut +=
        '\n\nExamples: \n- *' + word.sens.join('\n- ') + '*';
    console.log(word);
    if (word.syns.length > 0) wordOut +=
        '\n\nSynonyms: *' + word.syns.slice(0, 5).join(", ") + '*';
    if (word.ety) wordOut +=
        '\n\nEtymology: *' + word.ety + '*';
    return wordOut;
}

function stringListify(message: string, delimiter: string): string[] {
    let res: string[] = message.split(delimiter);
    for (let i = 0; i < res.length; i++) {
        res[i] = res[i].trim();
    }
    return res;
}

async function reactSelectDef(word: Word, message): Promise<boolean> {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣',
        '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    const cancelEmoji = '❌';
    const defCount = Math.min(word.possMeanings.length, emojis.length);

    let builder = `Multiple definitions of "${word.text}" found:\n\`\`\``;
    for (let i = 0; i < defCount; i++) {
        builder +=
            `${i +
            1}. (${word.possMeanings[i].partOfSpeech}) ${word.possMeanings[i].definition}\n`;
    }
    if (word.possMeanings.length > emojis.length) builder += '...';
    builder += '```';

    const reply = await message.reply(builder);
    for (let i = 0; i < defCount; i++) {
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
    const collected = await reply.awaitReactions(
        {filter, max: 1, time: 300000});
    const reaction = collected.first();

    await reply.delete();
    if (reaction.emoji.name === cancelEmoji) {
        return false;
    }

    for (let i = 0; i < defCount; i++) {
        if (reaction.emoji.name === emojis[i]) {
            word.select(i);
            return true;
        }
    }
}

async function toWord(rawWord: string, wordnik = false) {
    let s = rawWord.split('(');
    let wordId = s[0].trim();
    let pos = s.length > 1 ? s[1].split(')')[0].trim() : '';
    return await Word.create(wordId, pos, wordnik);
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

        if (command === 'ping') {
            await send(`pong! version=${version}`);
        }

        else {
            let raw: string[] = stringListify(params, ',,');
            const isWords = readingMode || !command.endsWith('o');
            const isAdmin = adminId === userId;
            const deckName = isWords ? ANKI_WORDS : ANKI_OTHERS;
            const colName = isWords ? FIREBASE_WORDS : FIREBASE_OTHERS;
            // let fh = await FirebaseHandler.create(userId, colName);
            let ah = isAdmin ? new AnkiHandler(deckName) :
                new DummyAnkiHandler();


            if (command === 'r') {
                readingMode = !readingMode;
                if (readingMode) send('Reading mode activated');
                else send ('Reading mode deactivated');
            }


            else if (/^de?$/.test(command)) {
                for (const rawWord of raw) {
                    const word = command === 'de' ?
                        await toWord(rawWord, true) : await toWord(rawWord);
                    if (word && word.isValid) {
                        if (!word.isPendingSel ||
                            await reactSelectDef(word, message))
                            if (isAdmin) await word.getMoreExamples();
                        await send(getWordOut(word));
                    }
                    else {
                        await send(
                            '"' + rawWord + '" is not a word!');
                    }
                }
            }


            else if (/^f[wo]$/.test(command)) {
                for (const Front of raw) {
                    let info = await ah.info(Front);
                    if (!info) {
                        await send(`"${Front}" not found`);
                    }
                    else if (info === '') {
                        await send(
                            `"${Front}" is found but has empty definition`);
                    }
                    else {
                        let back: string = turndownService.turndown(
                            info);
                        await send(
                            `"${Front}":\n>>> ${back}`);
                    }
                }
            }


            else if (/^l[wo]$/.test(command)) {
                let counter = 0;
                let list = await ah.listFront();
                if (list.length === 0) {
                    await send('Deck is empty');
                }
                while (counter < list.length) {
                    let msg = '```';
                    for (; counter < list.length; counter++) {
                        let toAdd = list[counter] + ',, ';
                        if (msg.length + toAdd.length < 1997) {
                            msg += toAdd;
                        }
                        else break;
                    }
                    await send(msg + '```');
                }
            }


                // else if (/^down[wo]$/.test(command)) {
                //     let list: Card[] = fh.getList();
                //     let str = '';
                //     for (const card of list) {
                //         str += card.Front + '\t' + card.Back + '\n';
                //     }
                //     let attachment = new MessageAttachment(
                //         Buffer.from(str, 'utf-8'), 'export.txt');
                //     message.channel.send({
                //         'content': `Here you go! (${list.length} notes)`,
                //         files: [attachment]
                //     });
            // }


            else if (/^wf?e?l?$/.test(command) || readingMode && !command) {
                console.log(raw);
                for (let rawWord of raw) {
                    const word = (/^wf?el?$/.test(command)) ?
                        await toWord(rawWord, true) :
                        await toWord(rawWord);

                    if (word && word.isValid) {
                        // let match = await fh.find(
                        //     word.wordText);
                        let ankiMatches: number[] = await ah.find(
                            word.getFront());

                        // if forced or no existing alike words
                        if (/^wfe?l?$/.test(command) ||
                            ankiMatches.length === 0) {

                            let selected = !word.isPendingSel;
                            if (!selected) {
                                // I'm feeling lucky
                                if (/^wf?l$/.test(command) || readingMode && !command) {
                                    word.selectMeaning(0)
                                    selected = true;
                                }
                                else selected =
                                    await reactSelectDef(word, message);
                            }

                            if (selected) {
                                if (isAdmin) await word.getMoreExamples();

                                await send(getWordOut(word));
                                if (ankiMatches.length > 0) {
                                    await ah.updateBacks(
                                        ankiMatches,
                                        word.getBack());
                                    // await fh.updateBack(word.wordText,
                                    //     word.getBack());
                                    await send(
                                        `Back updated for "${word.getFront()}"`);
                                }
                                else {
                                    await ah.add(word.getFront(),
                                        word.getBack());
                                    // await fh.save(word.getFront(),
                                    //     word.getBack());
                                    await send(
                                        '"' + word.getFront() +
                                        '" added successfully!');
                                }
                            }
                        }
                        else {
                            await send(
                                '"' + word.getFront() +
                                '" already exists!');
                        }
                    }
                    else {
                        await send(
                            '"' + rawWord + '" is not a word!');
                    }

                    await new Promise(r => setTimeout(r, 2000));
                }

                await ah.sync();
            }


            else if (/^m[wo]f?$/.test(command)) {
                let Front: string;
                let Back: string;
                [Front, Back] = stringListify(params, '|');
                Front = Front.trim();
                if (Back) Back = Back.trim().replace(/\n/g, '<br>');

                const isForced = /^m[wo]f$/.test(command);
                // let match = await fh.find(Front);
                let ankiMatches: number[] = await ah.find(Front);

                if (isForced || ankiMatches.length === 0) {
                    if (ankiMatches.length > 0) {
                        await ah.updateBacks(ankiMatches, Back);
                        // await fh.updateBack(match.Front, Back)
                        await send(
                            `Back updated for "${Front}"`);
                    }
                    else {
                        await ah.add(Front, Back);
                        // await fh.save(Front, Back)
                        await send(
                            '"' + Front + '" added successfully!');
                    }

                    await ah.sync();
                }
                else {
                    await send(
                        '"' + Front + '" already exists!');
                }
            }


            else if (/^del[wo]$/.test(command)) {
                for (const Front of raw) {
                    let ankiMatches: number[] =
                        await ah.find(Front);
                    // let canDelete = await fh.delete(Front);
                    if (ankiMatches.length === 0) {
                        await send(`"${Front}" not found`);
                    }
                    else {
                        await ah.delete(ankiMatches);
                        await send(
                            `Note deleted for "${Front}"`);
                    }
                }
            }
        }
    } catch (e) {
        console.log(e);
        await send('Invalid input!');
    }
});

client.login(discordToken).then();
