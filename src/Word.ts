import {WordError, WordService} from "./services/WordService";
import {printAll} from "./utils/Utils";

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
    public meaning: Meaning;
    public translation?: Translation;
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

    public finalized(limit = 5, senCharLimit = 150): BasicWord {
        if (this.isPendingSel) {
            throw new Error('Word cannot be finalized before selection!');
        }

        const wcopy: BasicWord = {
            text: this.text,
            meaning: this.meaning,
            translation: this.translation
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

        if (wcopy.meaning) {
            if (wcopy.meaning.sens) {
                wcopy.meaning.sens =
                    filterSens(wcopy.meaning.sens, i => i.length);
            }

            if (wcopy.meaning.syns) {
                wcopy.meaning.syns =
                    wcopy.meaning.syns.slice(0, limit);
            }
        }

        if (wcopy.translation && wcopy.translation.transSens) {
            wcopy.translation.transSens =
                filterSens(wcopy.translation.transSens, i => i.src.length);
        }

        return wcopy;
    }

    public select(mindex: number, tindex: number): void {
        this.meaning = this.possMeanings[mindex];
        this.translation = this.possTranslations[tindex];
        this.isPendingSel = false;
    }

    public getFront(): string {
        return this.manualPos ? this.text + ' (' + this.manualPos + ')' :
            this.text;
    }

    public getBack(): string {
        let Back: string = '';
        if (this.meaning.ipa) Back += this.meaning.ipa + '<br><br>';
        if (this.manualPos) Back += this.manualPos + '<br><br>';
        Back += this.meaning.def;
        if (this.translation) Back += '<br><br>' + this.translation.trans;
        if (this.meaning.sens.length > 0) Back +=
            '<br><br><ul><li>' + this.meaning.sens.join('</li><li>') +
            '</li></ul>';
        if (this.meaning.sens.length === 0) Back += '<br>';
        if (this.meaning.syns.length > 0) Back +=
            '<br>' + this.meaning.syns.slice(0, 5).join(', ');
        if (this.meaning.ety) Back += '<br><br>' + this.meaning.ety;
        return Back;
    }
}