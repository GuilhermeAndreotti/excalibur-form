import { describe, expect, it } from 'vitest';

import { defineFieldType } from '../fields/definition.ts';
import { builtinFieldTypes, createRegistry } from '../fields/registry.ts';
import { defineForm, parseForm } from '../form.ts';
import type { FieldBase } from '../schema/types.ts';
import { accept, reject } from '../validation/errors.ts';
import { toCSV } from './csv.ts';
import { createDisplayContext, formatNumber } from './display.ts';
import { toEntries, toFormData } from './form-data.ts';
import { toJSON } from './json.ts';
import { escapeMarkdown, toMarkdown } from './markdown.ts';
import { toQAList } from './qa-list.ts';

const vistoria = defineForm({
	id: 'vistoria',
	version: 1,
	title: { pt: 'Vistoria', en: 'Inspection' },
	fields: [
		{ id: 'intro', type: 'section', label: 'Dados do veículo' },
		{
			id: 'placa',
			key: 'plate',
			type: 'text',
			label: { pt: 'Placa', en: 'Plate' },
			required: true,
		},
		{
			id: 'opcionais',
			type: 'multiChoice',
			label: 'Opcionais',
			options: [
				{ id: 'ar', label: { pt: 'Ar', en: 'A/C' } },
				{ id: 'teto', label: 'Teto solar' },
			],
		},
		{ id: 'tem_multa', type: 'boolean', label: 'Possui multas?' },
		{
			id: 'valor_multas',
			type: 'number',
			label: 'Valor das multas',
			showIf: { field: 'tem_multa', op: 'eq', value: true },
		},
		{ id: 'extra', type: 'section', label: 'Extras' },
		{
			id: 'combustivel',
			type: 'choice',
			label: 'Combustível',
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
			],
		},
		{ id: 'obs', type: 'longText', label: 'Observações' },
	],
});

const answers = {
	placa: 'ABC1D23',
	opcionais: ['teto', 'ar'],
	tem_multa: true,
	valor_multas: 1234.5,
};

describe('toJSON', () => {
	it('usa a key, segue a ordem do schema e omite vazios', () => {
		const json = toJSON(vistoria, {
			valor_multas: 10,
			placa: 'X',
			tem_multa: true,
			obs: '   ',
		});
		expect(json).toEqual({ plate: 'X', tem_multa: true, valor_multas: 10 });
		expect(Object.keys(json)).toEqual([
			'plate',
			'tem_multa',
			'valor_multas',
		]);
	});

	it('descarta campos escondidos e chaves desconhecidas', () => {
		expect(
			toJSON(vistoria, {
				placa: 'X',
				tem_multa: false,
				valor_multas: 99,
				hack: 1,
			}),
		).toEqual({ plate: 'X', tem_multa: false });
	});
});

describe('toEntries / toFormData', () => {
	it('uma entrada por item de lista, valores como string', () => {
		expect(toEntries(vistoria, answers)).toEqual([
			['plate', 'ABC1D23'],
			['opcionais', 'teto'],
			['opcionais', 'ar'],
			['tem_multa', 'true'],
			['valor_multas', '1234.5'],
		]);
	});

	it('monta um FormData', () => {
		const formData = toFormData(vistoria, answers) as unknown as {
			getAll(name: string): string[];
		};
		expect(formData.getAll('opcionais')).toEqual(['teto', 'ar']);
		expect(formData.getAll('plate')).toEqual(['ABC1D23']);
	});
});

