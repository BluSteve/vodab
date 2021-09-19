import {WordService} from "./services/WordService";
import {clone, urlify} from "./utils/Utils";

export enum MT {
    Meaning, Translation
}

export class Meaning {
    public def?: string;
    public ipa?: string;
    public pos?: string;
    public syns?: string[];
    public sens?: string[];
    public ety?: string;
}

export class Translation {
    public trans?: string;
    public transSens?: TranslatedSentence[];
}

export class TranslatedSentence {
    public src: string;
    public dst: string;
}

export class FinalizedWord {
    public text: string;
    public manualPos?: string;
    public meaning?: Meaning;
    public translation?: Translation;
}

export class Word {
    public text: string;
    public urlable: string;
    public rawInput: string;
    public manualPos: string;

    public possTranslations: Translation[] = [];
    public possMeanings: Meaning[] = [];

    private constructor(rawInput: string) {
        this.rawInput = rawInput;
        this.urlable = urlify(rawInput);
        this.text = rawInput; // temporary until canonalization
    }

    public static async of(rawWordInput: string, req: Map<WordService, number>,
                           manualPos?: string): Promise<Word> {
        const word: Word = new this(rawWordInput);
        word.manualPos = manualPos;

        if (req) {
            for (let [service, value] of req) {
                const before = Date.now();
                await service.process(word, value);
                const elapsed = Date.now() - before;
                console.log(service.constructor.name, elapsed);
            }
        }
        return word;
    }

    public finalized(mindex?: number, tindex?: number, limit = 5,
                     senCharLimit = 150): FinalizedWord {
        if (mindex >= this.possMeanings.length ||
            tindex >= this.possTranslations.length) {
            throw new Error('Invalid meaning/translation selection!');
        }

        const fw: FinalizedWord = {
            text: this.text,
            manualPos: this.manualPos
        }

        if (mindex === undefined) mindex = 0;
        if (tindex === undefined) tindex = 0;
        if (mindex >= 0) fw.meaning = this.possMeanings[mindex];
        if (tindex >= 0) fw.translation = this.possTranslations[tindex];

        // Function to filter sentences to be preferably below a length limit.
        // Will default to shortest sentences if not enough to fill the quota.
        const filterSens = (sens: any[], len: Function) => {
            const temp = sens.filter(i => len(i) < senCharLimit)
                .slice(0, limit);

            let senCount = temp.length;
            if (senCount < limit) {
                temp.push(...sens.sort((a, b) => len(a) - len(b))
                    .slice(senCount, limit));
            }

            return clone(temp);
        }

        if (fw.meaning) {
            if (fw.meaning.sens) {
                fw.meaning.sens =
                    filterSens(fw.meaning.sens, i => i.length);
            }

            if (fw.meaning.syns) {
                fw.meaning.syns =
                    clone(fw.meaning.syns.slice(0, limit));
            }
        }

        if (fw.translation && fw.translation.transSens) {
            fw.translation.transSens =
                filterSens(fw.translation.transSens, i => i.src.length);
        }

        return fw;
    }
}