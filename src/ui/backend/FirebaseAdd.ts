import firebase from 'firebase/app';
import 'firebase/firestore'
import {firebaseConfig} from "../UIConfig";
import {sha256} from "js-sha256";
import {Card, CardDatabase, CardNotFoundError} from "./CardDatabase";

export const FIREBASE_WORDS = 'words';
export const FIREBASE_OTHERS = 'others';

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

export class FirebaseHandler implements CardDatabase{
    private readonly userId: string;
    private readonly colName: string;
    private prev: Card[];
    private doc;

    private constructor(userId: string, colName: string) {
        this.userId = userId;
        if (colName !== FIREBASE_WORDS && colName !== FIREBASE_OTHERS) {
            throw new Error('Invalid collection name!');
        } else this.colName = colName;
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

    public async find(Front: string): Promise<Card | undefined>{
        let filtered = this.prev.filter(item => {
            return item.Front === Front;
        });

        if (filtered.length > 0) {
            if (filtered.length > 1) {
                throw new Error('Duplicate found in firebase!');
            } else return filtered[0];
        }
        else return undefined;
    }

    public async listFront(): Promise<string[]> {
        return this.prev.map(item => item.Front).sort(
            (a, b) => a.localeCompare(b, undefined,
                {sensitivity: 'base'}));
    }

    public getList(): Card[] {
        return this.prev.sort(
            (a, b) => a.Front.localeCompare(b.Front, undefined,
                {sensitivity: 'base'}));
    }

    public async info(Front: string): Promise<string> {
        let f = await this.find(Front);
        return f ? f.Back : '';
    }

    public async delete(Front: string): Promise<void> {
        let prevLength = this.prev.length;
        this.prev = this.prev.filter(item => {
            //return item.Front !== Front;
        });
        if (prevLength === this.prev.length) throw new CardNotFoundError(Front);;
        await this.doc.set({[this.colName]: this.prev}, {'merge': true});
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

    public async add(card: Card): Promise<void> {

        this.doc.update({'words':firebase.firestore.FieldValue.arrayUnion(card)});

    }

    public async addAll(cards: Card[]): Promise<void> {
        for(let i of cards) {
            await this.add(i);
        }
    }

    public async list(): Promise<Card[]> {
        let cards:Card[] = [];
        this.doc.get().then((doc) => {
            if (doc.exists) {
                console.log("exists");
                for (const [key, value] of Object.entries(doc.data())) {
                    for (const [key2, value2] of Object.entries(value)) {
                        for(const [frontorback, text] of Object.entries(value)){
                            let c = new Card();
                            if(frontorback == "Front"){
                                c.Front = text;
                            }
                            else{
                                c.Back = text;
                            }
                            cards.push(c);
                            console.log('added + ${c}');
                        }
                    }
                }
                return cards;

            } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
            }
        }).catch((error) => {
            console.log("Error getting document:", error);
        });
        return cards;
    }

    public async sync(): Promise<void> {
        return Promise.resolve(undefined);
    }

    public async update(card: Card): Promise<void> {
        let docRef = db.collection(this.userId).doc("words");
        let array = this.list().then();
        docRef.get().then(function(doc) {
            if (doc.exists) {
                for(let i in array){
                    if(array[i].Front===card.Front){
                        array[i]=card;
                    }
                }
                docRef.set(array);

            } else {
                // doc.data() will be undefined in this case
                console.log("No such document!");
            }
        }).catch(function(error) {
            console.log("Error getting document:", error);
        });
    }
}
