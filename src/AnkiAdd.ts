import {Card} from "./FirebaseAdd";

const version = 6;
const axios = require('axios').default;
const ankiurl = 'http://127.0.0.1:8765';

export const ANKI_WORDS = 'Vodab Words';
export const ANKI_OTHERS = 'Vodab Others';

export class AnkiHandler {
    private readonly deckName: string;

    public constructor(deckName: string) {
        this.deckName = deckName;
    }

    public async add(Front: string, Back: string): Promise<void> {
        await this.createDeck();
        const action = 'addNote';
        const modelName = 'Basic';
        await axios.post(ankiurl,
            {
                action, version, 'params': {
                    'note': {
                        'deckName': this.deckName, modelName,
                        'fields': {Front, Back},
                        'options': {
                            'allowDuplicate': false,
                            'duplicateScope': 'deck'
                        }
                    }
                }
            });
    }

    public async createDeck(): Promise<void> {
        const action = 'createDeck';
        await axios.post(ankiurl, {
            action, version, 'params': {
                'deck': this.deckName
            }
        });
    }

    public async find(Front: string): Promise<number[]> {
        const action = 'findNotes';
        let response = await axios.post(ankiurl, {
            action, version, 'params': {
                'query': `front:"${Front}" deck:"${this.deckName}"`
            }
        });
        return response.data.result;
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
            return item.fields.Front.value;
        }).sort((a, b) => a.localeCompare(b, undefined,
                {sensitivity: 'base'}));
    }

    public async info(Front: string): Promise<string> {
        let notes = await this.find(Front);
        const action = 'notesInfo';
        let response = await axios.post(ankiurl, {
            action, version, 'params': {notes}
        });
        try {
            return response.data.result[0].fields.Back.value;
        } catch (ignored) {
            return '';
        }
    }

    public async delete(notes: number[]): Promise<void> {
        const action = 'deleteNotes';
        await axios.post(ankiurl, {
            action, version, 'params': {notes}
        });
    }

    public async updateBacks(ids: number[], Back: string): Promise<void> {
        const action = 'updateNoteFields';
        const id = ids[0];
        await axios.post(ankiurl,
            {
                action, version, 'params': {
                    'note': {
                        id,
                        'fields': {Back}
                    }
                }
            });
        await this.delete(ids.slice(1)); // keep only one copy
    }

    public async sync(): Promise<void> {
        await axios.post(ankiurl, {'action': 'sync', version});
        console.log('Anki synced!');
    }
}

export class DummyAnkiHandler extends AnkiHandler {
    public constructor() {
        super('');
    }

    async add(Front: string, Back: string): Promise<void> {
    }

    async createDeck(): Promise<void> {
    }

    async find(Front: string): Promise<number[]> {
        return [];
    }

    async list(): Promise<Card[]> {
        return null;
    }

    async info(Front: string): Promise<string> {
        return '';
    }

    async delete(notes: number[]): Promise<void> {
    }

    async updateBacks(ids: number[], Back: string): Promise<void> {
    }

    async sync(): Promise<void> {
    }
}