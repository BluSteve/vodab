import {Word} from "../Word";

export interface WordService {
    readonly paid: boolean;
    readonly quota: number; // per hour
    readonly infoAvail: number;

    process(word: Word, infoWanted: number): Promise<void>;
}

/**
 * Means something went wrong with that word in particular, not the code.
 */
export class WordError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'WordError';
    }
}

export class APILimitExceededError extends WordError {
    constructor(message?: string) {
        super(message);
        this.name = 'APILimitExceededError';
    }
}

export class InfoError extends Error {
    constructor(word: Word) {
        super(`Invalid info request for "${word.rawInput}"!`);
        this.name = 'InfoError';
    }
}

export enum WordInfo {
    def = 1,
    sens = 1 << 1,
    pos = 1 << 2,
    ipa = 1 << 3,
    syns = 1 << 4,
    ety = 1 << 5,
    trans = 1 << 6,
    transSens = 1 << 7,
    meaning = def + pos + ipa + sens + syns + ety,
    translation = trans + transSens
}

export enum Language {
    zh = 'zh',
    en = 'en',
    fr = 'fr',
    es = 'es',
    pt = 'pt',
    de = 'de'
}

export enum POS {
    noun = 'noun',
    verb = 'verb',
    adverb = 'adverb',
    adjective = 'adjective',
    conjunction = 'conjunction',
    pronoun = 'pronoun',
    preposition = 'preposition',
    interjection = 'interjection',
    determiner = 'determiner'
}

export function getValidInfo(ws: WordService, infoWanted: number,
                             word?: Word): number {
    if ((infoWanted | ws.infoAvail) !== ws.infoAvail) {
        throw new InfoError(word);
    }
    return infoWanted;
}