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

const vistoria = defineForm({
	id: 'vistoria',
	version: 1,
	fields: [
		{ id: 'intro', type: 'section', label: 'Dados do veículo' },
		{ id: 'placa', type: 'text', label: 'Placa', required: true },
		{
			id: 'combustivel',
			type: 'choice',
			label: 'Combustível',
			required: true,
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
			],
		},
		{
			id: 'opcionais',
			type: 'multiChoice',
			label: 'Opcionais',
			options: [
				{ id: 'ar', label: 'Ar' },
				{ id: 'teto', label: 'Teto solar' },
			],
		},
		{
			id: 'tem_multa',
			type: 'boolean',
			label: 'Possui multas?',
			required: true,
		},
		{
			id: 'valor_multas',
			type: 'number',
			label: 'Valor das multas',
			required: true,
			min: 0,
			showIf: { field: 'tem_multa', op: 'eq', value: true },
		},
		{ id: 'nota', type: 'scale', label: 'Estado geral', max: 10 },
	],
});

describe('defineForm', () => {
	it('infere o tipo das respostas', () => {
		type Answers = InferAnswers<typeof vistoria.schema>;
		expectTypeOf<Answers>().toEqualTypeOf<{
			placa: string;
			combustivel: 'flex' | 'diesel';
			tem_multa: boolean;
			opcionais?: ('ar' | 'teto')[];
			valor_multas?: number;
			nota?: number;
		}>();
		const result = vistoria.validate({});
		if (result.ok) expectTypeOf(result.data).toEqualTypeOf<Answers>();
	});

	it('valida, descarta chaves desconhecidas e campos escondidos', () => {
		const result = vistoria.validate({
			placa: 'ABC1D23',
			combustivel: 'flex',
			tem_multa: false,
			valor_multas: 'ignorado porque está escondido',
			opcionais: ['teto'],
			hack: true,
		});
		expect(result).toEqual({
			ok: true,
			data: {
				placa: 'ABC1D23',
				combustivel: 'flex',
				tem_multa: false,
				opcionais: ['teto'],
			},
		});
	});

	it('valida campo condicional quando ele aparece', () => {
		const result = vistoria.validate({
			placa: 'X',
			combustivel: 'diesel',
			tem_multa: true,
		});
		expect(result).toEqual({
			ok: false,
			errors: [{ fieldId: 'valor_multas', code: 'required' }],
		});
	});

	it('junta todos os erros', () => {
		const result = vistoria.validate({ combustivel: 'gasolina', nota: 11 });
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.map((e) => `${e.fieldId}:${e.code}`)).toEqual([
			'placa:required',
			'combustivel:invalid_option',
			'tem_multa:required',
			'nota:too_big',
		]);
	});

	it('rejeita respostas que não são objeto', () => {
		for (const input of [null, [], 'x']) {
			expect(vistoria.validate(input)).toEqual({
				ok: false,
				errors: [{ fieldId: null, code: 'invalid_type' }],
			});
		}
	});

	it('ignora propriedades herdadas do prototype', () => {
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

	it('lança FormSchemaError com schema inválido', () => {
		expect(() =>
			defineForm({
				id: 'f',
				version: 1,
				fields: [{ id: 'a', type: 'choice', label: 'A', options: [] }],
			}),
		).toThrow(FormSchemaError);
	});

	it('expõe helpers', () => {
		expect(vistoria.field('placa')?.label).toBe('Placa');
		expect(vistoria.field('nada')).toBeUndefined();
		expect(vistoria.answerableFields.map((f) => f.id)).not.toContain(
			'intro',
		);
		expect(vistoria.limits.maxFields).toBe(500);
		expect(Object.isFrozen(vistoria.schema)).toBe(true);
	});
});

describe('visibleFieldIds', () => {
	it('atualiza com as respostas e propaga em cascata', () => {
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
		expect([...form.visibleFieldIds({ a: true, b: 'oi' })]).toEqual([
			'a',
			'b',
			'c',
		]);
		// b escondido → resposta de b não conta → c some também
		expect([...form.visibleFieldIds({ a: false, b: 'oi' })]).toEqual(['a']);
		expect([...form.visibleFieldIds({ a: true, b: '   ' })]).toEqual([
			'a',
			'b',
		]);
	});
});

describe('parseForm', () => {
	it('monta form a partir de JSON', () => {
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

	it('devolve issues sem lançar', () => {
		const parsed = parseForm({ id: 'f' });
		expect(parsed.ok).toBe(false);
	});
});

describe('tipos customizados', () => {
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

	it('funciona via registry', () => {
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

	it('não aceita o tipo sem registry', () => {
		expect(
			parseForm({
				id: 'f',
				version: 1,
				fields: [{ id: 'doc', type: 'cpf', label: 'CPF' }],
			}).ok,
		).toBe(false);
	});

	it('não deixa registrar o mesmo tipo duas vezes', () => {
		expect(() => createRegistry([cpfType, cpfType])).toThrow(
			'registered twice',
		);
	});
});

describe('resolveText', () => {
	it('resolve idioma com fallback', () => {
		const text = { pt: 'Olá', en: 'Hello' };
		expect(resolveText('Oi')).toBe('Oi');
		expect(resolveText(text, 'en')).toBe('Hello');
		expect(resolveText(text, 'en-US')).toBe('Hello');
		expect(resolveText(text, 'es-AR', 'en_GB')).toBe('Hello');
		expect(resolveText(text, 'es', 'pt')).toBe('Olá');
		expect(resolveText(text, 'es')).toBe('Olá');
		expect(resolveText({}, 'es')).toBe('');
	});
});
