import { stripUndefined } from '../../internal/guards.ts';
import type { ConfigReader } from '../../schema/reader.ts';
import type { LongTextField, TextField } from '../../schema/types.ts';
import { accept, reject, type AnswerCheck } from '../../validation/errors.ts';
import { isNullish, type FieldTypeDefinition } from '../definition.ts';

const TEXT_OPS = [
	'eq',
	'neq',
	'in',
	'notIn',
	'answered',
	'notAnswered',
] as const;

function isEmptyText(value: unknown): boolean {
	return (
		isNullish(value) || (typeof value === 'string' && value.trim() === '')
	);
}

function readLengths(reader: ConfigReader, ceiling: number) {
	const minLength = reader.number('minLength', {
		integer: true,
		min: 0,
		max: ceiling,
	});
	const maxLength = reader.number('maxLength', {
		integer: true,
		min: 1,
		max: ceiling,
	});
	if (
		minLength !== undefined &&
		maxLength !== undefined &&
		minLength > maxLength
	) {
		reader.issue('minLength', 'invalid_value', 'minLength > maxLength');
	}
	return { minLength, maxLength };
}

function checkText(
	value: unknown,
	minLength: number | undefined,
	maxLength: number,
): AnswerCheck<string> {
	if (typeof value !== 'string') return reject('invalid_type');
	if (value.length > maxLength) return reject('too_long', { max: maxLength });
	if (minLength !== undefined && value.length < minLength) {
		return reject('too_short', { min: minLength });
	}
	return accept(value);
}

/** Linear check (no backtracking regex). */
export function isEmail(value: string): boolean {
	if (/\s/.test(value)) return false;
	const at = value.indexOf('@');
	if (at <= 0 || at !== value.lastIndexOf('@')) return false;
	const domain = value.slice(at + 1);
	const dot = domain.indexOf('.');
	return dot > 0 && !domain.endsWith('.') && !domain.includes('..');
}

export function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

export const textFieldType: FieldTypeDefinition<TextField, string> = {
	type: 'text',
	answerable: true,
	conditionOps: TEXT_OPS,
	parseConfig(reader) {
		const lengths = readLengths(reader, reader.limits.maxTextAnswerLength);
		return stripUndefined({
			...lengths,
			format: reader.oneOf('format', ['email', 'url'] as const),
			placeholder: reader.text('placeholder'),
		});
	},
	isEmpty: isEmptyText,
	validate(value, field, { limits }) {
		const check = checkText(
			value,
			field.minLength,
			field.maxLength ?? limits.maxTextAnswerLength,
		);
		if (!check.ok) return check;
		if (field.format === 'email' && !isEmail(check.value)) {
			return reject('invalid_format', { format: 'email' });
		}
		if (field.format === 'url' && !isHttpUrl(check.value)) {
			return reject('invalid_format', { format: 'url' });
		}
		return check;
	},
	isValidConditionValue: (_field, value) => typeof value === 'string',
	toDisplay: (value) => value,
};

export const longTextFieldType: FieldTypeDefinition<LongTextField, string> = {
	type: 'longText',
	answerable: true,
	conditionOps: TEXT_OPS,
	parseConfig(reader) {
		const lengths = readLengths(
			reader,
			reader.limits.maxLongTextAnswerLength,
		);
		return stripUndefined({
			...lengths,
			placeholder: reader.text('placeholder'),
		});
	},
	isEmpty: isEmptyText,
	validate: (value, field, { limits }) =>
		checkText(
			value,
			field.minLength,
			field.maxLength ?? limits.maxLongTextAnswerLength,
		),
	isValidConditionValue: (_field, value) => typeof value === 'string',
	toDisplay: (value) => value,
};
