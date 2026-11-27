import { describe, expect, it } from 'vitest';

import { formatPath, FormSchemaError } from './issues.ts';
import { parseSchema } from './parse.ts';

const base = { id: 'f', version: 1 };

function issuesOf(raw: unknown) {
	const result = parseSchema(raw);
	if (result.ok) throw new Error('expected schema to be invalid');
	return result.issues.map((i) => ({
		path: formatPath(i.path),
		code: i.code,
	}));
}

describe('parseSchema', () => {
	it('accepts a valid schema, drops unknown props and freezes it', () => {
		const result = parseSchema({
			...base,
			title: { pt: 'Vistoria', en: 'Inspection' },
			extra: 'dropped',
			fields: [
				{
					id: 'name',
					type: 'text',
					label: 'Name',
					required: true,
					junk: 1,
				},
				{ id: 'intro', type: 'section', label: 'About' },
			],
		});
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value).toEqual({
			id: 'f',
			version: 1,
			title: { pt: 'Vistoria', en: 'Inspection' },
			fields: [
				{ id: 'name', type: 'text', label: 'Name', required: true },
				{ id: 'intro', type: 'section', label: 'About' },
			],
		});
		expect(Object.isFrozen(result.value.fields[0])).toBe(true);
	});

	it('rejects an invalid root', () => {
		expect(issuesOf(null)).toEqual([{ path: '', code: 'invalid_type' }]);
		expect(issuesOf({})).toEqual([
			{ path: 'id', code: 'required' },
			{ path: 'version', code: 'required' },
			{ path: 'fields', code: 'invalid_type' },
		]);
		expect(issuesOf({ id: '1abc', version: 0.5, fields: [] })).toEqual([
			{ path: 'id', code: 'invalid_id' },
			{ path: 'version', code: 'invalid_value' },
		]);
	});

	it('validates field ids, types and labels', () => {
		expect(
			issuesOf({
				...base,
				fields: [
					'x',
					{ type: 'text', label: 'A' },
					{ id: 'b', type: 'nope', label: 'B' },
					{ id: 'c', type: 'text', label: '  ' },
					{ id: 'c', type: 'text', label: { pt: 'C', 'BAD!': 'x' } },
					{ id: 'd', type: 'text', label: { pt: 1 } },
					{ id: 'e', type: 'text', label: 42 },
					{ id: 'g', type: 'text', label: {} },
				],
			}),
		).toEqual([
			{ path: 'fields[0]', code: 'invalid_type' },
			{ path: 'fields[1].id', code: 'required' },
			{ path: 'fields[2].type', code: 'unknown_field_type' },
			{ path: 'fields[3].label', code: 'required' },
			{ path: 'fields[4].id', code: 'duplicate_id' },
			{ path: 'fields[4].label.BAD!', code: 'invalid_value' },
			{ path: 'fields[5].label.pt', code: 'invalid_type' },
			{ path: 'fields[6].label', code: 'invalid_type' },
			{ path: 'fields[7].label', code: 'too_few' },
		]);
	});

	it('requires unique export keys', () => {
		expect(
			issuesOf({
				...base,
				fields: [
					{ id: 'a', type: 'text', label: 'A' },
					{ id: 'b', key: 'a', type: 'text', label: 'B' },
				],
			}),
		).toEqual([{ path: 'fields[1].key', code: 'duplicate_key' }]);
	});

	it('section accepts neither required nor key', () => {
		expect(
			issuesOf({
				...base,
				fields: [
					{
						id: 's',
						type: 'section',
						label: 'S',
						required: true,
						key: 'k',
					},
				],
			}),
		).toEqual([
			{ path: 'fields[0].required', code: 'invalid_value' },
			{ path: 'fields[0].key', code: 'invalid_value' },
		]);
	});

	it('enforces limits', () => {
		const fields = Array.from({ length: 3 }, (_, i) => ({
			id: `f${i}`,
			type: 'boolean',
			label: 'x',
		}));
		const result = parseSchema(
			{ ...base, fields },
			{ limits: { maxFields: 2 } },
		);
		expect(result.ok).toBe(false);
		expect(
			issuesOf({
				...base,
				fields: [{ id: 'a', type: 'text', label: 'x'.repeat(2001) }],
			}),
		).toEqual([{ path: 'fields[0].label', code: 'too_long' }]);
		expect(
			issuesOf({
				...base,
				fields: [
					{ id: 'a', type: 'text', label: 'ok', maxLength: 10_001 },
				],
			}),
		).toEqual([{ path: 'fields[0].maxLength', code: 'invalid_value' }]);
	});

	describe('per-type config', () => {
		it('text / longText', () => {
			expect(
				issuesOf({
					...base,
					fields: [
						{
							id: 'a',
							type: 'text',
							label: 'A',
							minLength: 5,
							maxLength: 2,
						},
						{ id: 'b', type: 'text', label: 'B', format: 'phone' },
						{
							id: 'c',
							type: 'longText',
							label: 'C',
							minLength: -1,
						},
						{ id: 'd', type: 'text', label: 'D', minLength: 1.5 },
						{ id: 'e', type: 'text', label: 'E', maxLength: '3' },
					],
				}),
			).toEqual([
				{ path: 'fields[0].minLength', code: 'invalid_value' },
				{ path: 'fields[1].format', code: 'invalid_value' },
				{ path: 'fields[2].minLength', code: 'invalid_value' },
				{ path: 'fields[3].minLength', code: 'invalid_value' },
				{ path: 'fields[4].maxLength', code: 'invalid_type' },
			]);
		});

		it('number / scale / boolean', () => {
			expect(
				issuesOf({
					...base,
					fields: [
						{ id: 'a', type: 'number', label: 'A', min: 5, max: 1 },
						{ id: 'b', type: 'number', label: 'B', integer: 'yes' },
						{ id: 'c', type: 'scale', label: 'C', min: 3, max: 3 },
						{
							id: 'd',
							type: 'scale',
							label: 'D',
							min: 0,
							max: 500,
						},
						{ id: 'e', type: 'scale', label: 'E', max: 4.5 },
					],
				}),
			).toEqual([
				{ path: 'fields[0].min', code: 'invalid_value' },
				{ path: 'fields[1].integer', code: 'invalid_type' },
				{ path: 'fields[2].max', code: 'invalid_value' },
				{ path: 'fields[3].max', code: 'too_many' },
				{ path: 'fields[4].max', code: 'invalid_value' },
			]);
		});

		it('choice / multiChoice', () => {
			expect(
				issuesOf({
					...base,
					fields: [
						{ id: 'a', type: 'choice', label: 'A' },
						{ id: 'b', type: 'choice', label: 'B', options: [] },
						{ id: 'c', type: 'choice', label: 'C', options: 'x' },
						{
							id: 'd',
							type: 'choice',
							label: 'D',
							options: [
								{ id: 'x', label: 'X' },
								{ id: 'x', label: 'Y' },
								3,
								{ label: 'Z' },
							],
						},
						{
							id: 'e',
							type: 'multiChoice',
							label: 'E',
							options: [{ id: 'x', label: 'X' }],
							maxSelected: 2,
						},
						{
							id: 'g',
							type: 'multiChoice',
							label: 'G',
							options: [
								{ id: 'x', label: 'X' },
								{ id: 'y', label: 'Y' },
							],
							minSelected: 2,
							maxSelected: 1,
						},
					],
				}),
			).toEqual([
				{ path: 'fields[0].options', code: 'required' },
				{ path: 'fields[1].options', code: 'too_few' },
				{ path: 'fields[2].options', code: 'invalid_type' },
				{ path: 'fields[3].options[1].id', code: 'duplicate_id' },
				{ path: 'fields[3].options[2]', code: 'invalid_type' },
				{ path: 'fields[3].options[3].id', code: 'required' },
				{ path: 'fields[4].maxSelected', code: 'invalid_value' },
				{ path: 'fields[5].minSelected', code: 'invalid_value' },
			]);
			const many = Array.from({ length: 201 }, (_, i) => ({
				id: `o${i}`,
				label: 'x',
			}));
			expect(
				issuesOf({
					...base,
					fields: [
						{ id: 'a', type: 'choice', label: 'A', options: many },
					],
				}),
			).toEqual([{ path: 'fields[0].options', code: 'too_many' }]);
		});
	});

	describe('showIf', () => {
		const fields = [
			{ id: 'ok', type: 'boolean', label: 'Ok?' },
			{ id: 'age', type: 'number', label: 'Age' },
			{
				id: 'color',
				type: 'choice',
				label: 'Color',
				options: [{ id: 'red', label: 'Red' }],
			},
			{
				id: 'tags',
				type: 'multiChoice',
				label: 'Tags',
				options: [{ id: 't1', label: 'T1' }],
			},
			{ id: 'intro', type: 'section', label: 'Intro' },
		];
		const withCondition = (showIf: unknown) => ({
			...base,
			fields: [
				...fields,
				{ id: 'target', type: 'text', label: 'Target', showIf },
			],
		});
		const conditionIssues = (showIf: unknown) =>
			issuesOf(withCondition(showIf)).map((i) => ({
				code: i.code,
				path: i.path.replace('fields[5].showIf', '$'),
			}));

		it('accepts valid conditions', () => {
			const result = parseSchema(
				withCondition({
					all: [
						{ field: 'ok', op: 'eq', value: true },
						{
							any: [
								{ field: 'age', op: 'gte', value: 18 },
								{ field: 'color', op: 'in', value: ['red'] },
							],
						},
						{ not: { field: 'tags', op: 'includes', value: 't1' } },
						{ field: 'age', op: 'answered', value: 'ignorado' },
					],
				}),
			);
			expect(result.ok).toBe(true);
			if (!result.ok) return;
			expect(result.value.fields[5]?.showIf).toEqual({
				all: [
					{ field: 'ok', op: 'eq', value: true },
					{
						any: [
							{ field: 'age', op: 'gte', value: 18 },
							{ field: 'color', op: 'in', value: ['red'] },
						],
					},
					{ not: { field: 'tags', op: 'includes', value: 't1' } },
					{ field: 'age', op: 'answered' },
				],
			});
		});

		it.each<[unknown, string, string]>([
			['x', '$', 'invalid_condition'],
			[{}, '$', 'invalid_condition'],
			[{ all: [], any: [] }, '$', 'invalid_condition'],
			[{ all: [] }, '$', 'invalid_condition'],
			[{ not: 3 }, '$.not', 'invalid_condition'],
			[{ field: 'ok', op: 'like' }, '$.op', 'unsupported_operator'],
			[
				{ field: 'nada', op: 'eq', value: 1 },
				'$.field',
				'unknown_reference',
			],
			[
				{ field: 'intro', op: 'answered' },
				'$.field',
				'invalid_condition',
			],
			[
				{ field: 'ok', op: 'gt', value: 1 },
				'$.op',
				'unsupported_operator',
			],
			[
				{ field: 'ok', op: 'eq', value: 'sim' },
				'$.value',
				'invalid_value',
			],
			[
				{ field: 'age', op: 'gt', value: '3' },
				'$.value',
				'invalid_value',
			],
			[
				{ field: 'color', op: 'eq', value: 'blue' },
				'$.value',
				'invalid_value',
			],
			[
				{ field: 'color', op: 'in', value: [] },
				'$.value',
				'invalid_value',
			],
			[
				{ field: 'tags', op: 'includes', value: 'zz' },
				'$.value',
				'invalid_value',
			],
			[
				{ field: 'age', op: 'eq', value: Number.NaN },
				'$.value',
				'invalid_value',
			],
		])('%o → %s %s', (showIf, path, code) => {
			expect(conditionIssues(showIf)).toEqual([{ path, code }]);
		});

		it('refuses references to the field itself or later fields', () => {
			expect(
				issuesOf({
					...base,
					fields: [
						{
							id: 'a',
							type: 'boolean',
							label: 'A',
							showIf: { field: 'b', op: 'answered' },
						},
						{
							id: 'b',
							type: 'boolean',
							label: 'B',
							showIf: { field: 'b', op: 'answered' },
						},
					],
				}),
			).toEqual([
				{ path: 'fields[0].showIf.field', code: 'forward_reference' },
				{ path: 'fields[1].showIf.field', code: 'forward_reference' },
			]);
		});

		it('does not repeat the error when the referenced field is already invalid', () => {
			expect(
				issuesOf({
					...base,
					fields: [
						{ id: 'a', type: 'number', label: 'A', min: 'x' },
						{
							id: 'b',
							type: 'boolean',
							label: 'B',
							showIf: { field: 'a', op: 'answered' },
						},
					],
				}),
			).toEqual([{ path: 'fields[0].min', code: 'invalid_type' }]);
		});

		it('limits depth and node count', () => {
			let deep: unknown = { field: 'ok', op: 'answered' };
			for (let i = 0; i < 10; i++) deep = { not: deep };
			expect(conditionIssues(deep)).toEqual([
				{ path: '$.not.not.not.not.not.not.not.not', code: 'too_many' },
			]);

			const wide = {
				any: Array.from({ length: 100 }, () => ({
					field: 'ok',
					op: 'answered',
				})),
			};
			expect(conditionIssues(wide)).toEqual([
				{ path: '$.any[63]', code: 'too_many' },
			]);
		});
	});

	it('FormSchemaError lists the problems', () => {
		const result = parseSchema({
			...base,
			fields: [{ id: 'a', type: 'x', label: 'A' }],
		});
		if (result.ok) throw new Error('unreachable');
		const error = new FormSchemaError(result.issues);
		expect(error.message).toContain(
			'fields[0].type: unknown field type "x"',
		);
		expect(error.issues).toHaveLength(1);
	});
});
