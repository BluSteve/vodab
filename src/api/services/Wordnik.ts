import {
    APILimitExceededError,
    getValidInfo,
    WordInfo,
    WordService
} from "./WordService";
import {Meaning, Word} from "../Word";
import axios from "axios";
import {urlify} from "../../utils/Utils";
import {wordnikToken} from "../APIConfig";

export class Wordnik implements WordService {
    private static instance: Wordnik;
    paid = false;
    quota = 100;
    infoAvail = WordInfo.def + WordInfo.pos + WordInfo.sens;

    private constructor() {
    }

    public static getInstance(): Wordnik {
        if (!this.instance) return this.instance =
            new this();
        else return this.instance;
    }

    async process(word: Word, infoWanted: number): Promise<void> {
        infoWanted = getValidInfo(this, infoWanted, word);

        const raw = word.urlable.toLocaleLowerCase();

        if (infoWanted & WordInfo.def + WordInfo.pos) {
            const url = `https://api.wordnik.com/v4/word.json/${raw}` +
                `/definitions?useCanonical=true&api_key=${wordnikToken}`;
            const response = await axios.get(url).catch(() => {
            });

            if (response) {
                if (response.status === 429) {
                    throw new APILimitExceededError(
                        "Wordnik API limit exceeded!");
                }
                else if (response.status !== 200) return;

                const result: any[] = word.manualPos ? response.data.filter(
                        item => item.partOfSpeech === word.manualPos) :
                    response.data;

                // sometimes the text is unavailable (api bug?)
                word.possMeanings.push(...
                    result.filter(item => item.text).map(item => {
                        let meaning: Meaning = {};

                        if (infoWanted & WordInfo.def) {
                            meaning.def =
                                item.text + ' (' + item.sourceDictionary + ')';
                        }

                        if (infoWanted & WordInfo.pos) {
                            meaning.pos = item.partOfSpeech;
                        }

                        return meaning;
                    }));
            }
        }

        if (infoWanted & WordInfo.sens) {
            const url = `https://api.wordnik.com/v4/word.json/${urlify(
                    word.text)}` +
                `/examples?api_key=${wordnikToken}`;
            const response = await axios.get(url, {
                validateStatus: function () {
                    return true;
                }
            });
            if (response) {
                if (response.status === 429) {
                    throw new APILimitExceededError(
                        "Wordnik API limit exceeded!");
                }
                else if (response.status !== 200) return;

                let result = response.data;
                let sens: string[];
                if (!result.examples) sens = [];
                else {
                    sens = result.examples.map(item => item.text);
                }

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
        }
    }
}