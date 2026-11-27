import type { Condition, FieldCondition } from './types.ts';

export type FieldLookupResult =
	| { readonly answered: false }
	| { readonly answered: true; readonly value: unknown };

/** Tells whether a field is answered (and visible), and its value. */
export type FieldLookup = (fieldId: string) => FieldLookupResult;

export function evaluateCondition(
	condition: Condition,
	lookup: FieldLookup,
): boolean {
	if ('all' in condition) {
		return condition.all.every((c) => evaluateCondition(c, lookup));
	}
	if ('any' in condition) {
		return condition.any.some((c) => evaluateCondition(c, lookup));
	}
	if ('not' in condition) {
		return !evaluateCondition(condition.not, lookup);
	}
	return evaluateFieldCondition(condition, lookup);
}

function evaluateFieldCondition(
	condition: FieldCondition,
	lookup: FieldLookup,
): boolean {
	const result = lookup(condition.field);
	if (condition.op === 'answered') return result.answered;
	if (condition.op === 'notAnswered') return !result.answered;
	if (!result.answered) return false;

	const actual = result.value;
	switch (condition.op) {
		case 'eq':
			return actual === condition.value;
		case 'neq':
			return actual !== condition.value;
		case 'gt':
			return typeof actual === 'number' && actual > condition.value;
		case 'gte':
			return typeof actual === 'number' && actual >= condition.value;
		case 'lt':
			return typeof actual === 'number' && actual < condition.value;
		case 'lte':
			return typeof actual === 'number' && actual <= condition.value;
		case 'in':
			return isScalar(actual) && condition.value.includes(actual);
		case 'notIn':
			return isScalar(actual) && !condition.value.includes(actual);
		case 'includes':
			return Array.isArray(actual) && actual.includes(condition.value);
		default:
			return false;
	}
}

function isScalar(value: unknown): value is string | number | boolean {
	return (
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	);
}
