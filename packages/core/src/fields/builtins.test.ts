import { describe, expect, it } from 'vitest';

import { parseForm } from '../form.ts';
import type { ValidationError } from '../validation/errors.ts';

function errorsFor(
	field: Record<string, unknown>,
	value: unknown,
): ValidationError[] | 'ok' {
	const parsed = parseForm({
		id: 'f',
		version: 1,
		fields: [{ id: 'x', label: 'X', ...field }],
	});
	if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
	const result = parsed.value.validate({ x: value });
	return result.ok ? 'ok' : [...result.errors];
}

const err = (code: string, params?: Record<string, unknown>) => [
	params ? { fieldId: 'x', code, params } : { fieldId: 'x', code },
];

describe('tipos nativos', () => {
	it('text', () => {
		const field = { type: 'text', minLength: 2, maxLength: 4 };
		expect(errorsFor(field, 'abc')).toBe('ok');
		expect(errorsFor(field, 'a')).toEqual(err('too_short', { min: 2 }));
		expect(errorsFor(field, 'abcde')).toEqual(err('too_long', { max: 4 }));
		expect(errorsFor(field, 3)).toEqual(err('invalid_type'));
		expect(errorsFor({ type: 'text', required: true }, '   ')).toEqual(
			err('required'),
		);
		expect(errorsFor({ type: 'text' }, 'x'.repeat(10_001))).toEqual(
			err('too_long', { max: 10_000 }),
		);
	});

	it('text com format', () => {
		const email = { type: 'text', format: 'email' };
		for (const ok of ['a@b.co', 'nome.sobrenome@empresa.com.br'])
			expect(errorsFor(email, ok)).toBe('ok');
		for (const bad of [
			'a',
			'@b.co',
			'a@b',
			'a@@b.co',
			'a b@c.co',
			'a@b..co',
			'a@b.co.',
			'a@.co',
		]) {
			expect(errorsFor(email, bad)).toEqual(
				err('invalid_format', { format: 'email' }),
			);
		}
		const url = { type: 'text', format: 'url' };
		expect(errorsFor(url, 'https://x.dev/a?b=1')).toBe('ok');
		expect(errorsFor(url, 'javascript:alert(1)')).toEqual(
			err('invalid_format', { format: 'url' }),
		);
		expect(errorsFor(url, 'não é url')).toEqual(
			err('invalid_format', { format: 'url' }),
		);
	});

	it('longText', () => {
		expect(errorsFor({ type: 'longText' }, 'x'.repeat(50_000))).toBe('ok');
		expect(errorsFor({ type: 'longText' }, 'x'.repeat(100_001))).toEqual(
			err('too_long', { max: 100_000 }),
		);
		expect(errorsFor({ type: 'longText', minLength: 3 }, 'ab')).toEqual(
			err('too_short', { min: 3 }),
		);
	});

	it('number', () => {
		const field = { type: 'number', min: 0, max: 10, integer: true };
		expect(errorsFor(field, 0)).toBe('ok');
		expect(errorsFor(field, -1)).toEqual(err('too_small', { min: 0 }));
		expect(errorsFor(field, 11)).toEqual(err('too_big', { max: 10 }));
		expect(errorsFor(field, 1.5)).toEqual(err('not_integer'));
		expect(errorsFor(field, '5')).toEqual(err('invalid_type'));
		expect(errorsFor(field, Number.NaN)).toEqual(err('invalid_type'));
		expect(errorsFor({ type: 'number' }, 1.5)).toBe('ok');
	});

	it('boolean: false conta como respondido', () => {
		expect(errorsFor({ type: 'boolean', required: true }, false)).toBe(
			'ok',
		);
		expect(errorsFor({ type: 'boolean', required: true }, null)).toEqual(
			err('required'),
		);
		expect(errorsFor({ type: 'boolean' }, 'true')).toEqual(
			err('invalid_type'),
		);
	});

	it('choice', () => {
		const field = {
			type: 'choice',
			options: [
				{ id: 'a', label: 'A' },
				{ id: 'b', label: 'B' },
			],
			required: true,
		};
		expect(errorsFor(field, 'a')).toBe('ok');
		expect(errorsFor(field, 'z')).toEqual(
			err('invalid_option', { option: 'z' }),
		);
		expect(errorsFor(field, 1)).toEqual(err('invalid_type'));
		expect(errorsFor(field, '')).toEqual(err('required'));
	});

	it('multiChoice', () => {
		const options = ['a', 'b', 'c'].map((id) => ({ id, label: id }));
		const field = {
			type: 'multiChoice',
			options,
			minSelected: 1,
			maxSelected: 2,
		};
		expect(errorsFor(field, ['a', 'c'])).toBe('ok');
		expect(errorsFor(field, ['a', 'b', 'c'])).toEqual(
			err('too_many', { max: 2 }),
		);
		expect(errorsFor({ ...field, minSelected: 2 }, ['a'])).toEqual(
			err('too_few', { min: 2 }),
		);
		expect(errorsFor(field, ['a', 'a'])).toEqual(
			err('duplicate_option', { option: 'a' }),
		);
		expect(errorsFor(field, ['z'])).toEqual(
			err('invalid_option', { option: 'z' }),
		);
		expect(errorsFor(field, [1])).toEqual(err('invalid_type'));
		expect(errorsFor(field, 'a')).toEqual(err('invalid_type'));
		expect(errorsFor({ ...field, required: true }, [])).toEqual(
			err('required'),
		);
	});

	it('scale', () => {
		expect(errorsFor({ type: 'scale' }, 5)).toBe('ok');
		expect(errorsFor({ type: 'scale' }, 0)).toEqual(
			err('too_small', { min: 1 }),
		);
		expect(errorsFor({ type: 'scale' }, 6)).toEqual(
			err('too_big', { max: 5 }),
		);
		expect(errorsFor({ type: 'scale', min: 0, max: 10 }, 10)).toBe('ok');
		expect(errorsFor({ type: 'scale' }, 2.5)).toEqual(err('not_integer'));
		expect(errorsFor({ type: 'scale' }, '3')).toEqual(err('invalid_type'));
	});
});
