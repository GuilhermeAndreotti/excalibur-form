// O core não depende de DOM nem de @types/node; declara só o que usa e que
// existe nos dois ambientes.
declare class URL {
	constructor(url: string, base?: string);
	readonly protocol: string;
}

declare class FormData {
	constructor();
	append(name: string, value: string): void;
}
