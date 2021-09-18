export class Card {
    Front: string;
    Back: string;
}

export interface CardDatabase {
    // Card Front uniqueness is assumed

    add(card: Card): Promise<boolean>;

    update(card: Card): Promise<boolean>;

    find(Front: string): Promise<Card>;

    list(): Promise<Card[]>;

    delete(Front: string);
}

export class DatabaseError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'DatabaseError';
    }
}

export class CardNotFoundError extends DatabaseError {
    constructor(card: Card) {
        super(`"${card.Front}" not found!`);
        this.name = 'CardNotFoundError';
    }
}

export class DatabaseServerError extends DatabaseError {
    constructor(card: Card) {
        super(`Database Server errored for "${card.Front}"!`);
        this.name = 'DatabaseServerError';
    }
}