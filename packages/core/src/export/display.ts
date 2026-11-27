import type { FieldTypeDefinition } from '../fields/definition.ts';
import type { AnswerInput, Form } from '../form.ts';
import { resolveText, type LocalizedText } from '../i18n.ts';
import { hasOwn } from '../internal/guards.ts';
import type { FieldBase } from '../schema/types.ts';

/** Fixed strings used when displaying answers. */
export interface DisplayLabels {
	readonly yes: string;
	readonly no: string;
	/** List separator (e.g. `multiChoice` options). */
	readonly listSeparator: string;
}

/** Default strings per language. Languages missing here fall back to `en`. */
export const DISPLAY_LABELS: Readonly<Record<string, DisplayLabels>> =
	Object.freeze({
		en: Object.freeze({ yes: 'Yes', no: 'No', listSeparator: ', ' }),
		pt: Object.freeze({ yes: 'Sim', no: 'Não', listSeparator: ', ' }),
		es: Object.freeze({ yes: 'Sí', no: 'No', listSeparator: ', ' }),
	});

/** Options shared by every exporter that produces readable text. */
export interface DisplayOptions {
	/** Language for the schema texts (`LocalizedText`). */
	readonly locale?: string | undefined;
	readonly fallbackLocale?: string | undefined;
	/** Overrides the `DISPLAY_LABELS` strings. */
	readonly labels?: Partial<DisplayLabels> | undefined;
}

/** What `toDisplay` receives besides the value and the field. */
export interface DisplayContext {
	readonly locale: string | undefined;
	readonly fallbackLocale: string | undefined;
	readonly labels: DisplayLabels;
	/** Resolves a `LocalizedText` in the context language. */
	readonly text: (text: LocalizedText) => string;
}

function baseLabels(locale: string | undefined): DisplayLabels | undefined {
	if (locale === undefined) return undefined;
	const language = locale.toLowerCase().split(/[-_]/)[0] ?? '';
	return hasOwn(DISPLAY_LABELS, language)
		? DISPLAY_LABELS[language]
		: undefined;
}

export function createDisplayContext(
	options: DisplayOptions = {},
): DisplayContext {
	const { locale, fallbackLocale } = options;
	const labels: DisplayLabels = {
		...(baseLabels(locale) ??
			baseLabels(fallbackLocale) ??
			(DISPLAY_LABELS['en'] as DisplayLabels)),
		...options.labels,
	};
	return {
		locale,
		fallbackLocale,
		labels,
		text: (text) => resolveText(text, locale, fallbackLocale),
	};
}

/** Number formatted for the context language; without one, `String(value)`. */
export function formatNumber(value: number, context: DisplayContext): string {
	if (context.locale === undefined) return String(value);
	try {
		return new Intl.NumberFormat(context.locale, {
			maximumFractionDigits: 20,
		}).format(value);
	} catch {
		// Invalid language tag.
		return String(value);
	}
}

/** Generic conversion, for custom types without `toDisplay`. */
function genericDisplay(value: unknown, context: DisplayContext): string {
	if (typeof value === 'string') return value;
	if (typeof value === 'number') return formatNumber(value, context);
	if (typeof value === 'boolean') {
		return value ? context.labels.yes : context.labels.no;
	}
	if (Array.isArray(value)) {
		return value
			.map((item: unknown) => genericDisplay(item, context))
			.join(context.labels.listSeparator);
	}
	if (value === undefined || value === null) return '';
	return JSON.stringify(value) ?? '';
}

export interface ExportEntry {
	readonly field: FieldBase;
	readonly definition: FieldTypeDefinition;
	/** Field name in exports (`key` or `id`). */
	readonly key: string;
	/** `true` if the answer is present and not empty. */
	readonly answered: boolean;
	readonly value: unknown;
}

export function exportKey(field: FieldBase): string {
	return field.key ?? field.id;
}

/**
 * Answerable fields in schema order, only those visible for the given
 * answers. Pass `result.data` from `form.validate`: exporters don't validate.
 */
export function exportEntries(form: Form, data: AnswerInput): ExportEntry[] {
	const visible = form.visibleFieldIds(data);
	const entries: ExportEntry[] = [];
	for (const field of form.answerableFields) {
		if (!visible.has(field.id)) continue;
		const definition = form.registry.get(field.type) as FieldTypeDefinition;
		const value = hasOwn(data, field.id) ? data[field.id] : undefined;
		entries.push({
			field,
			definition,
			key: exportKey(field),
			answered: !definition.isEmpty(value),
			value,
		});
	}
	return entries;
}

/** Readable text for an answer (`''` if empty). */
export function displayAnswer(
	entry: Pick<ExportEntry, 'field' | 'definition' | 'answered' | 'value'>,
	context: DisplayContext,
): string {
	if (!entry.answered) return '';
	const { definition } = entry;
	return definition.toDisplay === undefined
		? genericDisplay(entry.value, context)
		: definition.toDisplay(entry.value, entry.field, context);
}
