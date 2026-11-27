import { describe, expect, expectTypeOf, it } from 'vitest';

import { defineFieldType } from './fields/definition.ts';
import { builtinFieldTypes, createRegistry } from './fields/registry.ts';
import { defineForm, parseForm } from './form.ts';
import { resolveText } from './i18n.ts';
import type { InferAnswers } from './infer.ts';
import { stripUndefined } from './internal/guards.ts';
import { FormSchemaError } from './schema/issues.ts';
import type { FieldBase } from './schema/types.ts';
import { accept, reject } from './validation/errors.ts';

const inspection = defineForm({
	id: 'inspection',
	version: 1,
	fields: [
		{ id: 'intro', type: 'section', label: 'Vehicle' },
		{ id: 'plate', type: 'text', label: 'Plate', required: true },
		{
			id: 'fuel',
			type: 'choice',
			label: 'Fuel',
			required: true,
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
			],
		},
		{
			id: 'extras',
			type: 'multiChoice',
			label: 'Extras',
			options: [
				{ id: 'ac', label: 'A/C' },
				{ id: 'sunroof', label: 'Sunroof' },
			],
		},
		{
			id: 'has_fines',
			type: 'boolean',
			label: 'Any fines?',
			required: true,
		},
		{
			id: 'fines_amount',
			type: 'number',
			label: 'Fines amount',
			required: true,
			min: 0,
			showIf: { field: 'has_fines', op: 'eq', value: true },
		},
		{ id: 'rating', type: 'scale', label: 'Overall condition', max: 10 },
	],
});

describe('defineForm', () => {
	it('infers the answer types', () => {
		type Answers = InferAnswers<typeof inspection.schema>;
		expectTypeOf<Answers>().toEqualTypeOf<{
			plate: string;
			fuel: 'flex' | 'diesel';
			has_fines: boolean;
			extras?: ('ac' | 'sunroof')[];
			fines_amount?: number;
			rating?: number;
		}>();
		const result = inspection.validate({});
		if (result.ok) expectTypeOf(result.data).toEqualTypeOf<Answers>();
	});

	it('validates and drops unknown keys and hidden fields', () => {
		const result = inspection.validate({
			plate: 'ABC1D23',
			fuel: 'flex',
			has_fines: false,
			fines_amount: 'ignored because it is hidden',
			extras: ['sunroof'],
			hack: true,
		});
		expect(result).toEqual({
			ok: true,
			data: {
				plate: 'ABC1D23',
				fuel: 'flex',
				has_fines: false,
				extras: ['sunroof'],
			},
		});
	});

	it('validates a conditional field once it shows up', () => {
		const result = inspection.validate({
			plate: 'X',
			fuel: 'diesel',
			has_fines: true,
		});
		expect(result).toEqual({
			ok: false,
			errors: [{ fieldId: 'fines_amount', code: 'required' }],
		});
	});

	it('collects every error', () => {
		const result = inspection.validate({ fuel: 'gasoline', rating: 11 });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.map((e) => `${e.fieldId}:${e.code}`)).toEqual([
			'plate:required',
			'fuel:invalid_option',
			'has_fines:required',
			'rating:too_big',
		]);
	});

	it('rejects answers that are not an object', () => {
		for (const input of [null, [], 'x']) {
			expect(inspection.validate(input)).toEqual({
				ok: false,
				errors: [{ fieldId: null, code: 'invalid_type' }],
			});
		}
	});

	it('ignores properties inherited from the prototype', () => {
		const form = defineForm({
			id: 'f',
			version: 1,
			fields: [
				{ id: 'constructor', type: 'text', label: 'C', required: true },
			],
		});
		expect(form.validate({})).toEqual({
			ok: false,
			errors: [{ fieldId: 'constructor', code: 'required' }],
		});
	});

	it('throws FormSchemaError for an invalid schema', () => {
		expect(() =>
			defineForm({
				id: 'f',
				version: 1,
				fields: [{ id: 'a', type: 'choice', label: 'A', options: [] }],
			}),
		).toThrow(FormSchemaError);
	});

	it('exposes helpers', () => {
		expect(inspection.field('plate')?.label).toBe('Plate');
		expect(inspection.field('nothing')).toBeUndefined();
		expect(inspection.answerableFields.map((f) => f.id)).not.toContain(
			'intro',
		);
		expect(inspection.limits.maxFields).toBe(500);
		expect(Object.isFrozen(inspection.schema)).toBe(true);
	});
});

