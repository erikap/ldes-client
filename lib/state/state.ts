import { JsonStreamStringify } from "json-stream-stringify";
import { Readable } from "node:stream";
import { storage } from "./storage";

export interface State {
    init(): Promise<void>;

    seen(id: string): boolean;

    filter<T>(ids: T[], getId: (item: T) => string): T[];

    add(id: string): void;

    save(): Promise<void>;
}

export class SimpleState implements State {
    state: Set<string>;
    location: string;

    constructor(location: string) {
        this.location = location;
        this.state = new Set();
    }

    async init() {
        // Loaad location into state, or default
        // Take into account nodejs and browser runtimes
        //
        // Setup on exit hooks
    }

    filter<T>(ids: T[], getId: (item: T) => string): T[] {
        return ids.filter(async (x) => !this.seen(getId(x)));
    }

    seen(id: string): boolean {
        return this.state.has(id);
    }

    add(id: string): void {
        this.state.add(id);
    }

    async save(): Promise<void> {
        // Save state into location
    }
}

export type FileStateFactoryItem<T> = {
    name: string;
    state: StateT<T>;
    serialize: (item: T) => Readable;
};

export interface StateFactory {
    build<T>(
        name: string,
        serialize: (item: T) => Readable,
        deserialize: (item: Readable) => Promise<T>,
        create: () => T,
    ): Promise<StateT<T>>;

    write(): Promise<void>;
}

export class NoStateFactory implements StateFactory {
    async build<T>(
        _name: string,
        _serialize: (item: T) => Readable,
        deserialize: (item: Readable) => Promise<T>,
        create: () => T,
    ): Promise<StateT<T>> {
        return new StateT<T>(create());
    }
    async write(): Promise<void> { }
}

export class FileStateFactory implements StateFactory {
    private location: string;
    private elements: FileStateFactoryItem<unknown>[];

    constructor(location: string) {
        this.location = location;
        this.elements = [];
    }

    locationForElement(name: string) {
      const i = this.location.lastIndexOf('.');
      if (i > 0) {
        return this.location.slice(0, i) + `-${name}` + this.location.slice(i);
      } else {
        return `${this.location}-${name}`
      }
    }

    async write(): Promise<void> {
        const out: { [label: string]: Readable } = {};
        for (const element of this.elements) {
            const stream = element.serialize(element.state.item);
            const elementLocation = this.locationForElement(element.name);
            stream.on('error', (err) => console.log(`Failed to serialize JSON stream to ${elementLocation}: ${err}`));
            stream.on('end', () => console.log(`Finished saving state for element ${element.name} to ${elementLocation}`));
            await storage.setItem(elementLocation, stream);
            // out[element.name] = stream;
        }

        // const jsonStream = new JsonStreamStringify(out);
        // jsonStream.on('error', (err: any, input: any, path: any) => console.log(`Failed to serialize JSON stream on path ${path}: ${err}`));
        // jsonStream.on('end', () => console.log('Finished serializing JSON'));
        // await storage.setItem(this.location, jsonStream);
    }

    async build<T>(
        name: string,
        serialize: (item: T) => Readable,
        deserialize: (item: Readable) => Promise<T>,
        create: () => T,
    ): Promise<StateT<T>> {
        const out = this.elements.find((x) => x.name == name);
        if (out) return <StateT<T>>out.state;

        const elementLocation = this.locationForElement(name);
        let stateItem: T;
        try {
          console.log(`Checking saved state for element ${name} at ${elementLocation}`);
          const found = storage.getItem(elementLocation);
          console.log(`Found saved state for element ${name} at ${elementLocation}`);
          stateItem = await deserialize(found);
          console.log(`Restored saved state for element ${name}`);
        } catch (ex) {
          console.log(`Something went wrong while restoring state for element ${name} at ${elementLocation}`);
          console.log(ex);
          stateItem = create();
          // pass
        }
        const state = new StateT<T>(stateItem);
        this.elements.push({
            name,
            serialize: <(item: unknown) => Readable>serialize,
            state,
        });

        return state;
    }
}

export class StateT<T> {
    item: T;
    constructor(item: T) {
        this.item = item;
    }
}
