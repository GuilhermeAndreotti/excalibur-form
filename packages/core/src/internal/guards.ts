export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function hasOwn(obj: object, key: string): boolean {
	return Object.hasOwn(obj, key);
}

/** Reads an own property; ignores anything from the prototype (`constructor`, `__proto__`...). */
export function ownValue(obj: Record<string, unknown>, key: string): unknown {
	return hasOwn(obj, key) ? obj[key] : undefined;
}

export type StripUndefined<T> = {
	[K in keyof T as undefined extends T[K] ? never : K]: T[K];
} & {
	[K in keyof T as undefined extends T[K] ? K : never]?: Exclude<
		T[K],
		undefined
	>;
};

/** Drops keys set to `undefined` (needed with `exactOptionalPropertyTypes`). */
export function stripUndefined<T extends object>(obj: T): StripUndefined<T> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) out[key] = value;
	}
	return out as StripUndefined<T>;
}

export function deepFreeze<T>(value: T): T {
	if (
		typeof value === 'object' &&
		value !== null &&
		!Object.isFrozen(value)
	) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}
