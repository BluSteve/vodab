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
    public transSens?: SentencePair[];
}

export class SentencePair {
    public src: string;
    public dst: string;
}

export class BasicWord {
    public text: string;
    public meaning?: Meaning = {};
    public translation?: Translation = {};
}

export class FinalizedWord extends BasicWord {
    public manualPos: string;
}

export class Word extends BasicWord {
    public urlable: string;
    public rawInput: string;
    public manualPos: string;

    public possTranslations: Translation[] = [];
    public possMeanings: Meaning[] = [];

    public isPendingSel: boolean = true;

    private constructor(rawInput: string) {
        super();
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

    public select(mindex?: number, tindex?: number): void {
        if (mindex >= this.possMeanings.length ||
            tindex >= this.possTranslations.length) {
            throw new Error('Invalid meaning/translation selection!');
        }

        if (mindex >= 0) this.meaning = this.possMeanings[mindex];
        if (tindex >= 0) this.translation = this.possTranslations[tindex];
        if (mindex >= 0 || tindex >= 0) this.isPendingSel = false;
    }

    public finalized(mindex?: number, tindex?: number, limit = 5,
                     senCharLimit = 150): FinalizedWord {
        this.select(mindex, tindex);

        if (this.isPendingSel) {
            throw new Error('Word cannot be finalized before selection!');
        }

        const wCopy: FinalizedWord = {
            text: this.text,
            meaning: this.meaning,
            translation: this.translation,
            manualPos: this.manualPos
        }

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