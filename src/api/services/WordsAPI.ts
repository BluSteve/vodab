import {getValidInfo, WordInfo, WordService} from "./WordService";
import {Meaning, Word} from "../Word";
import axios from "axios";
import {wordsapiHeaders} from "../APIConfig";

export class WordsAPI implements WordService {
    private static instance: WordsAPI;
    paid = true;
    quota = 100;
    infoAvail = WordInfo.meaning - WordInfo.ety;

    private constructor() {
    }

    public static getInstance(): WordsAPI {
        if (!this.instance) return this.instance = new this();
        else return this.instance;
    }

    async process(word: Word, infoWanted: number): Promise<void> {
        infoWanted = getValidInfo(this, infoWanted, word);

        const url = `https://wordsapiv1.p.rapidapi.com/words/${word.urlable}`
        const response = await axios.get(url, {headers: wordsapiHeaders})
            .catch(() => {
            });

        if (response) {
            if (response.status !== 200) return;
            const data = response.data;

            word.text = data.word;

            // restrict their meanings based on manual pos
            const results = word.manualPos ? data.results.filter(
                item => item.partOfSpeech === word.manualPos) : data.results;

            for (const result of results) {
                const meaning: Meaning = {};
                if (infoWanted & WordInfo.def) meaning.def =
                    result.definition + ' (wordsapi)';
                if (infoWanted & WordInfo.sens) meaning.sens = result.examples;
                if (infoWanted & WordInfo.pos) meaning.pos =
                    result.partOfSpeech;
                if (infoWanted & WordInfo.ipa) meaning.ipa =
                    data.pronunciation[result.partOfSpeech] ?
                        data.pronunciation[result.partOfSpeech] :
                        data.pronunciation.all;
                if (infoWanted & WordInfo.syns) meaning.syns = result.synonyms;

                word.possMeanings.push(meaning);
            }
        }
    }
}