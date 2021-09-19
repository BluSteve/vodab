import {
    APILimitExceededError,
    DefinitionError,
    getValidInfo,
    WordInfo,
    WordService
} from "./WordService";
import {Meaning, Word} from "../Word";
import axios from "axios";
import {arrayUnique, urlify} from "../../utils/Utils";
import {wordnikToken} from "../APIConfig";

export class Wordnik implements WordService {
    private static instance: Wordnik;
    paid = true;
    quota = 100;
    infoAvail = WordInfo.def + WordInfo.pos + WordInfo.sens;
    infoDefault = this.infoAvail;

    private constructor() {
    }

    public static getInstance(): Wordnik {
        if (!this.instance) return this.instance =
            new this();
        else return this.instance;
    }

    async process(word: Word, infoWanted?: number): Promise<void> {
        infoWanted = getValidInfo(this, infoWanted, word);

        const raw = word.urlable.toLocaleLowerCase();

        if (infoWanted & WordInfo.def + WordInfo.pos) {
            const url = `https://api.wordnik.com/v4/word.json/${raw}` +
                `/definitions?limit=10&sourceDictionaries=ahd-5%2Ccentury&api_key=${wordnikToken}`;
            const axiosResponse = await axios.get(url, {
                validateStatus: function () {
                    return true;
                }
            });
            if (axiosResponse) {
                if (axiosResponse.status === 404) {
                    throw new DefinitionError(word);
                }
                if (axiosResponse.status === 429) {
                    throw new APILimitExceededError(
                        "Wordnik API limit exceeded!");
                }

                const result: any[] = axiosResponse.data;

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
                if (response.status === 404) {
                    throw new DefinitionError(word);
                }
                if (response.status === 429) {
                    throw new APILimitExceededError(
                        "Wordnik API limit exceeded!");
                }

                let result = response.data;
                let sens: string[];
                if (!result.examples) sens = [];
                else {
                    sens = arrayUnique(result.examples.map(item => item.text),
                        true);
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