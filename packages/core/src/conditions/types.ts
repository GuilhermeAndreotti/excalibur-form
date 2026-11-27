export type ComparableValue = string | number | boolean;

export type EqualityOperator = 'eq' | 'neq';
export type NumericOperator = 'gt' | 'gte' | 'lt' | 'lte';
export type MembershipOperator = 'in' | 'notIn';
export type PresenceOperator = 'answered' | 'notAnswered';
export type IncludesOperator = 'includes';

export type ConditionOperator =
	| EqualityOperator
	| NumericOperator
	| MembershipOperator
	| PresenceOperator
	| IncludesOperator;

export interface AllCondition {
	readonly all: readonly Condition[];
}
export interface AnyCondition {
	readonly any: readonly Condition[];
}
export interface NotCondition {
	readonly not: Condition;
}
export interface EqualityCondition {
	readonly field: string;
	readonly op: EqualityOperator;
	readonly value: ComparableValue;
}
export interface NumericCondition {
	readonly field: string;
	readonly op: NumericOperator;
	readonly value: number;
}
export interface MembershipCondition {
	readonly field: string;
	readonly op: MembershipOperator;
	readonly value: readonly ComparableValue[];
}
export interface IncludesCondition {
	readonly field: string;
	readonly op: IncludesOperator;
	readonly value: string;
}
export interface PresenceCondition {
	readonly field: string;
	readonly op: PresenceOperator;
}

export type FieldCondition =
	| EqualityCondition
	| NumericCondition
	| MembershipCondition
	| IncludesCondition
	| PresenceCondition;

/**
 * Condition as plain JSON (never `eval`). Comparisons only match answered,
 * visible fields; to include empty ones, use `notAnswered` inside `any`.
 */
export type Condition =
	| AllCondition
	| AnyCondition
	| NotCondition
	| FieldCondition;

export const EQUALITY_OPERATORS: readonly EqualityOperator[] = ['eq', 'neq'];
export const NUMERIC_OPERATORS: readonly NumericOperator[] = [
	'gt',
	'gte',
	'lt',
	'lte',
];
export const MEMBERSHIP_OPERATORS: readonly MembershipOperator[] = [
	'in',
	'notIn',
];
export const PRESENCE_OPERATORS: readonly PresenceOperator[] = [
	'answered',
	'notAnswered',
];
export const ALL_OPERATORS: readonly ConditionOperator[] = [
	...EQUALITY_OPERATORS,
	...NUMERIC_OPERATORS,
	...MEMBERSHIP_OPERATORS,
	...PRESENCE_OPERATORS,
	'includes',
];
