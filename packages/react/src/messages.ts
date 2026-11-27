import type { AnswerIssue, ValidationCode } from '@excalibur-form/core';

type Params = NonNullable<AnswerIssue['params']>;
type MessageTable = Readonly<Record<ValidationCode, (p: Params) => string>>;

const pt: MessageTable = {
	required: () => 'Campo obrigatório',
	invalid_type: () => 'Valor inválido',
	too_short: (p) => `Mínimo de ${p['min']} caracteres`,
	too_long: (p) => `Máximo de ${p['max']} caracteres`,
	too_small: (p) => `O mínimo é ${p['min']}`,
	too_big: (p) => `O máximo é ${p['max']}`,
	not_integer: () => 'Use um número inteiro',
	invalid_format: (p) =>
		p['format'] === 'email'
			? 'E-mail inválido'
			: p['format'] === 'url'
				? 'URL inválida (use http ou https)'
				: 'Formato inválido',
	invalid_option: () => 'Opção inválida',
	duplicate_option: () => 'Opção repetida',
	too_few: (p) => `Selecione pelo menos ${p['min']}`,
	too_many: (p) => `Selecione no máximo ${p['max']}`,
};

const en: MessageTable = {
	required: () => 'Required',
	invalid_type: () => 'Invalid value',
	too_short: (p) => `At least ${p['min']} characters`,
	too_long: (p) => `At most ${p['max']} characters`,
	too_small: (p) => `Minimum is ${p['min']}`,
	too_big: (p) => `Maximum is ${p['max']}`,
	not_integer: () => 'Use a whole number',
	invalid_format: (p) =>
		p['format'] === 'email'
			? 'Invalid email'
			: p['format'] === 'url'
				? 'Invalid URL (use http or https)'
				: 'Invalid format',
	invalid_option: () => 'Invalid option',
	duplicate_option: () => 'Duplicate option',
	too_few: (p) => `Select at least ${p['min']}`,
	too_many: (p) => `Select at most ${p['max']}`,
};

const es: MessageTable = {
	required: () => 'Campo obligatorio',
	invalid_type: () => 'Valor inválido',
	too_short: (p) => `Mínimo de ${p['min']} caracteres`,
	too_long: (p) => `Máximo de ${p['max']} caracteres`,
	too_small: (p) => `El mínimo es ${p['min']}`,
	too_big: (p) => `El máximo es ${p['max']}`,
	not_integer: () => 'Usa un número entero',
	invalid_format: (p) =>
		p['format'] === 'email'
			? 'Correo inválido'
			: p['format'] === 'url'
				? 'URL inválida (usa http o https)'
				: 'Formato inválido',
	invalid_option: () => 'Opción inválida',
	duplicate_option: () => 'Opción repetida',
	too_few: (p) => `Selecciona al menos ${p['min']}`,
	too_many: (p) => `Selecciona como máximo ${p['max']}`,
};

const TABLES: Readonly<Record<string, MessageTable>> = { pt, en, es };

/**
 * Mensagem padrão de um erro de validação, em `pt`, `en` ou `es` (outros
 * idiomas caem em `pt`). Pra mensagens próprias, passe `formatError` pro
 * `<FormRenderer>`.
 */
export function defaultErrorMessage(
	issue: AnswerIssue,
	locale?: string,
): string {
	const language = locale?.toLowerCase().split(/[-_]/)[0] ?? 'pt';
	const table = Object.hasOwn(TABLES, language)
		? (TABLES[language] as MessageTable)
		: pt;
	// Código desconhecido (tipo customizado que inventou um): mensagem genérica.
	const message = Object.hasOwn(table, issue.code)
		? table[issue.code]
		: table.invalid_type;
	return message(issue.params ?? {});
}
