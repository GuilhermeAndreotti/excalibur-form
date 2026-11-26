import type { LocalizedText } from '../i18n.ts';
import { isRecord, ownValue } from '../internal/guards.ts';
import type { PathSegment, SchemaIssue, SchemaIssueCode } from './issues.ts';
import type { SchemaLimits } from './limits.ts';
import type { ChoiceOption } from './types.ts';

export const ID_PATTERN: RegExp = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export interface NumberReadOptions {
	readonly integer?: boolean;
	readonly min?: number;
	readonly max?: number;
}

/**
 * Lê e valida as propriedades de um objeto do schema, registrando problemas
 * com o caminho certo. Tipos de campo customizados recebem um destes em
 * `parseConfig`.
 */
export interface ConfigReader {
	readonly raw: Readonly<Record<string, unknown>>;
	readonly path: readonly PathSegment[];
	readonly limits: Readonly<SchemaLimits>;
	issue(
		key: PathSegment | readonly PathSegment[],
		code: SchemaIssueCode,
		message: string,
	): void;
	number(key: string, options?: NumberReadOptions): number | undefined;
	boolean(key: string): boolean | undefined;
	text(key: string): LocalizedText | undefined;
	requiredText(key: string): LocalizedText | undefined;
	oneOf<T extends string>(key: string, values: readonly T[]): T | undefined;
	id(key: string): string | undefined;
	options(key: string): readonly ChoiceOption[] | undefined;
}

export function createReader(
	raw: Readonly<Record<string, unknown>>,
	path: readonly PathSegment[],
	limits: Readonly<SchemaLimits>,
	issues: SchemaIssue[],
): ConfigReader {
	const issue: ConfigReader['issue'] = (key, code, message) => {
		const rest = Array.isArray(key) ? key : [key];
		issues.push({ path: [...path, ...rest], code, message });
	};

	const readText = (key: string, required: boolean) => {
		const value = ownValue(raw, key);
		if (value === undefined) {
			if (required) issue(key, 'required', `"${key}" is required`);
			return undefined;
		}
		return parseLocalizedText(value, [...path, key], limits, issues);
	};

	return {
		raw,
		path,
		limits,
		issue,
		number(key, options = {}) {
			const value = ownValue(raw, key);
			if (value === undefined) return undefined;
			if (typeof value !== 'number' || !Number.isFinite(value)) {
				issue(key, 'invalid_type', `"${key}" must be a finite number`);
				return undefined;
			}
			if (options.integer === true && !Number.isInteger(value)) {
				issue(key, 'invalid_value', `"${key}" must be an integer`);
				return undefined;
			}
			if (options.min !== undefined && value < options.min) {
				issue(
					key,
					'invalid_value',
					`"${key}" must be >= ${options.min}`,
				);
				return undefined;
			}
			if (options.max !== undefined && value > options.max) {
				issue(
					key,
					'invalid_value',
					`"${key}" must be <= ${options.max}`,
				);
				return undefined;
			}
			return value;
		},
		boolean(key) {
			const value = ownValue(raw, key);
			if (value === undefined) return undefined;
			if (typeof value !== 'boolean') {
				issue(key, 'invalid_type', `"${key}" must be a boolean`);
				return undefined;
			}
			return value;
		},
		text: (key) => readText(key, false),
		requiredText: (key) => readText(key, true),
		oneOf(key, values) {
			const value = ownValue(raw, key);
			if (value === undefined) return undefined;
			if (typeof value !== 'string' || !values.includes(value as never)) {
				issue(
					key,
					'invalid_value',
					`"${key}" must be one of: ${values.join(', ')}`,
				);
				return undefined;
			}
			return value as (typeof values)[number];
		},
		id(key) {
			const value = ownValue(raw, key);
			if (value === undefined) return undefined;
			if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
				issue(
					key,
					'invalid_id',
					`"${key}" must start with a letter and contain only letters, digits, "_" or "-" (max 64)`,
				);
				return undefined;
			}
			return value;
		},
		options(key) {
			const value = ownValue(raw, key);
			if (value === undefined) {
				issue(key, 'required', `"${key}" is required`);
				return undefined;
			}
			if (!Array.isArray(value)) {
				issue(key, 'invalid_type', `"${key}" must be an array`);
				return undefined;
			}
			if (value.length === 0) {
				issue(key, 'too_few', `"${key}" needs at least one option`);
				return undefined;
			}
			if (value.length > limits.maxOptions) {
				issue(
					key,
					'too_many',
					`"${key}" has more than ${limits.maxOptions} options`,
				);
				return undefined;
			}
			const before = issues.length;
			const seen = new Set<string>();
			const options: ChoiceOption[] = [];
			value.forEach((item: unknown, index) => {
				if (!isRecord(item)) {
					issue(
						[key, index],
						'invalid_type',
						'option must be an object',
					);
					return;
				}
				const optionReader = createReader(
					item,
					[...path, key, index],
					limits,
					issues,
				);
				const id = optionReader.id('id');
				const label = optionReader.requiredText('label');
				if (ownValue(item, 'id') === undefined) {
					optionReader.issue('id', 'required', '"id" is required');
				}
				if (id !== undefined && seen.has(id)) {
					optionReader.issue(
						'id',
						'duplicate_id',
						`duplicate option id "${id}"`,
					);
				}
				if (id !== undefined) seen.add(id);
				if (id !== undefined && label !== undefined) {
					options.push({ id, label });
				}
			});
			return issues.length === before ? options : undefined;
		},
	};
}

export function parseLocalizedText(
	value: unknown,
	path: readonly PathSegment[],
	limits: Readonly<SchemaLimits>,
	issues: SchemaIssue[],
): LocalizedText | undefined {
	const tooLong = (text: string) => text.length > limits.maxTextLength;
	if (typeof value === 'string') {
		if (value.trim() === '') {
			issues.push({ path, code: 'required', message: 'text is empty' });
			return undefined;
		}
		if (tooLong(value)) {
			issues.push({
				path,
				code: 'too_long',
				message: `text longer than ${limits.maxTextLength} characters`,
			});
			return undefined;
		}
		return value;
	}
	if (!isRecord(value)) {
		issues.push({
			path,
			code: 'invalid_type',
			message: 'text must be a string or a { locale: string } map',
		});
		return undefined;
	}
	const entries = Object.entries(value);
	if (entries.length === 0 || entries.length > limits.maxLocales) {
		issues.push({
			path,
			code: entries.length === 0 ? 'too_few' : 'too_many',
			message: `localized text needs between 1 and ${limits.maxLocales} locales`,
		});
		return undefined;
	}
	const before = issues.length;
	const out: Record<string, string> = {};
	for (const [locale, text] of entries) {
		if (!LOCALE_PATTERN.test(locale)) {
			issues.push({
				path: [...path, locale],
				code: 'invalid_value',
				message: `"${locale}" is not a valid locale tag`,
			});
		} else if (typeof text !== 'string' || text.trim() === '') {
			issues.push({
				path: [...path, locale],
				code: 'invalid_type',
				message: 'translation must be a non-empty string',
			});
		} else if (tooLong(text)) {
			issues.push({
				path: [...path, locale],
				code: 'too_long',
				message: `text longer than ${limits.maxTextLength} characters`,
			});
		} else {
			out[locale] = text;
		}
	}
	return issues.length === before ? out : undefined;
}
