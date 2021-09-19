import {Target, toString} from "./ui/frontend/WordConverter";
import {FreeDictionaryAPI} from "./api/services/FreeDictionaryAPI";
import {GoogleTranslate} from "./api/services/GoogleTranslate";
import {Language, WordInfo} from "./api/services/WordService";
import {Linguee} from "./api/services/Linguee";
import {Wordnik} from "./api/services/Wordnik";
import {Word} from "./api/Word";
import {printAll} from "./utils/Utils";

async function main() {
    const raw = 'forlorn';

    const fdapi = FreeDictionaryAPI.getInstance();
    const gt = GoogleTranslate.getInstance(Language.en, Language.zh);
    const wordnik = Wordnik.getInstance();
    const linguee = Linguee.getInstance(Language.en, Language.fr);
    const linguee2 = Linguee.getInstance(Language.en, Language.zh);

    let word = await Word.of(raw, [
        [FreeDictionaryAPI.getInstance(),
            WordInfo.meaning],
        [Wordnik.getInstance(),
            WordInfo.def + WordInfo.pos + WordInfo.sens],
        [Linguee.getInstance(Language.en, Language.zh),
            WordInfo.translation + WordInfo.sens]]);
    let a = word.finalized(0, 0);
    printAll(word);

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