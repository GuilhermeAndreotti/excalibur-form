// The core depends on neither the DOM nor @types/node; it declares only what
// it uses and what exists in both environments.
declare class URL {
	constructor(url: string, base?: string);
	readonly protocol: string;
}

declare class FormData {
	constructor();
	append(name: string, value: string): void;
}
