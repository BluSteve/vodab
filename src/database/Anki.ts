import {
    Card,
    CardDatabase,
    CardNotFoundError,
    DuplicateCardError
} from "./CardDatabase";

const version = 6;
const axios = require('axios').default;
const ankiurl = 'http://127.0.0.1:8765';
const modelName = 'Basic';

export const ANKI_WORDS = 'Vodab Words';
export const ANKI_OTHERS = 'Vodab Others';

export class Anki implements CardDatabase {
    private static instances: Map<string, Anki> = new Map();
    private static DECK_NOT_FOUND = 'deck was not found';
    private static DUPLICATE_NOTE = 'cannot create note because it is a duplicate';
    private readonly deckName: string;

    private constructor(deckName: string) {
        this.deckName = deckName;
    }

    public static async getInstance(deckName: string): Promise<Anki> {
        if (!this.instances.get(deckName)) {
            this.instances.set(deckName, new this(deckName));
        }

        const deckNames: string[] = (await axios.post(ankiurl, {
            'action': 'deckNames', version
        })).data.result;

        if (!deckNames.includes(deckName)) {
            await this.createDeck(deckName);
        }

        return this.instances.get(deckName);
    }

    private static async sync(): Promise<void> {
        await axios.post(ankiurl, {'action': 'sync', version});
        console.log('Anki synced!');
    }

    private static async createDeck(deck: string): Promise<void> {
        const action = 'createDeck';
        await axios.post(ankiurl, {
            action, version, 'params': {deck}
        });
    }

    public async add(card: Card): Promise<void> {
        const action = 'addNote';
        const response = await axios.post(ankiurl,
            {
                action, version, 'params': {
                    'note': {
                        'deckName': this.deckName,
                        modelName,
                        'fields': {
                            'Front': card.Front,
                            'Back': card.Back
                        },
                        'options': {
                            'allowDuplicate': false,
                            'duplicateScope': 'deck'
                        }
                    }
                }
            });

        const error: string = response.data.error;
        if (error) {
            if (error === Anki.DUPLICATE_NOTE) {
                throw new DuplicateCardError(card.Front);
            }
        }
    }

    public async addAll(cards: Card[]) {
        const action = 'addNotes';

        const notes: any[] = cards.map(card => {
            return {
                'deckName': this.deckName,
                modelName,
                'fields': {
                    'Front': card.Front,
                    'Back': card.Back
                },
                'options': {
                    'allowDuplicate': false,
                    'duplicateScope': 'deck'
                }
            }
        });

        const response = await axios.post(ankiurl, {
            action, version, 'params': {notes}
        });

        // If some of the cards are duplicate, they will not be added.
        // The backs of the pre-existing cards are not changed.

        const result: number[] = response.data.result;
        const erroredCards: Card[] = [];
        for (let i in result) {
            if (result[i] === null) {
                erroredCards.push(cards[i]);
            }
        }

        if (erroredCards.length > 0) {
            throw new DuplicateCardError(
                erroredCards.map(i => i.Front).join(', '));
        }
    }

    public async update(card: Card): Promise<void> {
        const action = 'updateNoteFields';
        const id = await this.findID(card.Front);
        await axios.post(ankiurl,
            {
                action, version, 'params': {
                    'note': {
                        id,
                        'fields': {'Back': card.Back}
                    }
                }
            });
    }

    public async find(Front: string): Promise<Card> {
        let notes = [await this.findID(Front)];

        const action = 'notesInfo';
        const response = await axios.post(ankiurl, {
            action, version, 'params': {notes}
        });

        const noteFound = response.data.result[0];
        return {
            'Front': noteFound.fields.Front.value,
            'Back': noteFound.fields.Back.value
        };
    }

    public async delete(Front: string): Promise<boolean> {
        try {
            let notes = [await this.findID(Front)];

            const action = 'deleteNotes';
            await axios.post(ankiurl, {
                action, version, 'params': {notes}
            });

            return true;
        } catch (error) {
            if (error instanceof CardNotFoundError) return false;
        }
    }

    public async list(): Promise<Card[]> {
        let action = 'findNotes';
        let response = await axios.post(ankiurl, {
            action, version, 'params': {
                'query': `deck:"${this.deckName}"`
            }
        });
        let notes = response.data.result;
        action = 'notesInfo';
        response = await axios.post(ankiurl, {
            action, version, 'params': {notes}
        });
        return response.data.result.map(item => {
            return {
                'Front': item.fields.Front.value,
                'Back': item.fields.Back.value
            }
        });
    }

    public async listFront(): Promise<string[]> {
        return (await this.list()).map(card => card.Front);
    }

    private async findID(Front: string): Promise<number> {
        let action = 'findNotes';
        let response = await axios.post(ankiurl, {
            action, version, 'params': {
                'query': `front:"${Front}" deck:"${this.deckName}"`
            }
        });

        const noteIDsFound = response.data.result;
        if (noteIDsFound.length === 0) throw new CardNotFoundError(Front);
        else if (noteIDsFound.length > 1) throw new DuplicateCardError(Front);

        return noteIDsFound[0];
    }
}
