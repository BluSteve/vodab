import {getValidInfo, Language, WordInfo, WordService} from "./WordService";
import {Word} from "../Word";
import {Translate} from "@google-cloud/translate/build/src/v2";

export class GoogleTranslate implements WordService {
    private static instances: Map<Language[], GoogleTranslate> = new Map();
    paid = true;
    quota = 1666;
    infoAvail = WordInfo.trans;
    srclang: Language;
    dstlang: Language;

    private constructor(srclang: Language, dstlang: Language) {
        this.srclang = srclang;
        this.dstlang = dstlang;
    }

    public static getInstance(srclang: Language, dstlang: Language): GoogleTranslate {
        const langs = [srclang, dstlang];
        if (!this.instances.get(langs)) {
            this.instances.set(langs, new this(srclang, dstlang));
        }
        return this.instances.get(langs);
    }

    async process(word: Word, infoWanted: number): Promise<void> {
        infoWanted = getValidInfo(this, infoWanted, word);

        const projectId = 'vodab-322711';
        const keyFilename = 'src/api/services/key.json';
        const translate = new Translate({projectId, keyFilename});

        let fsrc: string = this.convertLanguage(this.srclang);
        let fdst: string = this.convertLanguage(this.dstlang);

        let ts = await translate.translate(word.text, {
            'from': fsrc,
            'to': fdst
        }).catch(v => {
            console.log(v);
        });

        if (ts) word.possTranslations.push({trans: ts[0]});
    }

    convertLanguage(l: Language): string {
        if (l === Language.zh) return 'zh-CN';
        else return l;
    }
}