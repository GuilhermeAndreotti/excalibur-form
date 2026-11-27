import { describe, expect, it } from 'vitest';

import { evaluateCondition, type FieldLookup } from './evaluate.ts';
import type { Condition } from './types.ts';

const lookupFrom =
	(answers: Record<string, unknown>): FieldLookup =>
	(id) =>
		id in answers
			? { answered: true, value: answers[id] }
			: { answered: false };

const answers = lookupFrom({
	age: 30,
	name: 'Ana',
	ok: true,
	tags: ['a', 'b'],
});
const check = (condition: Condition) => evaluateCondition(condition, answers);

describe('evaluateCondition', () => {
	it.each<[Condition, boolean]>([
		[{ field: 'age', op: 'eq', value: 30 }, true],
		[{ field: 'age', op: 'eq', value: '30' }, false],
		[{ field: 'age', op: 'neq', value: 31 }, true],
		[{ field: 'age', op: 'gt', value: 29 }, true],
		[{ field: 'age', op: 'gte', value: 30 }, true],
		[{ field: 'age', op: 'lt', value: 30 }, false],
		[{ field: 'age', op: 'lte', value: 30 }, true],
		[{ field: 'name', op: 'gt', value: 1 }, false],
		[{ field: 'name', op: 'in', value: ['Ana', 'Bia'] }, true],
		[{ field: 'name', op: 'notIn', value: ['Ana'] }, false],
		[{ field: 'tags', op: 'in', value: ['a'] }, false],
		[{ field: 'tags', op: 'notIn', value: ['a'] }, false],
		[{ field: 'tags', op: 'includes', value: 'b' }, true],
		[{ field: 'name', op: 'includes', value: 'A' }, false],
		[{ field: 'ok', op: 'answered' }, true],
		[{ field: 'missing', op: 'notAnswered' }, true],
	])('%o → %s', (condition, expected) => {
		expect(check(condition)).toBe(expected);
	});

	it('comparisons on an unanswered field are false (neq included)', () => {
		expect(check({ field: 'missing', op: 'eq', value: 1 })).toBe(false);
		expect(check({ field: 'missing', op: 'neq', value: 1 })).toBe(false);
		expect(check({ field: 'missing', op: 'notIn', value: [1] })).toBe(
			false,
		);
	});

	it('combines all / any / not', () => {
		expect(
			check({
				all: [
					{ field: 'ok', op: 'eq', value: true },
					{
						any: [
							{ field: 'age', op: 'lt', value: 18 },
							{ field: 'name', op: 'eq', value: 'Ana' },
						],
					},
					{ not: { field: 'tags', op: 'includes', value: 'z' } },
				],
			}),
		).toBe(true);
		expect(check({ any: [{ field: 'missing', op: 'answered' }] })).toBe(
			false,
		);
		expect(check({ all: [{ field: 'ok', op: 'eq', value: false }] })).toBe(
			false,
		);
	});
});
