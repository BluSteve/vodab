import {FinalizedWord, Word} from "../../api/Word";
import {Card} from "../backend/CardDatabase";

export function getCardFront(word: Word | FinalizedWord): string {
    return word.manualPos ?
        word.text + ' (' + word.manualPos + ')' :
        word.text;
}

export function toCard(word: FinalizedWord): Card {
    let Front = getCardFront(word);
    let Back;

    const backBuilder: string[] = [];
    const beautify = require('js-beautify').html;
    const DNL = ' <br><br> ';

    const meaning = word.meaning;
    const translation = word.translation;

    if (meaning) {
        for (let x of [meaning.ipa, meaning.pos, meaning.def, meaning.ety]) {
            if (x) backBuilder.push(x);
        }

        if (meaning.syns && meaning.syns.length > 0) backBuilder.push(
            meaning.syns.slice(0, 5).join(', '));
    }

    if (translation) {
        if (translation.trans) {
            backBuilder.push(translation.trans);
        }
    }

    if (meaning) {
        // Italicizes the word, case-insensitive.
        if (meaning.sens && meaning.sens.length > 0) {
            let senList = '';

            senList += '<ul>';
            for (let i = 0; i < meaning.sens.length; i++) {
                const sen = meaning.sens[i];
                senList += '<li> ';
                senList += sen.replace(new RegExp(word.text, 'gi'),
                    a => `<i> ${a} </i>`);
                if (i < meaning.sens.length - 1) senList += DNL;
                senList += ' </li>';
            }
            senList += '</ul>';

            backBuilder.push(senList);
        }
    }

    if (translation) {
        if (translation.transSens && translation.transSens.length > 0) {
            let table: string = '';

            table += '<style> table, th, td {border: 1px solid black; ' +
                'border-collapse: collapse;}</style>'
            table += '<table>';
            for (const transSens of translation.transSens) {
                table += '<tr>';
                table += `<td> ${transSens.src} </td>`
                table += `<td> ${transSens.dst} </td>`
                table += '</tr>';
            }
            table += '</table>';

            backBuilder.push(table);
        }
    }

    Back = beautify(backBuilder.join(DNL));

    if (!Front || !Back) throw new Error(`Empty card for "${word.text}"!`);
    return {Front, Back};
}

export function toString(word: FinalizedWord): string {
    let str = '>>> ';

    const strBuilder: string[] = [];
    let firstLine = '**' + word.text + '**';

    let meaning = word.meaning;
    let translation = word.translation;

    if (meaning) {
        if (meaning.pos) firstLine += '  *' + meaning.pos + '*';
    }

    strBuilder.push(firstLine);

    if (meaning) {
        if (meaning.ipa) strBuilder.push('Pronunciation: ' + meaning.ipa);

        if (meaning.def) strBuilder.push('Definition: *' + meaning.def + '*');

        if (meaning.ety) strBuilder.push('Etymology: *' + meaning.ety + '*');

        if (meaning.syns && meaning.syns.length > 0) strBuilder.push(
            'Synonyms: *' + meaning.syns.join(", ") + '*');
    }

    if (translation) {
        if (translation.trans) strBuilder.push(
            'Translation: ' + translation.trans);
    }

    if (meaning) {
        if (meaning.sens && meaning.sens.length > 0) strBuilder.push(
            'Examples: \n' + meaning.sens.map(s => {
                return `- *${s}*`
            }).join('\n'));
    }

    if (translation) {
        if (translation.transSens &&
            translation.transSens.length > 0) {
            strBuilder.push('Translated sentences: \n' +
                translation.transSens.map(s => {
                    return `- ${s.src}\n- ${s.dst}`;
                }).join('\n\n'));
        }
    }

    str += strBuilder.join('\n\n');

    if (str.length > 2000) {
        str = str.slice(0, 1999);
        str += '…';
    }
    return str;
}