import {WordService} from "./services/WordService";

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
    public meaning?: Meaning = {};
    public translation?: Translation = {};
    public manualPos: string;
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
        this.urlable = rawInput.replace(/ /g, '%20');
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

        const wCopy: FinalizedWord = {
            text: this.text,
            manualPos: this.manualPos
        }

        if (mindex >= 0) wCopy.meaning = this.possMeanings[mindex];
        if (tindex >= 0) wCopy.translation = this.possTranslations[tindex];

        const filterSens = (sens: any[], len: Function) => {
            const temp = sens.filter(i => len(i) < senCharLimit)
                .slice(0, limit);
            let senCount = temp.length;

            if (senCount < limit) {
                temp.push(...sens.sort((a, b) => len(a) - len(b))
                    .slice(senCount, limit));
            }

            return temp;
        }

        if (wCopy.meaning) {
            if (wCopy.meaning.sens) {
                wCopy.meaning.sens =
                    filterSens(wCopy.meaning.sens, i => i.length);
            }

            if (wCopy.meaning.syns) {
                wCopy.meaning.syns =
                    wCopy.meaning.syns.slice(0, limit);
            }
        }

        if (wCopy.translation && wCopy.translation.transSens) {
            wCopy.translation.transSens =
                filterSens(wCopy.translation.transSens, i => i.src.length);
        }

        return wCopy;
    }
}