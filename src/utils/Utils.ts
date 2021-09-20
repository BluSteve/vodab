import Jimp = require("jimp");

export function urlify(str: string): string {
    return str.replace(/ /g, '%20')
}

export function arrayUnique(a: string[], fuzzy?: boolean) {
    for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
            let condition: boolean;
            if (fuzzy) {
                const levenshtein = require('js-levenshtein');
                condition = levenshtein(a[i], a[j]) < 10;
            }
            else condition = a[i] === a[j];

            if (condition) a.splice(j--, 1);
        }
    }
    return a;
}

export function clone(array: any[]) {
    return JSON.parse(JSON.stringify(array));
}

export function printAll(a) {
    console.log(JSON.stringify(a, null, 2));
}

export function sortAlphabetical(strs: string[]) {
    return strs.sort((a, b) => a.localeCompare(b, undefined,
        {sensitivity: 'base'}));
}

export class Pair<F, S> {
    first: F;
    second: S;

    constructor(first: F, second: S) {
        this.first = first;
        this.second = second;
    }
}

export function stringListify(message: string, delimiter: string): string[] {
    let res: string[] = message.split(delimiter);
    for (let i = 0; i < res.length; i++) {
        res[i] = res[i].trim();
    }
    return res;
}

export async function invertImage(filename: string) {
    const image = await Jimp.read(filename);
    await image.grayscale().invert().write(filename);
}