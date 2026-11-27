import type { FieldTypeDefinition } from '../fields/definition.ts';
import type { AnswerInput, Form } from '../form.ts';
import { resolveText, type LocalizedText } from '../i18n.ts';
import { hasOwn } from '../internal/guards.ts';
import type { FieldBase } from '../schema/types.ts';

/** Textos fixos usados ao exibir respostas. */
export interface DisplayLabels {
	readonly yes: string;
	readonly no: string;
	/** Separador de listas (ex.: opções de um `multiChoice`). */
	readonly listSeparator: string;
}

/** Textos padrão por idioma. Idioma sem entrada aqui cai em `pt`. */
export const DISPLAY_LABELS: Readonly<Record<string, DisplayLabels>> =
	Object.freeze({
		pt: Object.freeze({ yes: 'Sim', no: 'Não', listSeparator: ', ' }),
		en: Object.freeze({ yes: 'Yes', no: 'No', listSeparator: ', ' }),
		es: Object.freeze({ yes: 'Sí', no: 'No', listSeparator: ', ' }),
	});

/** Opções comuns a todos os exporters que geram texto legível. */
export interface DisplayOptions {
	/** Idioma dos textos do schema (`LocalizedText`). */
	readonly locale?: string;
	readonly fallbackLocale?: string;
	/** Sobrescreve os textos de `DISPLAY_LABELS`. */
	readonly labels?: Partial<DisplayLabels>;
}

/** O que `toDisplay` recebe além do valor e do campo. */
export interface DisplayContext {
	readonly locale: string | undefined;
	readonly fallbackLocale: string | undefined;
	readonly labels: DisplayLabels;
	/** Resolve um `LocalizedText` no idioma do contexto. */
	text(text: LocalizedText): string;
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
			(DISPLAY_LABELS['pt'] as DisplayLabels)),
		...options.labels,
	};
	return {
		locale,
		fallbackLocale,
		labels,
		text: (text) => resolveText(text, locale, fallbackLocale),
	};
}

/** Número formatado no idioma do contexto; sem idioma, `String(value)`. */
export function formatNumber(value: number, context: DisplayContext): string {
	if (context.locale === undefined) return String(value);
	try {
		return new Intl.NumberFormat(context.locale, {
			maximumFractionDigits: 20,
		}).format(value);
	} catch {
		// Tag de idioma inválida.
		return String(value);
	}
}

/** Conversão genérica, pra tipos customizados sem `toDisplay`. */
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
	/** Nome do campo nas exportações (`key` ou `id`). */
	readonly key: string;
	/** `true` se a resposta está presente e não vazia. */
	readonly answered: boolean;
	readonly value: unknown;
}

export function exportKey(field: FieldBase): string {
	return field.key ?? field.id;
}

/**
 * Campos com resposta, na ordem do schema, só os visíveis pras respostas
 * dadas. Passe `result.data` de `form.validate`: os exporters não validam.
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

/** Texto legível de uma resposta (`''` se vazia). */
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