describe('toQAList', () => {
	it('resolve labels, opções e booleanos', () => {
		expect(toQAList(vistoria, answers)).toEqual([
			{
				kind: 'answer',
				fieldId: 'placa',
				key: 'plate',
				type: 'text',
				question: 'Placa',
				answer: 'ABC1D23',
				value: 'ABC1D23',
				answered: true,
			},
			expect.objectContaining({
				question: 'Opcionais',
				answer: 'Teto solar, Ar',
				value: ['teto', 'ar'],
			}),
			expect.objectContaining({
				question: 'Possui multas?',
				answer: 'Sim',
			}),
			expect.objectContaining({ answer: '1234.5' }),
		]);
	});

	it('usa o idioma pedido (com região) pra textos e números', () => {
		const items = toQAList(vistoria, answers, { locale: 'en-US' });
		expect(items.map((i) => (i.kind === 'answer' ? i.answer : ''))).toEqual(
			['ABC1D23', 'Teto solar, A/C', 'Yes', '1,234.5'],
		);
		const pt = toQAList(vistoria, answers, { locale: 'pt-BR' });
		expect(pt.at(-1)).toMatchObject({ answer: '1.234,5' });
	});

	it('aceita textos próprios', () => {
		const items = toQAList(
			vistoria,
			{ placa: 'X', tem_multa: false },
			{ labels: { no: 'Negativo' } },
		);
		expect(items[1]).toMatchObject({ answer: 'Negativo' });
	});

	it('inclui não respondidos e seções quando pedido', () => {
		const items = toQAList(
			vistoria,
			{ placa: 'X', tem_multa: false },
			{
				includeUnanswered: true,
				includeSections: true,
				emptyAnswer: '-',
			},
		);
		expect(items.map((i) => `${i.kind}:${i.fieldId}`)).toEqual([
			'section:intro',
			'answer:placa',
			'answer:opcionais',
			'answer:tem_multa',
			'section:extra',
			'answer:combustivel',
			'answer:obs',
		]);
		expect(items[2]).toMatchObject({
			answer: '-',
			answered: false,
			value: undefined,
		});
	});

	it('omite seções sem respostas depois delas', () => {
		const items = toQAList(
			vistoria,
			{ placa: 'X' },
			{ includeSections: true },
		);
		expect(items.map((i) => i.fieldId)).toEqual(['intro', 'placa']);
	});
});

describe('toCSV', () => {
	it('uma linha por submissão, cabeçalho com labels', () => {
		const csv = toCSV(vistoria, [
			answers,
			{ placa: 'Z, "aspas"', tem_multa: false, obs: 'linha 1\nlinha 2' },
		]);
		expect(csv.split('\r\n')).toEqual([
			'Placa,Opcionais,Possui multas?,Valor das multas,Combustível,Observações',
			'ABC1D23,"Teto solar, Ar",Sim,1234.5,,',
			'"Z, ""aspas""",,Não,,,"linha 1\nlinha 2"',
		]);
	});

	it('modo raw, cabeçalho por key, delimitador e BOM', () => {
		const csv = toCSV(vistoria, [answers], {
			header: 'key',
			values: 'raw',
			delimiter: ';',
			newline: '\n',
			bom: true,
		});
		expect(csv).toBe(
			'﻿plate;opcionais;tem_multa;valor_multas;combustivel;obs\n' +
				'ABC1D23;teto, ar;true;1234.5;;',
		);
	});

	it('neutraliza fórmulas em textos, mas não em números', () => {
		const form = defineForm({
			id: 'f',
			version: 1,
			fields: [
				{ id: 't', type: 'text', label: '=Label' },
				{ id: 'n', type: 'number', label: 'N' },
			],
		});
		const rows = [{ t: '=HYPERLINK("x")', n: -5 }];
		expect(toCSV(form, rows).split('\r\n')).toEqual([
			"'=Label,N",
			`"'=HYPERLINK(""x"")",-5`,
		]);
		expect(toCSV(form, rows, { escapeFormulas: false })).toContain(
			'"=HYPERLINK(""x"")",-5',
		);
	});

	it('sem submissões, só o cabeçalho', () => {
		expect(toCSV(vistoria, [], { header: 'key' })).toBe(
			'plate,opcionais,tem_multa,valor_multas,combustivel,obs',
		);
	});
});

