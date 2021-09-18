import firebase from 'firebase/app';
import 'firebase/firestore'
import {firebaseConfig} from "./config";
import {ANKI_WORDS, AnkiHandler} from "./AnkiAdd";

export const FIREBASE_WORDS = 'words';
export const FIREBASE_OTHERS = 'others';

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

export class Card {
    Front: string;
    Back: string;
}

export class FirebaseHandler {
    private readonly userId: string;
    private readonly colName: string;
    private prev: Card[];
    private doc;

    private constructor(userId: string, colName: string) {
        this.userId = userId;
        if (colName !== FIREBASE_WORDS && colName !== FIREBASE_OTHERS) {
            throw new Error('Invalid collection name!');
        }
        else this.colName = colName;
        this.initialize().then();
    }

    public static async create(userId: string, colName: string) {
        let fh = new FirebaseHandler(userId, colName);
        await fh.initialize();
        return fh;
    }

    private static arrayUnique(a: Card[]) {
        for (let i = 0; i < a.length; i++) {
            for (let j = i + 1; j < a.length; j++) {
                if (a[i].Front === a[j].Front) a.splice(j--, 1);
            }
        }
        return a;
    }

    public async save(Front: string, Back: string) {
        let parsed = JSON.parse(JSON.stringify({Front, Back}));
        if (this.prev) this.prev =
            this.prev.filter(item => item.Front !== Front);
        this.prev ? this.prev.push(parsed) : this.prev = [parsed];
        await this.doc.set({[this.colName]: this.prev}, {'merge': true});
    }

    public async saveMany(toAdd: Card[], override?: boolean) {
        let next = override ? toAdd :
            FirebaseHandler.arrayUnique(toAdd.concat(this.prev));
        await this.doc.set({[this.colName]: next}, {'merge': true});
    }

    public find(Front: string): Card {
        let filtered = this.prev.filter(item => {
            return item.Front === Front;
        });

        if (filtered.length > 0) {
            if (filtered.length > 1) {
                throw new Error('Duplicate found in firebase!');
            }
            else return filtered[0];
        }
        return null;
    }

    public listFront(): string[] {
        return this.prev.map(item => item.Front).sort(
                    (a, b) => a.localeCompare(b, undefined,
                        {sensitivity: 'base'}));
    }

    public getList(): Card[] {
        return this.prev.sort(
            (a, b) => a.Front.localeCompare(b.Front, undefined,
                {sensitivity: 'base'}));
    }

    public info(Front: string): string {
        let f = this.find(Front);
        return f ? f.Back : '';
    }

    public async delete(Front: string): Promise<boolean> {
        let prevLength = this.prev.length;
        this.prev = this.prev.filter(item => {
            return item.Front !== Front;
        });
        if (prevLength === this.prev.length) return false;
        await this.doc.set({[this.colName]: this.prev}, {'merge': true});
        return true;
    }

    public async updateBack(Front: string, Back: string): Promise<void> {
        this.prev = this.prev.filter(item => {
            return item.Front !== Front;
        });
        this.prev.push({Front, Back});
        await this.doc.set({[this.colName]: this.prev}, {'merge': true});
    }

    private async initialize(): Promise<void> {
        this.doc = db.collection('data').doc(this.userId);
        this.prev = (await this.doc.get()).get(this.colName);
        if (!this.prev) this.prev = [];
    }
}

async function main() {
    let ah = new AnkiHandler(ANKI_WORDS);
    let ankilist = await ah.list();
    let fh = await FirebaseHandler.create('324202540025643009', FIREBASE_WORDS);
    let toSave = [];
    for (const i of ankilist) {
        let item = {'Front': i.Front, 'Back': i.Back};
        toSave.push(item);
    }
    await fh.saveMany(toSave, true);
}