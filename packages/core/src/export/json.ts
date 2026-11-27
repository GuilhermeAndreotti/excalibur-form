import type { AnswerInput, Form } from '../form.ts';
import { exportEntries } from './display.ts';

/**
 * Answers keyed by each field's `key` (default: its `id`), in schema order.
 * Values are the same as in `data` (option ids, not labels).
 */
export function toJSON(form: Form, data: AnswerInput): Record<string, unknown> {
	return Object.fromEntries(
		exportEntries(form, data)
			.filter((entry) => entry.answered)
			.map((entry) => [entry.key, entry.value]),
	);
}
