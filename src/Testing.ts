import {Target, toString} from "./WordConverter";
import {FreeDictionaryAPI} from "./services/FreeDictionaryAPI";
import {GoogleTranslate} from "./services/GoogleTranslate";
import {Language, WordInfo} from "./services/WordService";
import {Linguee} from "./services/Linguee";
import {Wordnik} from "./services/Wordnik";
import {Word} from "./Word";
import {printAll} from "./utils/Utils";

async function main() {
    const raw = 'forlorn';

    const fdapi = FreeDictionaryAPI.getInstance();
    const gt = GoogleTranslate.getInstance(Language.en, Language.zh);
    const wordnik = Wordnik.getInstance();
    const linguee = Linguee.getInstance(Language.en, Language.fr);
    const linguee2 = Linguee.getInstance(Language.en, Language.zh);

    let word = await Word.of(raw, new Map()
        .set(fdapi, WordInfo.meaning - WordInfo.sens)
        .set(linguee2, WordInfo.translation + WordInfo.sens));
    printAll(word.possMeanings[0])
    let a = word.finalized(0, 0);
    printAll(a);

    const card = {'Front': 'abc', 'Back': 'def'};
    const card1 = {'Front': 'abc', 'Back': 'imposter'};
    const card2 = {'Front': 'abcasdf', 'Back': 'def'};
    const cards = [card, card2];
    // await anki.add(card);
    // console.log(await anki.listFront());
    // await anki.addAll([card]);
    // await anki.addAll(cards);

    // const actualCard: Card = toCard(a, Target.Anki);
    // console.log(actualCard)
    // const anki = await Anki.getInstance('asdf');
    // await anki.update(actualCard);

    const str = toString(a, Target.Discord);
    console.log(str)
}

main().then();