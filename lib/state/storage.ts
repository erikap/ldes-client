import { text } from "node:stream/consumers";
import { pipeline } from 'node:stream/promises';
import { Readable } from "node:stream";

interface Storage {
    getItem(key: string): Readable;

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
        getItem: (key: string): Readable => {
            if (fs.existsSync(key)) {
                return fs.createReadStream(key, { encoding: 'utf8' });
            } else {
                throw `File ${key} not found on disk`;
            }
        },
        setItem: async (key: string, value: Readable): Promise<void> => {
            await pipeline(value, fs.createWriteStream(key, { encoding: 'utf8' }));
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
        getItem: (key: string): Readable => {
            const data = localStorage.getItem(key);
            if (data) {
                return Readable.from([data]);
            } else {
                throw `Key ${key} not found in local storage`;
            }
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
