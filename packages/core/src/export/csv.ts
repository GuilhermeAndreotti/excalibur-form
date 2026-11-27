import type { AnswerInput, Form } from '../form.ts';
import {
	createDisplayContext,
	displayAnswer,
	exportEntries,
	exportKey,
	type DisplayOptions,
} from './display.ts';

export interface CSVOptions extends DisplayOptions {
	/** Header with the field label or its `key`. Default: `'label'`. */
	readonly header?: 'label' | 'key';
	/**
	 * `'display'`: readable text (option labels, "Yes"/"No").
	 * `'raw'`: values as in `data` (ids, `true`/`false`). Default: `'display'`.
	 */
	readonly values?: 'display' | 'raw';
	/** Default: `','`. Use `';'` for Excel in locales with a decimal comma. */
	readonly delimiter?: string;
	/** Default: `'\r\n'` (RFC 4180). */
	readonly newline?: string;
	/** Starts with a UTF-8 BOM (Excel needs it for accents). Default: `false`. */
	readonly bom?: boolean;
	/**
	 * Prefixes text cells starting with `=`, `+`, `-`, `@`, tab or CR with
	 * `'`, so spreadsheets don't run them as formulas. Default: `true`.
	 */
	readonly escapeFormulas?: boolean;
}

const FORMULA_START = /^[=+\-@\t\r]/;

function rawCell(value: unknown, separator: string): string {
	if (value === undefined || value === null) return '';
	if (typeof value === 'string') return value;
	if (Array.isArray(value)) {
		return value
			.map((item: unknown) => rawCell(item, separator))
			.join(separator);
	}
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
 * Turns several submissions of the same form into CSV rows, one column per
 * field (no `section`). Hidden or unanswered fields become empty cells.
 */
export function toCSV(
	form: Form,
	rows: readonly AnswerInput[],
	options: CSVOptions = {},
): string {
	const context = createDisplayContext(options);
	const delimiter = options.delimiter ?? ',';
	const newline = options.newline ?? '\r\n';
	const escapeFormulas = options.escapeFormulas !== false;
	const raw = options.values === 'raw';

	const quote = (cell: string, isNumber = false): string => {
		let text = cell;
		if (escapeFormulas && !isNumber && FORMULA_START.test(text)) {
			text = `'${text}`;
		}
		const needsQuotes =
			text.includes(delimiter) ||
			text.includes('"') ||
			text.includes('\n') ||
			text.includes('\r');
		return needsQuotes ? `"${text.replaceAll('"', '""')}"` : text;
	};

	const header = form.answerableFields.map((field) =>
		quote(
			options.header === 'key'
				? exportKey(field)
				: context.text(field.label),
		),
	);
	const lines = [header.join(delimiter)];

	for (const row of rows) {
		const byId = new Map(
			exportEntries(form, row).map((entry) => [entry.field.id, entry]),
		);
		const cells = form.answerableFields.map((field) => {
			const entry = byId.get(field.id);
			if (entry === undefined || !entry.answered) return '';
			const text = raw
				? rawCell(entry.value, context.labels.listSeparator)
				: displayAnswer(entry, context);
			return quote(text, typeof entry.value === 'number');
		});
		lines.push(cells.join(delimiter));
	}

	return (options.bom === true ? '﻿' : '') + lines.join(newline);
}
