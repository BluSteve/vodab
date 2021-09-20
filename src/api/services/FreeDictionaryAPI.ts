import {
    getValidInfo,
    WordInfo,
    WordService
} from "./WordService";
import {Meaning, Word} from "../Word";
import axios from "axios";

export class FreeDictionaryAPI implements WordService {
    private static instance: FreeDictionaryAPI;
    paid = false;
    quota = Infinity;
    infoAvail = WordInfo.meaning;
    infoDefault = this.infoAvail;

    private constructor() {
    }

    public static getInstance(): FreeDictionaryAPI {
        if (!this.instance) return this.instance =
            new this();
        else return this.instance;
    }

    async process(word: Word, infoWanted?: number): Promise<void> {
        infoWanted = getValidInfo(this, infoWanted, word);

        const url = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
        const response = await axios.get(url + word.urlable)
            .catch(() => {
            });

        if (response) {
            if (response.status !== 200) return;

            const result = response.data[0];

            word.text = result.word;

            // restrict their meanings based on manual pos
            let theirMeanings = word.manualPos ? result.meanings.filter(
                item => item.partOfSpeech === word.manualPos) : result.meanings;

            // nomenclature confusion
            for (const theirMeaning of theirMeanings) {
                for (const theirDef of theirMeaning.definitions) {
                    const myMeaning: Meaning = {};

                    if (infoWanted & WordInfo.def)
                        myMeaning.def = theirDef.definition;

                    if (infoWanted & WordInfo.ipa)
                        myMeaning.ipa = result.phonetic;

                    if (infoWanted & WordInfo.ety)
                        myMeaning.ety = result.origin;

                    if (infoWanted & WordInfo.pos)
                        myMeaning.pos = theirMeaning.partOfSpeech;

                    if (infoWanted & WordInfo.syns)
                        myMeaning.syns = theirDef.synonyms;

                    if (infoWanted & WordInfo.sens && theirDef.example)
                        myMeaning.sens = [theirDef.example];

                    word.possMeanings.push(myMeaning);
                }
            }
        }
    }
}