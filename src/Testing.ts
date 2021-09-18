import {Word} from "./Word";
import {FreeDictionaryAPI} from "./services/FreeDictionaryAPI";
import {printAll} from "./utils/Utils";
import {GoogleTranslate} from "./services/GoogleTranslate";
import {Language, WordInfo} from "./services/WordService";
import {Wordnik} from "./services/Wordnik";
import {Linguee} from "./services/Linguee";

async function main() {
    const raw = 'train';

    const fdapi = FreeDictionaryAPI.getInstance();
    const gt = GoogleTranslate.getInstance(Language.en, Language.zh);
    const wordnik = Wordnik.getInstance();
    const linguee = Linguee.getInstance(Language.en, Language.fr);
    const linguee2 = Linguee.getInstance(Language.en, Language.zh)

    let word = await Word.of(raw, new Map()
        .set(fdapi, undefined)
        .set(linguee, WordInfo.sens));
    word.select(0, 0);
    let a = word.finalized();
    printAll(a);
}

main().then();