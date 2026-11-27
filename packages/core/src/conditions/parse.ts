import type { FieldTypeDefinition } from '../fields/definition.ts';
import { isRecord, ownValue } from '../internal/guards.ts';
import type { PathSegment, SchemaIssue } from '../schema/issues.ts';
import type { SchemaLimits } from '../schema/limits.ts';
import type { FieldBase } from '../schema/types.ts';
import {
	ALL_OPERATORS,
	EQUALITY_OPERATORS,
	MEMBERSHIP_OPERATORS,
	NUMERIC_OPERATORS,
	PRESENCE_OPERATORS,
	type ComparableValue,
	type Condition,
	type ConditionOperator,
} from './types.ts';

export interface ReferencedField {
	readonly index: number;
	/** Missing when the field exists but has a schema error. */
	readonly field?: FieldBase;
	readonly definition?: FieldTypeDefinition;
}

export interface ConditionParseContext {
	/** Index of the field that owns the `showIf`. Only earlier fields can be referenced. */
	readonly ownerIndex: number;
	readonly lookup: (fieldId: string) => ReferencedField | undefined;
	readonly limits: Readonly<SchemaLimits>;
	readonly issues: SchemaIssue[];
}

const GROUP_KEYS = ['all', 'any', 'not'] as const;

export function parseCondition(
	raw: unknown,
	path: readonly PathSegment[],
	context: ConditionParseContext,
): Condition | undefined {
	const state = { nodes: 0, tooBig: false };
	const before = context.issues.length;
	const condition = parseNode(raw, path, 1, context, state);
	return context.issues.length === before ? condition : undefined;
}

function parseNode(
	raw: unknown,
	path: readonly PathSegment[],
	depth: number,
	context: ConditionParseContext,
	state: { nodes: number; tooBig: boolean },
): Condition | undefined {
	const fail = (
		message: string,
		code: SchemaIssue['code'] = 'invalid_condition',
	) => {
		context.issues.push({ path, code, message });
		return undefined;
	};

	state.nodes += 1;
	if (state.nodes > context.limits.maxConditionNodes) {
		if (state.tooBig) return undefined;
		state.tooBig = true;
		return fail(
			`condition has more than ${context.limits.maxConditionNodes} nodes`,
			'too_many',
		);
	}
	if (depth > context.limits.maxConditionDepth) {
		return fail(
			`condition nested deeper than ${context.limits.maxConditionDepth} levels`,
			'too_many',
		);
	}
	if (!isRecord(raw)) return fail('condition must be an object');

	const groupKeys = GROUP_KEYS.filter(
		(key) => ownValue(raw, key) !== undefined,
	);
	if (groupKeys.length > 1) {
		return fail(`use only one of ${GROUP_KEYS.join(' / ')} per condition`);
	}
	const groupKey = groupKeys[0];
	if (groupKey === 'not') {
		const inner = parseNode(
			raw.not,
			[...path, 'not'],
			depth + 1,
			context,
			state,
		);
		return inner && { not: inner };
	}
	if (groupKey !== undefined) {
		const list = raw[groupKey];
		if (!Array.isArray(list) || list.length === 0) {
			return fail(`"${groupKey}" must be a non-empty array`);
		}
		const children: Condition[] = [];
		list.forEach((child: unknown, i) => {
			const parsed = parseNode(
				child,
				[...path, groupKey, i],
				depth + 1,
				context,
				state,
			);
			if (parsed) children.push(parsed);
		});
		if (children.length !== list.length) return undefined;
		return groupKey === 'all' ? { all: children } : { any: children };
	}
	return parseLeaf(raw, path, context);
}

function parseLeaf(
	raw: Record<string, unknown>,
	path: readonly PathSegment[],
	context: ConditionParseContext,
): Condition | undefined {
	const issue = (
		key: string | null,
		code: SchemaIssue['code'],
		message: string,
	) => {
		context.issues.push({
			path: key === null ? path : [...path, key],
			code,
			message,
		});
		return undefined;
	};

	const fieldId = ownValue(raw, 'field');
	const op = ownValue(raw, 'op');
	if (typeof fieldId !== 'string') {
		return issue(
			null,
			'invalid_condition',
			'condition needs "field" + "op", or one of all / any / not',
		);
	}
	if (
		typeof op !== 'string' ||
		!ALL_OPERATORS.includes(op as ConditionOperator)
	) {
		return issue(
			'op',
			'unsupported_operator',
			`unknown operator "${String(op)}"`,
		);
	}
	const operator = op as ConditionOperator;

	const ref = context.lookup(fieldId);
	if (ref === undefined) {
		return issue(
			'field',
			'unknown_reference',
			`field "${fieldId}" does not exist`,
		);
	}
	if (ref.index >= context.ownerIndex) {
		return issue(
			'field',
			'forward_reference',
			`field "${fieldId}" must come before the field that depends on it`,
		);
	}
	// Referenced field has a schema error: that problem was already reported there.
	if (ref.field === undefined || ref.definition === undefined)
		return undefined;
	const { field, definition } = ref;
	if (!definition.answerable) {
		return issue(
			'field',
			'invalid_condition',
			`"${fieldId}" has no answer to compare`,
		);
	}
	if (!definition.conditionOps.includes(operator)) {
		return issue(
			'op',
			'unsupported_operator',
			`"${operator}" is not supported by "${definition.type}" fields (use: ${definition.conditionOps.join(', ')})`,
		);
	}

	if ((PRESENCE_OPERATORS as readonly string[]).includes(operator)) {
		return { field: fieldId, op: operator as 'answered' | 'notAnswered' };
	}

	const value = ownValue(raw, 'value');
	const fitsField = (v: unknown) =>
		definition.isValidConditionValue?.(field, v) ?? true;
	const badValue = () =>
		issue(
			'value',
			'invalid_value',
			`invalid value for "${operator}" on "${fieldId}"`,
		);

	if ((MEMBERSHIP_OPERATORS as readonly string[]).includes(operator)) {
		if (
			!Array.isArray(value) ||
			value.length === 0 ||
			value.length > context.limits.maxOptions ||
			!value.every((v: unknown) => isComparable(v) && fitsField(v))
		) {
			return badValue();
		}
		return {
			field: fieldId,
			op: operator as 'in' | 'notIn',
			value: [...(value as ComparableValue[])],
		};
	}
	if ((NUMERIC_OPERATORS as readonly string[]).includes(operator)) {
		if (
			typeof value !== 'number' ||
			!Number.isFinite(value) ||
			!fitsField(value)
		) {
			return badValue();
		}
		return {
			field: fieldId,
			op: operator as 'gt' | 'gte' | 'lt' | 'lte',
			value,
		};
	}
	if ((EQUALITY_OPERATORS as readonly string[]).includes(operator)) {
		if (!isComparable(value) || !fitsField(value)) return badValue();
		return { field: fieldId, op: operator as 'eq' | 'neq', value };
	}
	// includes
	if (typeof value !== 'string' || !fitsField(value)) return badValue();
	return { field: fieldId, op: 'includes', value };
}

function isComparable(value: unknown): value is ComparableValue {
	return (
		typeof value === 'string' ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isFinite(value))
	);
}
