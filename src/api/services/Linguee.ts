import {
    APILimitExceededError,
    getValidInfo,
    Language,
    WordInfo,
    WordService
} from "./WordService";
import {TranslatedSentence, Translation, Word} from "../Word";
import axios from "axios";

export class Linguee implements WordService {
    private static instances: Map<Language[], Linguee> = new Map();
    paid = false;
    quota = Infinity;
    infoAvail = WordInfo.translation + WordInfo.sens;
    srclang: Language;
    dstlang: Language;

    private constructor(srclang: Language, dstlang: Language) {
        this.srclang = srclang;
        this.dstlang = dstlang;
    }

    public static getInstance(srclang: Language, dstlang: Language): Linguee {
        const langs = [srclang, dstlang];
        if (!this.instances.get(langs)) {
            this.instances.set(langs, new this(srclang, dstlang));
        }
        return this.instances.get(langs);
    }

    static tidy(str: string): string {
        return str.replace(/\[\.\.\.] /g, '');
    }

    async process(word: Word, infoWanted: number): Promise<void> {
        const baseUrl = `https://vodab-linguee.herokuapp.com/`;

        infoWanted = getValidInfo(this, infoWanted, word);
        const wtext = word.urlable;

        const wantTrans: boolean = (infoWanted & WordInfo.translation) > 0;
        let lingueeTranslations: Translation[];
        if (wantTrans) lingueeTranslations = [];

        if (infoWanted & WordInfo.trans) {
            const url = `${baseUrl}api/v2/` +
                `translations?query=${wtext}&src=${this.srclang}&dst=${this.dstlang}`;
            const response = await axios.get(url).catch(error => {
                if (error.response.data.message ===
                    'The Linguee server returned 503') {
                    throw new APILimitExceededError(
                        'Linguee API limit exceeded!');
                }
            });

            if (response) {
                const result = response.data;
                for (let item of result) {
                    for (let ctrans of item.translations.slice(0, 5)) {
                        lingueeTranslations.push({trans: ctrans.text});
                    }
                }
            }
        }

        if (infoWanted & WordInfo.transSens + WordInfo.sens) {
            const url = `${baseUrl}api/v2/` +
                `external_sources?query=${wtext}&src=${this.srclang}&dst=${this.dstlang}`;
            const response = await axios.get(url)
                .catch(error => {
                    if (error.response.data.message ===
                        'The Linguee server returned 503') {
                        throw new APILimitExceededError(
                            'Linguee API limit exceeded!');
                    }
                });

            if (response) {
                const result = response.data;

                if (infoWanted & WordInfo.sens) {
                    let result = response.data;
                    let sens: string[] = result.map(
                        item => Linguee.tidy(item.src));

                    if (word.possMeanings.length === 0) {
                        word.possMeanings.push({sens});
                    }
                    else {
                        for (let meaning of word.possMeanings) {
                            if (!meaning.sens) meaning.sens = [];
                            meaning.sens.push(...sens);
                        }
                    }
                }

                if (infoWanted & WordInfo.transSens) {
                    if (result.length > 0) {
                        // case where translation fails but transSens works
                        if (lingueeTranslations.length === 0) {
                            lingueeTranslations.push(new Translation());
                        }

                        const transSens: TranslatedSentence[] = [];
                        for (let item of result) {
                            const sp: TranslatedSentence = {
                                src: Linguee.tidy(item.src),
                                dst: Linguee.tidy(item.dst)
                            };
                            if (this.dstlang === Language.zh) {
                                const converter = require('opencc-js')
                                    .Converter({'from': 'hk', to: 'cn'});
                                sp.dst = converter(sp.dst);
                                sp.dst = sp.dst.replace(/ /g, '');
                            }
                            transSens.push(sp);
                        }

                        for (let translation of lingueeTranslations) {
                            translation.transSens = transSens.slice(); // shallow copy
                        }
                        for (let prevTrans of word.possTranslations) {
                            prevTrans.transSens.push(...transSens);
                        }
                    }
                }
            }
        }

        if (wantTrans) {
            word.possTranslations.push(...lingueeTranslations);
        }
    }
}