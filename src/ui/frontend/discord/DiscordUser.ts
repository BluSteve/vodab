// stores persistent info on the user
import {Anki, ANKI_WORDS} from "../../backend/Anki";
import {CardDatabase} from "../../backend/CardDatabase";
import {adminId} from "../../UIConfig";
import {MessageHandler} from "./MessageHandler";

export class UserSettings {
    readingMode: boolean = false;
    darkMode: boolean = false;
    deckName: string = ANKI_WORDS;
    senLimit: number = 5;
    senCharLimit: number = 150;
}

export class DiscordUser {
    static users: Map<string, DiscordUser> = new Map();
    userId: string;
    isAdmin: boolean;
    settings: UserSettings = new UserSettings();
    private db: CardDatabase | undefined; // lazy loaded on request

    private constructor(userId: string) {
        this.userId = userId;
        if (userId === adminId) {
            this.isAdmin = true;
        }
    }

    static getUser(userId: string): DiscordUser {
        if (!this.users.get(userId)) {
            this.users.set(userId, new this(userId));
        }
        return this.users.get(userId);
    }

    async getDB(): Promise<CardDatabase> {
        if (!this.db) await this.updateDB();
        return this.db;
    }

    async updateDB(): Promise<void> {
        if (this.isAdmin) {
            this.db = await Anki.getInstance(this.settings.deckName);
        }
        // todo add for non-admin
    }

    async handleMessage(message): Promise<void> {
        const messageHandler: MessageHandler =
            new MessageHandler(message, this);
        await messageHandler.handleMessage();
    }
}