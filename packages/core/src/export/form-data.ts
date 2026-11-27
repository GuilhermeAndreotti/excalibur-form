import type { AnswerInput, Form } from '../form.ts';
import { exportEntries } from './display.ts';

function serialize(value: unknown): string {
	if (typeof value === 'string') return value;
	if (
		typeof value === 'number' ||
		typeof value === 'boolean' ||
		typeof value === 'bigint'
	) {
		return String(value);
	}
	return JSON.stringify(value) ?? '';
}

/**
 * Pares `[key, valor]` no formato de envio de formulário: listas viram uma
 * entrada por item (com a mesma chave), booleanos viram `"true"`/`"false"`.
 * Serve pra `URLSearchParams` também.
 */
export function toEntries(form: Form, data: AnswerInput): [string, string][] {
	const entries: [string, string][] = [];
	for (const entry of exportEntries(form, data)) {
		if (!entry.answered) continue;
		const values: unknown[] = Array.isArray(entry.value)
			? entry.value
			: [entry.value];
		for (const value of values) entries.push([entry.key, serialize(value)]);
	}
	return entries;
}

/** As mesmas entradas de `toEntries`, num `FormData` novo. */
export function toFormData(form: Form, data: AnswerInput): FormData {
	const formData = new FormData();
	for (const [key, value] of toEntries(form, data)) {
		formData.append(key, value);
	}
	return formData;
}