describe('visibleFieldIds', () => {
	it('updates with the answers and cascades', () => {
		const form = defineForm({
			id: 'f',
			version: 1,
			fields: [
				{ id: 'a', type: 'boolean', label: 'A' },
				{
					id: 'b',
					type: 'text',
					label: 'B',
					showIf: { field: 'a', op: 'eq', value: true },
				},
				{
					id: 'c',
					type: 'text',
					label: 'C',
					showIf: { field: 'b', op: 'answered' },
				},
				{
					id: 'd',
					type: 'section',
					label: 'D',
					showIf: { field: 'a', op: 'notAnswered' },
				},
			],
		});
		expect([...form.visibleFieldIds({})]).toEqual(['a', 'd']);
		expect([...form.visibleFieldIds({ a: true, b: 'hi' })]).toEqual([
			'a',
			'b',
			'c',
		]);
		// b hidden → b's answer doesn't count → c disappears too
		expect([...form.visibleFieldIds({ a: false, b: 'hi' })]).toEqual(['a']);
		expect([...form.visibleFieldIds({ a: true, b: '   ' })]).toEqual([
			'a',
			'b',
		]);
	});
});

describe('parseForm', () => {
	it('builds a form from JSON', () => {
		const parsed = parseForm(
			JSON.parse(
				'{"id":"f","version":2,"fields":[{"id":"n","type":"number","label":"N"}]}',
			),
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		expect(parsed.value.validate({ n: 3 })).toEqual({
			ok: true,
			data: { n: 3 },
		});
	});

	it('returns issues without throwing', () => {
		const parsed = parseForm({ id: 'f' });
		expect(parsed.ok).toBe(false);
	});
});

describe('custom types', () => {
	interface CpfField extends FieldBase {
		readonly type: 'cpf';
		readonly mask?: boolean;
	}
	const cpfType = defineFieldType<CpfField, string>({
		type: 'cpf',
		answerable: true,
		conditionOps: ['answered', 'notAnswered'],
		parseConfig: (reader) =>
			stripUndefined({ mask: reader.boolean('mask') }),
		isEmpty: (v) => v === undefined || v === null || v === '',
		validate: (value) =>
			typeof value === 'string' && /^\d{11}$/.test(value)
				? accept(value)
				: reject('invalid_format', { format: 'cpf' }),
	});
	const registry = createRegistry([...builtinFieldTypes, cpfType]);

	it('works through a registry', () => {
		const parsed = parseForm(
			{
				id: 'f',
				version: 1,
				fields: [
					{
						id: 'doc',
						type: 'cpf',
						label: 'CPF',
						mask: true,
						required: true,
					},
				],
			},
			{ registry },
		);
		if (!parsed.ok) throw new Error(JSON.stringify(parsed.issues));
		expect(parsed.value.schema.fields[0]).toMatchObject({ mask: true });
		expect(parsed.value.validate({ doc: '12345678901' })).toEqual({
			ok: true,
			data: { doc: '12345678901' },
		});
		expect(parsed.value.validate({ doc: '123' })).toEqual({
			ok: false,
			errors: [
				{
					fieldId: 'doc',
					code: 'invalid_format',
					params: { format: 'cpf' },
				},
			],
		});
	});

	it('rejects the type without the registry', () => {
		expect(
			parseForm({
				id: 'f',
				version: 1,
				fields: [{ id: 'doc', type: 'cpf', label: 'CPF' }],
			}).ok,
		).toBe(false);
	});

	it('refuses to register the same type twice', () => {
		expect(() => createRegistry([cpfType, cpfType])).toThrow(
			'registered twice',
		);
	});
});

describe('resolveText', () => {
	it('resolves the language with fallback', () => {
		const text = { pt: 'Olá', en: 'Hello' };
		expect(resolveText('Hi')).toBe('Hi');
		expect(resolveText(text, 'en')).toBe('Hello');
		expect(resolveText(text, 'en-US')).toBe('Hello');
		expect(resolveText(text, 'es-AR', 'en_GB')).toBe('Hello');
		expect(resolveText(text, 'es', 'pt')).toBe('Olá');
		expect(resolveText(text, 'es')).toBe('Olá');
		expect(resolveText({}, 'es')).toBe('');
	});
});
