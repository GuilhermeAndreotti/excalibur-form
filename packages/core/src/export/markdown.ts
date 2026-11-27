import type { AnswerInput, Form } from '../form.ts';
import { resolveText } from '../i18n.ts';
import { toQAList, type QAListOptions } from './qa-list.ts';

export interface MarkdownOptions extends Omit<
	QAListOptions,
	'includeSections'
> {
	/** Começa com o título do form (`# título`). Padrão: `true`. */
	readonly title?: boolean;
	/** Inclui as `section` como `## título`. Padrão: `true`. */
	readonly includeSections?: boolean;
}

/**
 * Escapa texto vindo de usuário pra ele aparecer literal: sem formatação,
 * links ou HTML quando o Markdown for renderizado.
 */
export function escapeMarkdown(text: string): string {
	return text
		.replace(/[\\`*_[\]<>~|#&!]/g, '\\$&')
		.replace(/^(\s*)([-+=])/, '$1\\$2')
		.replace(/^(\s*\d{1,9})([.)])(?=\s|$)/, '$1\\$2');
}

/** Linhas de um texto, escapadas, unidas com quebra de linha forçada. */
function block(text: string, indent: string): string {
	return text
		.split(/\r\n?|\n/)
		.map((line) => line.trim())
		.filter((line) => line !== '')
		.map(escapeMarkdown)
		.join(`\\\n${indent}`);
}

/**
 * Respostas em Markdown, prontas pra email ou relatório:
 *
 * ```md
 * # Vistoria
 *
 * ## Dados do veículo
 *
 * - **Placa:** ABC1D23
 * - **Opcionais:** Ar, Teto solar
 * ```
 */
export function toMarkdown(
	form: Form,
	data: AnswerInput,
	options: MarkdownOptions = {},
): string {
	const { title: withTitle = true, ...rest } = options;
	const items = toQAList(form, data, {
		emptyAnswer: '—',
		...rest,
		includeSections: options.includeSections !== false,
	});

	const parts: string[] = [];
	if (withTitle && form.schema.title !== undefined) {
		const title = block(
			resolveText(
				form.schema.title,
				options.locale,
				options.fallbackLocale,
			),
			'',
		);
		if (title !== '') parts.push(`# ${title}`);
	}

	let list: string[] = [];
	const flush = () => {
		if (list.length > 0) parts.push(list.join('\n'));
		list = [];
	};
	for (const item of items) {
		if (item.kind === 'section') {
			flush();
			parts.push(`## ${block(item.title, '')}`);
			if (item.description !== undefined && item.description !== '') {
				parts.push(block(item.description, ''));
			}
		} else {
			const answer = block(item.answer, '  ');
			list.push(
				`- **${block(item.question, '  ')}:**${answer === '' ? '' : ` ${answer}`}`,
			);
		}
	}
	flush();
	return parts.length === 0 ? '' : `${parts.join('\n\n')}\n`;
}
