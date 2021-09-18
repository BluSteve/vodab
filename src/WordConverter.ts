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

        const beautify = require('js-beautify').html;
        const DNL = ' <br><br> ';

        for (let x of [word.meaning.ipa, word.meaning.pos,
            word.meaning.def, word.translation.trans]) {
            if (x) Back += x + DNL;
        }

        // Italicizes the word, case-insensitive.
        if (word.meaning.sens.length > 0) Back += '<ul><li>' +
            word.meaning.sens.map(
                item => item.replace(new RegExp(word.text, 'gi'),
                    a => `<i>${a}</i>`))
                .join('</li><li>') + '</li></ul>';

        if (word.meaning.sens.length === 0) Back += '<br>';
        if (word.meaning.syns.length > 0) Back +=
            '<br>' + word.meaning.syns.slice(0, 5).join(', ');
        if (word.meaning.ety) Back += DNL + word.meaning.ety;

        Back = beautify(Back);
    }

    else if (target === Target.Discord) {
        Front = '>>> **' + word.text + '**';
        if (word.meaning.pos) Front += '  *' + word.meaning.pos + '*';

        Back = '';

        if (word.meaning.ipa) Back +=
            'Pronunciation: ' + word.meaning.ipa;
        Back += '\n\nDefinition: *' + word.meaning.def + '*';

        if (word.translation) Back +=
            '\n\nTranslation: ' + word.translation.trans;
        if (word.meaning.sens.length > 0) Back +=
            '\n\nExamples: \n- *' + word.meaning.sens.join('\n- ') + '*';
        console.log(word);
        if (word.meaning.syns.length > 0) Back +=
            '\n\nSynonyms: *' + word.meaning.syns.slice(0, 5).join(", ") + '*';
        if (word.meaning.ety) Back +=
            '\n\nEtymology: *' + word.meaning.ety + '*';
    }

    if (!Front || !Back) throw new Error(`Empty card for "${word.text}"!`);
    return {Front, Back};
}