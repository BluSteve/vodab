import {getValidInfo, WordError, WordInfo, WordService} from "./WordService";
import {Meaning, Word} from "../Word";
import axios from "axios";
import {rollId, rollSecret} from "../APIConfig";

export class RollToolsApi implements WordService {
    private static instance: RollToolsApi;
    paid = false;
    quota = Infinity;
    infoAvail = WordInfo.def | WordInfo.ipa;

    private constructor() {
    }

    public static getInstance(): RollToolsApi {
        if (!this.instance) return this.instance = new this();
        else return this.instance;
    }

    async process(word: Word, infoWanted: number): Promise<void> {
        infoWanted = getValidInfo(this, infoWanted, word);

        if (word.text.length > 1) {
            throw new WordError("RollToolsApi only supports single character words!");
        }
        const url = `https://www.mxnzp.com/api/convert/dictionary?content=${word.urlable}&app_id=${rollId}` +
            `&app_secret=${rollSecret}`;
        const response = await axios.get(url)
            .catch(() => {
            });

        if (response) {
            if (response.status !== 200) return;

            let rdata = response.data.data[0];
            console.log(rdata);
            const expl = rdata.explanation;
            const ipa = rdata.pinyin;

            const meaning: Meaning = {};
            if (infoWanted & WordInfo.def) meaning.def = expl;
            if (infoWanted & WordInfo.ipa) meaning.ipa = ipa;

            word.possMeanings.push(meaning);
        }
    }
}