describe('toMarkdown', () => {
	it('título, seções e lista', () => {
		expect(toMarkdown(vistoria, answers)).toBe(
			[
				'# Vistoria',
				'',
				'## Dados do veículo',
				'',
				'- **Placa:** ABC1D23',
				'- **Opcionais:** Teto solar, Ar',
				'- **Possui multas?:** Sim',
				'- **Valor das multas:** 1234.5',
				'',
			].join('\n'),
		);
	});

	it('escapa texto de usuário e preserva quebras de linha', () => {
		const md = toMarkdown(
			vistoria,
			{
				placa: '**negrito** <img src=x onerror=alert(1)>',
				obs: 'linha 1\n\n- não é lista\n[link](http://x)',
			},
			{ title: false, includeSections: false },
		);
		expect(md).toBe(
			[
				'- **Placa:** \\*\\*negrito\\*\\* \\<img src=x onerror=alert(1)\\>',
				'- **Observações:** linha 1\\',
				'  \\- não é lista\\',
				'  \\[link\\](http://x)',
				'',
			].join('\n'),
		);
	});

	it('mostra não respondidos com travessão', () => {
		const md = toMarkdown(
			vistoria,
			{ placa: 'X' },
			{ includeUnanswered: true, locale: 'en' },
		);
		expect(md).toContain('# Inspection');
		expect(md).toContain('- **Plate:** X');
		expect(md).toContain('- **Possui multas?:** —');
	});

	it('form sem respostas e sem título gera string vazia', () => {
		const form = defineForm({
			id: 'f',
			version: 1,
			fields: [{ id: 't', type: 'text', label: 'T' }],
		});
		expect(toMarkdown(form, {})).toBe('');
	});

	it('escapeMarkdown', () => {
		expect(escapeMarkdown('1. item')).toBe('1\\. item');
		expect(escapeMarkdown('# título')).toBe('\\# título');
		expect(escapeMarkdown('a & b | c')).toBe('a \\& b \\| c');
	});
});

describe('tipos customizados', () => {
	interface CpfField extends FieldBase {
		readonly type: 'cpf';
	}
	interface GeoField extends FieldBase {
		readonly type: 'geo';
	}
	const cpf = defineFieldType<CpfField, string>({
		type: 'cpf',
		answerable: true,
		conditionOps: [],
		parseConfig: () => ({}),
		isEmpty: (v) => v === undefined || v === '',
		validate: (v) =>
			typeof v === 'string' ? accept(v) : reject('invalid_type'),
		toDisplay: (v) => `${v.slice(0, 3)}.***.***-${v.slice(-2)}`,
	});
	const geo = defineFieldType<GeoField, unknown>({
		type: 'geo',
		answerable: true,
		conditionOps: [],
		parseConfig: () => ({}),
		isEmpty: (v) => v === undefined,
		validate: (v) => accept(v),
	});
	const parsed = parseForm(
		{
			id: 'c',
			version: 1,
			fields: [
				{ id: 'doc', type: 'cpf', label: 'CPF' },
				{ id: 'local', type: 'geo', label: 'Local' },
			],
		},
		{ registry: createRegistry([...builtinFieldTypes, cpf, geo]) },
	);
	if (!parsed.ok) throw new Error('schema inválido');
	const form = parsed.value;
	const answer = (value: unknown) =>
		toQAList(form, { local: value })[0]?.kind === 'answer'
			? (toQAList(form, { local: value })[0] as { answer: string }).answer
			: undefined;

	it('usa o toDisplay do tipo', () => {
		expect(toQAList(form, { doc: '12345678901' })[0]).toMatchObject({
			answer: '123.***.***-01',
		});
	});

	it('sem toDisplay, converte de forma genérica', () => {
		expect(answer('texto')).toBe('texto');
		expect(answer(3)).toBe('3');
		expect(answer(true)).toBe('Sim');
		expect(answer([1, false])).toBe('1, Não');
		expect(answer({ lat: 1 })).toBe('{"lat":1}');
		expect(answer(null)).toBe('');
		expect(toEntries(form, { local: { lat: 1 } })).toEqual([
			['local', '{"lat":1}'],
		]);
		expect(toCSV(form, [{ local: { lat: 1 } }], { values: 'raw' })).toBe(
			'CPF,Local\r\n,"{""lat"":1}"',
		);
	});
});

describe('display', () => {
	it('idioma desconhecido cai no fallback e depois em pt', () => {
		expect(createDisplayContext({ locale: 'fr' }).labels.yes).toBe('Sim');
		expect(
			createDisplayContext({ locale: 'fr', fallbackLocale: 'en' }).labels
				.yes,
		).toBe('Yes');
		expect(createDisplayContext().labels.no).toBe('Não');
	});

	it('formatNumber tolera tag de idioma inválida', () => {
		expect(formatNumber(1.5, createDisplayContext({ locale: '!!' }))).toBe(
			'1.5',
		);
	});
});
