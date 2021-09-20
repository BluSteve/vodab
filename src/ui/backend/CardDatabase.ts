// general purpose card
export class Card {
    Front: string;
    Back: string;
}

export interface CardDatabase {
    // Card Front uniqueness is assumed

    add(card: Card): Promise<void>;

    addAll(cards: Card[]): Promise<void>;

    // fails loudly
    update(card: Card): Promise<void>;

    // fails quietly
    find(Front: string): Promise<Card>;

    // fails loudly
    delete(Front: string): Promise<void>;

    list(): Promise<Card[]>;

    listFront(): Promise<string[]>;

    sync(): Promise<void>;
}

export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class CardNotFoundError extends DatabaseError {
    Front: string;

    constructor(Front: string) {
        super(`"${Front}" not found!`);
        this.Front = Front;
        this.name = 'CardNotFoundError';
    }
}

export class DuplicateCardError extends DatabaseError {
    Front: string;

    constructor(Front: string) {
        super(
            `Multiple cards with the same Front ("${Front}") are not allowed!`);
        this.Front = Front;
        this.name = 'DuplicateCardError';
    }
}

export class DatabaseServerError extends DatabaseError {
    constructor(database: CardDatabase, card: Card) {
        super(
            `${database.constructor.name} server errored for "${card.Front}"!`);
        this.name = 'DatabaseServerError';
    }
}