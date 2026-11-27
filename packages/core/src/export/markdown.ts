import type { AnswerInput, Form } from '../form.ts';
import { resolveText } from '../i18n.ts';
import { toQAList, type QAListOptions } from './qa-list.ts';

export interface MarkdownOptions extends Omit<
	QAListOptions,
	'includeSections'
> {
	/** Starts with the form title (`# title`). Default: `true`. */
	readonly title?: boolean;
	/** Includes `section` fields as `## title`. Default: `true`. */
	readonly includeSections?: boolean;
}

/**
 * Escapes user text so it shows up literally: no formatting, links or HTML
 * when the Markdown is rendered.
 */
export function escapeMarkdown(text: string): string {
	return text
		.replace(/[\\`*_[\]<>~|#&!]/g, '\\$&')
		.replace(/^(\s*)([-+=])/, '$1\\$2')
		.replace(/^(\s*\d{1,9})([.)])(?=\s|$)/, '$1\\$2');
}

/** Lines of a text, escaped, joined with hard line breaks. */
function block(text: string, indent: string): string {
	return text
		.split(/\r\n?|\n/)
		.map((line) => line.trim())
		.filter((line) => line !== '')
		.map(escapeMarkdown)
		.join(`\\\n${indent}`);
}

/**
 * Answers as Markdown, ready for an email or a report:
 *
 * ```md
 * # Inspection
 *
 * ## Vehicle
 *
 * - **Plate:** ABC1D23
 * - **Extras:** A/C, Sunroof
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
