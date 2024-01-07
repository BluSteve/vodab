import Reverso = require('reverso-api');
import {Language, WordInfo, WordService} from "./WordService";
import {Word} from "../Word";

export class ReversoContext implements WordService {
    private static instances: Map<Language[], ReversoContext> = new Map();
    paid = false;
    quota = Infinity;
    infoAvail = WordInfo.translation + WordInfo.sens;
    srclang: Language;
    dstlang: Language;

    private constructor(srclang: Language, dstlang: Language) {
        this.srclang = srclang;
        this.dstlang = dstlang;
    }

    public static getInstance(srclang: Language, dstlang: Language): ReversoContext {
        const langs = [srclang, dstlang];
        if (!this.instances.get(langs)) {
            this.instances.set(langs, new this(srclang, dstlang));
        }
        return this.instances.get(langs);
    }

    async process(word: Word, infoWanted: number): Promise<void> {
        const reverso = new Reverso();
        const context = reverso.getContext(word.text, 'english', 'chinese');
        console.log(context);
    }
}

async function main() {
    const reverso = new Reverso();
    console.log(await reverso.getContext('rascality', 'english', 'chinese'));

}

main().then()
