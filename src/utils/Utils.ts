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

export function printAll(a) {
    console.log(JSON.stringify(a, null, 2));
}