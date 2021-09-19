import {FinalizedWord} from "./Word";
import {Card} from "./database/CardDatabase";

export enum Target {
    Discord, Anki, Firebase
}

export function toCard(word: FinalizedWord, target: Target): Card {
    let Front, Back;
    if (target === Target.Anki || target === Target.Firebase) {
        Front = word.manualPos ?
            word.text + ' (' + word.manualPos + ')' :
            word.text;

        Back = '';
        const backBuilder: string[] = [];

        const beautify = require('js-beautify').html;
        const DNL = ' <br><br> ';

        if (word.meaning) {
            for (let x of
                [word.meaning.ipa, word.meaning.pos, word.meaning.def]) {
                if (x) backBuilder.push(x);
            }
        }

        if (word.translation) {
            if (word.translation.trans) {
                backBuilder.push(word.translation.trans);
            }
        }

        if (word.meaning) {
            // Italicizes the word, case-insensitive.
            if (word.meaning.sens && word.meaning.sens.length > 0) {
                let senList = '';

                senList += '<ul>';
                for (let i = 0; i < word.meaning.sens.length; i++) {
                    const sen = word.meaning.sens[i];
                    senList += '<li> ';
                    senList += sen.replace(new RegExp(word.text, 'gi'),
                        a => `<i> ${a} </i>`);
                    if (i < word.meaning.sens.length - 1) senList += DNL;
                    senList += ' </li>';
                }
                senList += '</ul>';

                backBuilder.push(senList);
            }
        }

        if (word.translation) {
            if (word.translation.transSens) {
                let table: string = '';

                table += '<style> table, th, td {border: 1px solid black; ' +
                    'border-collapse: collapse;}</style>'
                table += '<table>';
                for (const transSens of word.translation.transSens) {
                    table += '<tr>';
                    table += `<td> ${transSens.src} </td>`
                    table += `<td> ${transSens.dst} </td>`
                    table += '</tr>';
                }
                table += '</table>';

                backBuilder.push(table);
            }
        }

        if (word.meaning) {
            if (word.meaning.syns.length > 0) backBuilder.push(
                word.meaning.syns.slice(0, 5).join(', '));

            if (word.meaning.ety) backBuilder.push(word.meaning.ety);
        }

        Back = beautify(backBuilder.join(DNL));
    }

    if (!Front || !Back) throw new Error(`Empty card for "${word.text}"!`);
    return {Front, Back};
}

export function toString(word: FinalizedWord, target: Target): string {
    let str;

    if (target === Target.Discord) {
        str = '>>> ';

        const strBuilder: string[] = [];
        let firstLine = '**' + word.text + '**';

        if (word.meaning) {
            if (word.meaning.pos) firstLine += '  *' + word.meaning.pos + '*';
        }
        strBuilder.push(firstLine);

        if (word.meaning) {
            if (word.meaning.ipa) strBuilder.push(
                'Pronunciation: ' + word.meaning.ipa);
            strBuilder.push('Definition: *' + word.meaning.def + '*');

            if (word.meaning.sens.length > 0) strBuilder.push(
                'Examples: \n' + word.meaning.sens.map(s => {
                    return `- *${s}*`
                }).join('\n'));
        }

        if (word.translation) {
            if (word.translation.trans) strBuilder.push(
                'Translation: ' + word.translation.trans);
            if (word.translation.transSens &&
                word.translation.transSens.length > 0) {
                strBuilder.push('Translated sentences: \n' +
                    word.translation.transSens.map(s => {
                        return `- ${s.src}\n- ${s.dst}`;
                    }).join('\n\n'));
            }
        }

        if (word.meaning) {
            if (word.meaning.syns.length > 0) strBuilder.push(
                'Synonyms: *' + word.meaning.syns.join(", ") + '*');

            if (word.meaning.ety) strBuilder.push(
                'Etymology: *' + word.meaning.ety + '*');
        }

        str += strBuilder.join('\n\n');
    }

    return str;
}