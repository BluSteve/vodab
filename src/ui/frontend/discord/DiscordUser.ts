// stores persistent info on the user
import {Anki, ANKI_WORDS} from "../../backend/Anki";
import {CardDatabase} from "../../backend/CardDatabase";
import {adminId} from "../../UIConfig";
import {MessageHandler} from "./MessageHandler";
import {ServiceRequest} from "../../../api/Word";
import {Language, WordInfo} from "../../../api/services/WordService";
import {FreeDictionaryAPI} from "../../../api/services/FreeDictionaryAPI";
import {Wordnik} from "../../../api/services/Wordnik";
import {Linguee} from "../../../api/services/Linguee";
import {GoogleTranslate} from "../../../api/services/GoogleTranslate";
import {WordsAPI} from "../../../api/services/WordsAPI";

export class UserSettings {
    readingMode: boolean = false;
    darkMode: boolean = false;
    deckName: string = ANKI_WORDS;
    senLimit: number = 5;
    senCharLimit: number = 250;
    toLanguage: Language = Language.zh;
    basicReq: ServiceRequest[] = [
        [FreeDictionaryAPI.getInstance(), WordInfo.meaning],
        [Wordnik.getInstance(), WordInfo.sens],
        [GoogleTranslate.getInstance(Language.en, this.toLanguage),
            WordInfo.trans]
    ];
    normalReq: ServiceRequest[] = [
        [FreeDictionaryAPI.getInstance(), WordInfo.meaning],
        [Wordnik.getInstance(), WordInfo.sens],
        [Linguee.getInstance(Language.en, this.toLanguage),
            WordInfo.translation]
    ];
    extendedReq: ServiceRequest[] = [
        [FreeDictionaryAPI.getInstance(), WordInfo.meaning],
        [WordsAPI.getInstance(), WordInfo.meaning - WordInfo.ety],
        [Wordnik.getInstance(), WordInfo.def + WordInfo.pos + WordInfo.sens],
        [Linguee.getInstance(Language.en, this.toLanguage),
            WordInfo.translation]
    ];
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
            MessageHandler.getInstance(message, this);
        if (messageHandler) await messageHandler.handleMessage();
    }
}