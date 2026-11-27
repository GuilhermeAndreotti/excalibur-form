import type { AnswerInput, Form } from '../form.ts';
import {
	createDisplayContext,
	displayAnswer,
	exportEntries,
	type DisplayOptions,
} from './display.ts';

export interface QAAnswer {
	readonly kind: 'answer';
	readonly fieldId: string;
	readonly key: string;
	readonly type: string;
	/** Field label, resolved in the requested language. */
	readonly question: string;
	/** Readable answer (option labels, "Yes"/"No"...). */
	readonly answer: string;
	/** Original value, same as in `data`. `undefined` if unanswered. */
	readonly value: unknown;
	readonly answered: boolean;
}

export interface QASection {
	readonly kind: 'section';
	readonly fieldId: string;
	readonly title: string;
	readonly description?: string;
}

export type QAItem = QAAnswer | QASection;

export interface QAListOptions extends DisplayOptions {
	/** Includes visible fields with no answer. Default: `false`. */
	readonly includeUnanswered?: boolean;
	/** Answer text for unanswered fields. Default: `''`. */
	readonly emptyAnswer?: string;
	/**
	 * Includes `section` fields as heading items. Sections with no answers
	 * after them are skipped. Default: `false`.
	 */
	readonly includeSections?: boolean;
}

/**
 * Readable question/answer list, in schema order. Good for a summary
 * screen, an email or a PDF.
 */
export function toQAList(
	form: Form,
	data: AnswerInput,
	options: QAListOptions = {},
): QAItem[] {
	const context = createDisplayContext(options);
	const includeUnanswered = options.includeUnanswered === true;
	const answers = new Map<string, QAAnswer>();
	for (const entry of exportEntries(form, data)) {
		if (!entry.answered && !includeUnanswered) continue;
		answers.set(entry.field.id, {
			kind: 'answer',
			fieldId: entry.field.id,
			key: entry.key,
			type: entry.field.type,
			question: context.text(entry.field.label),
			answer: entry.answered
				? displayAnswer(entry, context)
				: (options.emptyAnswer ?? ''),
			value: entry.value,
			answered: entry.answered,
		});
	}

	const visible = form.visibleFieldIds(data);
	const items: QAItem[] = [];
	let pendingSection: QASection | undefined;
	for (const field of form.schema.fields) {
		const answer = answers.get(field.id);
		if (answer !== undefined) {
			if (pendingSection !== undefined) items.push(pendingSection);
			pendingSection = undefined;
			items.push(answer);
		} else if (
			options.includeSections === true &&
			field.type === 'section' &&
			visible.has(field.id)
		) {
			const title = context.text(field.label);
			pendingSection =
				field.description === undefined
					? { kind: 'section', fieldId: field.id, title }
					: {
							kind: 'section',
							fieldId: field.id,
							title,
							description: context.text(field.description),
						};
		}
	}
	return items;
}
