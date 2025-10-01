import { text } from "node:stream/consumers";
import { pipeline } from 'node:stream/promises';
import { Readable } from "node:stream";

interface Storage {
    getItem(key: string): string;

    setItem(key: string, value: Readable): Promise<void>;

    removeItem(key: string): void;
}

let storage: Storage;

if (typeof window === "undefined") {
    // Node.js environment
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    let fs: any;
    if (typeof require === "undefined") {
        import("fs").then((mod) => (fs = mod));
    } else {
        /* eslint-disable  @typescript-eslint/no-require-imports */
        fs = require("fs");
    }

    storage = {
        getItem: (key: string): string => {
            const data = fs.readFileSync(key, "utf8");
            return data;
        },
        setItem: async (key: string, value: Readable): Promise<void> => {
            await pipeline(value, fs.createWriteStream(key));
        },
        removeItem: (key: string) => {
            try {
                fs.unlinkSync(key);
            } catch (error) {
                // Handle error
            }
        },
    };
} else {
    // Browser environment
    storage = {
        getItem: (key: string): string => {
            const data = localStorage.getItem(key);
            if (data) return data;
            throw "Key not found in local storage";
        },
        setItem: async (key: string, value: Readable): Promise<void> => {
            const valueString = await text(value);
            localStorage.setItem(key, valueString);
        },
        removeItem: (key: string) => {
            localStorage.removeItem(key);
        },
    };
}

export { storage };
