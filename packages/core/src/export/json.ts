import type { AnswerInput, Form } from '../form.ts';
import { exportEntries } from './display.ts';

/**
 * Respostas indexadas pela `key` de cada campo (padrão: o `id`), na ordem do
 * schema. Os valores são os mesmos de `data` (ids das opções, não labels).
 */
export function toJSON(form: Form, data: AnswerInput): Record<string, unknown> {
	return Object.fromEntries(
		exportEntries(form, data)
			.filter((entry) => entry.answered)
			.map((entry) => [entry.key, entry.value]),
	);
}
