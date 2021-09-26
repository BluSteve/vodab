import {getValidInfo, WordInfo, WordService} from "./WordService";
import {Meaning, Word} from "../Word";
import axios from "axios";
import {websterKey} from "../APIConfig";
import {arrayUnique} from "../../utils/Utils";

export class MerriamWebster implements WordService {
    private static instance: MerriamWebster;
    paid = false;
    quota = 41;
    infoAvail = WordInfo.meaning - WordInfo.ipa;

    private constructor() {
    }

    public static getInstance(): MerriamWebster {
        if (!this.instance) return this.instance =
            new this();
        else return this.instance;
    }

    async process(word: Word, infoWanted: number): Promise<void> {
        infoWanted = getValidInfo(this, infoWanted, word);

        const url = `https://www.dictionaryapi.com/api/v3/references/collegiate/json/${
            word.urlable}?key=${websterKey}`;
        const response = await axios.get(url)
            .catch(() => {
            });

        if (response) {
            if (response.status !== 200) return;

            const results = word.manualPos ?
                response.data.filter(item => item.fl === word.manualPos) :
                response.data;

            // todo move word text to meaning
            // corner case handwaved
            // word.text = results[0].hwi.hw.replace(/\*/g, '');

            const dts = [];

            function pushDT(object, others) {
                if (object.fl) {
                    others.fl = object.fl;
                }
                if (object.et) {
                    others.et = object.et.filter(i => i[0] === 'text')[0][1];
                }
                if (object.syns) {
                    others.syns = object.syns.filter(
                        i => i.pl === 'synonyms')[0].pt.filter(
                        i => i[0] === 'text')[0][1];
                }
                if (object.dt) {
                    dts.push({
                        dt: object.dt,
                        fl: others.fl,
                        et: others.et,
                        syns: others.syns
                    });
                }

                for (let property in object) {
                    if (object.hasOwnProperty(property)) {
                        if (typeof object[property] == 'object') {
                            pushDT(object[property], others);
                        }
                    }
                }
            }

            pushDT(results, {});

            const meanings: Meaning[] = [];

            const noCurly: (string) => string = s => s.trim().replace(
                /\{[^}|]*\|(\p{L}*)[^}]*\}/gu, '$1').replace(/{[^}]+}/g, '');
            for (const dt of dts) {
                const meaning: Meaning = {};
                if (infoWanted & WordInfo.pos) meaning.pos = dt.fl;
                if (dt.et && infoWanted & WordInfo.ety) meaning.ety =
                    noCurly(dt.et);
                if (dt.syns && infoWanted & WordInfo.syns) meaning.syns =
                    arrayUnique(dt.syns.match(/\{sc\}(\p{L}*)\{\/sc\}/gu)
                        .map(i => noCurly(i)));
                if (infoWanted & WordInfo.def + WordInfo.sens) {
                    for (const param of dt.dt) {
                        if (param[0] === 'text') {
                            if (infoWanted & WordInfo.def)
                                meaning.def = noCurly(param[1]);
                        }
                        if (param[0] === 'vis') {
                            if (!meaning.sens) meaning.sens = [];
                            for (const pe of param[1]) {
                                if (infoWanted & WordInfo.sens)
                                    meaning.sens.push(noCurly(pe.t));
                            }
                        }
                        if (param[0] === 'uns') {
                            for (const pe of param[1]) {
                                for (const pee of pe) {
                                    if (pee[0] === 'text') {
                                        if (infoWanted & WordInfo.def)
                                            meaning.def +=
                                                '\n' + noCurly(pee[1]);
                                    }
                                    if (pee[0] === 'vis') {
                                        if (!meaning.sens) meaning.sens = [];
                                        for (const peee of pee[1]) {
                                            if (infoWanted & WordInfo.sens)
                                                meaning.sens.push(
                                                    noCurly(peee.t));
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                meaning.def += ' (mw)';
                meanings.push(meaning);
            }

            word.possMeanings.push(...meanings);
        }
    }
}