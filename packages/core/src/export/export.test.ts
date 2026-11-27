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

const inspection = defineForm({
	id: 'inspection',
	version: 1,
	title: { en: 'Inspection', pt: 'Vistoria' },
	fields: [
		{ id: 'intro', type: 'section', label: 'Vehicle' },
		{
			id: 'plate',
			key: 'plate_number',
			type: 'text',
			label: { en: 'Plate', pt: 'Placa' },
			required: true,
		},
		{
			id: 'extras',
			type: 'multiChoice',
			label: 'Extras',
			options: [
				{ id: 'ac', label: { en: 'A/C', pt: 'Ar' } },
				{ id: 'sunroof', label: 'Sunroof' },
			],
		},
		{ id: 'has_fines', type: 'boolean', label: 'Any fines?' },
		{
			id: 'fines_amount',
			type: 'number',
			label: 'Fines amount',
			showIf: { field: 'has_fines', op: 'eq', value: true },
		},
		{ id: 'more', type: 'section', label: 'More' },
		{
			id: 'fuel',
			type: 'choice',
			label: 'Fuel',
			options: [
				{ id: 'flex', label: 'Flex' },
				{ id: 'diesel', label: 'Diesel' },
			],
		},
		{ id: 'notes', type: 'longText', label: 'Notes' },
	],
});

const answers = {
	plate: 'ABC1D23',
	extras: ['sunroof', 'ac'],
	has_fines: true,
	fines_amount: 1234.5,
};

const answerTexts = (items: ReturnType<typeof toQAList>) =>
	items.map((item) => (item.kind === 'answer' ? item.answer : ''));

describe('toJSON', () => {
	it('uses the key, follows schema order and skips empty answers', () => {
		const json = toJSON(inspection, {
			fines_amount: 10,
			plate: 'X',
			has_fines: true,
			notes: '   ',
		});
		expect(json).toEqual({
			plate_number: 'X',
			has_fines: true,
			fines_amount: 10,
		});
		expect(Object.keys(json)).toEqual([
			'plate_number',
			'has_fines',
			'fines_amount',
		]);
	});

	it('drops hidden fields and unknown keys', () => {
		expect(
			toJSON(inspection, {
				plate: 'X',
				has_fines: false,
				fines_amount: 99,
				hack: 1,
			}),
		).toEqual({ plate_number: 'X', has_fines: false });
	});
});

describe('toEntries / toFormData', () => {
	it('one entry per list item, values as strings', () => {
		expect(toEntries(inspection, answers)).toEqual([
			['plate_number', 'ABC1D23'],
			['extras', 'sunroof'],
			['extras', 'ac'],
			['has_fines', 'true'],
			['fines_amount', '1234.5'],
		]);
	});

	it('builds a FormData', () => {
		const formData = toFormData(inspection, answers) as unknown as {
			getAll(name: string): string[];
		};
		expect(formData.getAll('extras')).toEqual(['sunroof', 'ac']);
		expect(formData.getAll('plate_number')).toEqual(['ABC1D23']);
	});
});

describe('toQAList', () => {
	it('resolves labels, options and booleans (English by default)', () => {
		expect(toQAList(inspection, answers)).toEqual([
			{
				kind: 'answer',
				fieldId: 'plate',
				key: 'plate_number',
				type: 'text',
				question: 'Plate',
				answer: 'ABC1D23',
				value: 'ABC1D23',
				answered: true,
			},
			expect.objectContaining({
				question: 'Extras',
				answer: 'Sunroof, A/C',
				value: ['sunroof', 'ac'],
			}),
			expect.objectContaining({ question: 'Any fines?', answer: 'Yes' }),
			expect.objectContaining({ answer: '1234.5' }),
		]);
	});

	it('uses the requested language (with region) for texts and numbers', () => {
		const pt = toQAList(inspection, answers, { locale: 'pt-BR' });
		expect(pt[0]).toMatchObject({ question: 'Placa' });
		expect(answerTexts(pt)).toEqual([
			'ABC1D23',
			'Sunroof, Ar',
			'Sim',
			'1.234,5',
		]);
		const en = toQAList(inspection, answers, { locale: 'en-US' });
		expect(answerTexts(en).at(-1)).toBe('1,234.5');
	});

	it('accepts custom labels', () => {
		const items = toQAList(
			inspection,
			{ plate: 'X', has_fines: false },
			{ labels: { no: 'Nope' } },
		);
		expect(items[1]).toMatchObject({ answer: 'Nope' });
	});

	it('includes unanswered fields and sections when asked', () => {
		const items = toQAList(
			inspection,
			{ plate: 'X', has_fines: false },
			{
				includeUnanswered: true,
				includeSections: true,
				emptyAnswer: '-',
			},
		);
		expect(items.map((i) => `${i.kind}:${i.fieldId}`)).toEqual([
			'section:intro',
			'answer:plate',
			'answer:extras',
			'answer:has_fines',
			'section:more',
			'answer:fuel',
			'answer:notes',
		]);
		expect(items[2]).toMatchObject({
			answer: '-',
			answered: false,
			value: undefined,
		});
	});

	it('skips sections with no answers after them', () => {
		const items = toQAList(
			inspection,
			{ plate: 'X' },
			{ includeSections: true },
		);
		expect(items.map((i) => i.fieldId)).toEqual(['intro', 'plate']);
	});
});

