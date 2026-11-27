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
	/** Label do campo, resolvido no idioma pedido. */
	readonly question: string;
	/** Resposta legível (labels das opções, "Sim"/"Não"...). */
	readonly answer: string;
	/** Valor original, igual ao de `data`. `undefined` se não respondido. */
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
	/** Inclui campos visíveis sem resposta. Padrão: `false`. */
	readonly includeUnanswered?: boolean;
	/** Texto da resposta de campos sem resposta. Padrão: `''`. */
	readonly emptyAnswer?: string;
	/**
	 * Inclui as `section` como itens de título. Seções sem nenhuma resposta
	 * depois delas são omitidas. Padrão: `false`.
	 */
	readonly includeSections?: boolean;
}

/**
 * Lista pergunta/resposta legível, na ordem do schema. Boa pra tela de
 * resumo, email ou PDF.
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
