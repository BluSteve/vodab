import {Anki} from "./database/Anki";
import {Target, toCard} from "./WordConverter";
import {FreeDictionaryAPI} from "./services/FreeDictionaryAPI";
import {GoogleTranslate} from "./services/GoogleTranslate";
import {Language, WordInfo} from "./services/WordService";
import {Linguee} from "./services/Linguee";
import {Wordnik} from "./services/Wordnik";
import {Word} from "./Word";

async function main() {
    const raw = 'train';

    const fdapi = FreeDictionaryAPI.getInstance();
    const gt = GoogleTranslate.getInstance(Language.en, Language.zh);
    const wordnik = Wordnik.getInstance();
    const linguee = Linguee.getInstance(Language.en, Language.fr);
    const linguee2 = Linguee.getInstance(Language.en, Language.zh);

    let word = await Word.of(raw, new Map()
        .set(fdapi, undefined)
        .set(linguee, WordInfo.sens));
    word.select(0);
    let a = word.finalized();
    // printAll(a);

    const card = {'Front': 'abc', 'Back': 'def'};
    const card1 = {'Front': 'abc', 'Back': 'imposter'};
    const card2 = {'Front': 'abcasdf', 'Back': 'def'};
    const cards = [card, card2];
    const anki = await Anki.getInstance('Vodab Words');
    // await anki.add(card);
    // console.log(await anki.listFront());
    // await anki.addAll([card]);
    // await anki.addAll(cards);

    console.log(toCard(a, Target.Anki));
}

main().then();