describe('toCSV', () => {
	it('one row per submission, header with labels', () => {
		const csv = toCSV(inspection, [
			answers,
			{ plate: 'Z, "quoted"', has_fines: false, notes: 'line 1\nline 2' },
		]);
		expect(csv.split('\r\n')).toEqual([
			'Plate,Extras,Any fines?,Fines amount,Fuel,Notes',
			'ABC1D23,"Sunroof, A/C",Yes,1234.5,,',
			'"Z, ""quoted""",,No,,,"line 1\nline 2"',
		]);
	});

	it('pt-BR display values', () => {
		const csv = toCSV(inspection, [answers], {
			locale: 'pt-BR',
			delimiter: ';',
		});
		expect(csv.split('\r\n')[1]).toBe('ABC1D23;Sunroof, Ar;Sim;1.234,5;;');
	});

	it('raw mode, key header, delimiter and BOM', () => {
		const csv = toCSV(inspection, [answers], {
			header: 'key',
			values: 'raw',
			delimiter: ';',
			newline: '\n',
			bom: true,
		});
		expect(csv).toBe(
			'﻿plate_number;extras;has_fines;fines_amount;fuel;notes\n' +
				'ABC1D23;sunroof, ac;true;1234.5;;',
		);
	});

	it('neutralizes formulas in text, but not in numbers', () => {
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

	it('with no submissions, only the header', () => {
		expect(toCSV(inspection, [], { header: 'key' })).toBe(
			'plate_number,extras,has_fines,fines_amount,fuel,notes',
		);
	});
});

describe('toMarkdown', () => {
	it('title, sections and list', () => {
		expect(toMarkdown(inspection, answers)).toBe(
			[
				'# Inspection',
				'',
				'## Vehicle',
				'',
				'- **Plate:** ABC1D23',
				'- **Extras:** Sunroof, A/C',
				'- **Any fines?:** Yes',
				'- **Fines amount:** 1234.5',
				'',
			].join('\n'),
		);
	});

	it('escapes user text and keeps line breaks', () => {
		const md = toMarkdown(
			inspection,
			{
				plate: '**bold** <img src=x onerror=alert(1)>',
				notes: 'line 1\n\n- not a list\n[link](http://x)',
			},
			{ title: false, includeSections: false },
		);
		expect(md).toBe(
			[
				'- **Plate:** \\*\\*bold\\*\\* \\<img src=x onerror=alert(1)\\>',
				'- **Notes:** line 1\\',
				'  \\- not a list\\',
				'  \\[link\\](http://x)',
				'',
			].join('\n'),
		);
	});

	it('shows unanswered fields with a dash, in the requested language', () => {
		const md = toMarkdown(
			inspection,
			{ plate: 'X' },
			{ includeUnanswered: true, locale: 'pt-BR' },
		);
		expect(md).toContain('# Vistoria');
		expect(md).toContain('- **Placa:** X');
		expect(md).toContain('- **Any fines?:** —');
	});

	it('a form with no answers and no title gives an empty string', () => {
		const form = defineForm({
			id: 'f',
			version: 1,
			fields: [{ id: 't', type: 'text', label: 'T' }],
		});
		expect(toMarkdown(form, {})).toBe('');
	});

	it('escapeMarkdown', () => {
		expect(escapeMarkdown('1. item')).toBe('1\\. item');
		expect(escapeMarkdown('# title')).toBe('\\# title');
		expect(escapeMarkdown('a & b | c')).toBe('a \\& b \\| c');
	});
});

describe('custom types', () => {
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
				{ id: 'location', type: 'geo', label: 'Location' },
			],
		},
		{ registry: createRegistry([...builtinFieldTypes, cpf, geo]) },
	);
	if (!parsed.ok) throw new Error('invalid schema');
	const form = parsed.value;
	const answer = (value: unknown) => {
		const item = toQAList(form, { location: value })[0];
		return item?.kind === 'answer' ? item.answer : undefined;
	};

	it("uses the type's toDisplay", () => {
		expect(toQAList(form, { doc: '12345678901' })[0]).toMatchObject({
			answer: '123.***.***-01',
		});
	});

	it('without toDisplay, converts generically', () => {
		expect(answer('text')).toBe('text');
		expect(answer(3)).toBe('3');
		expect(answer(true)).toBe('Yes');
		expect(answer([1, false])).toBe('1, No');
		expect(answer({ lat: 1 })).toBe('{"lat":1}');
		expect(answer(null)).toBe('');
		expect(toEntries(form, { location: { lat: 1 } })).toEqual([
			['location', '{"lat":1}'],
		]);
		expect(toCSV(form, [{ location: { lat: 1 } }], { values: 'raw' })).toBe(
			'CPF,Location\r\n,"{""lat"":1}"',
		);
	});
});

describe('display', () => {
	it('unknown language falls back to fallbackLocale, then English', () => {
		expect(createDisplayContext({ locale: 'fr' }).labels.yes).toBe('Yes');
		expect(
			createDisplayContext({ locale: 'fr', fallbackLocale: 'pt' }).labels
				.yes,
		).toBe('Sim');
		expect(createDisplayContext().labels.no).toBe('No');
		expect(createDisplayContext({ locale: 'pt_BR' }).labels.no).toBe('Não');
	});

	it('formatNumber tolerates an invalid language tag', () => {
		expect(formatNumber(1.5, createDisplayContext({ locale: '!!' }))).toBe(
			'1.5',
		);
	});
});
