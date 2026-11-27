import type { ConditionOperator } from '../conditions/types.ts';
import type { DisplayContext } from '../export/display.ts';
import type { SchemaLimits } from '../schema/limits.ts';
import type { ConfigReader } from '../schema/reader.ts';
import type { FieldBase } from '../schema/types.ts';
import type { AnswerCheck } from '../validation/errors.ts';

/**
 * Everything the library needs to know about a field type. Built-in types
 * use this same interface, and so do custom types.
 */
export interface FieldTypeDefinition<
	F extends FieldBase = FieldBase,
	A = unknown,
> {
	readonly type: F['type'];
	/** `false` for blocks without an answer (e.g. `section`). */
	readonly answerable: boolean;
	/** Operators other conditions can use when referencing this field. */
	readonly conditionOps: readonly ConditionOperator[];
	/**
	 * Validates and cleans the type-specific properties (the library already
	 * handles common ones like `id`, `label` and `showIf`). Report problems
	 * through the `reader`.
	 */
	parseConfig(reader: ConfigReader): Omit<F, keyof FieldBase>;
	/** Does the answer count as "unanswered"? Suggested default: null/undefined. */
	isEmpty(value: unknown): boolean;
	/** Validates a non-empty answer and returns the normalized value. */
	validate(
		value: unknown,
		field: F,
		context: ValidationContext,
	): AnswerCheck<A>;
	/** Validates the `value` of a condition that references this field. */
	isValidConditionValue?(field: F, value: unknown): boolean;
	/**
	 * Readable text for a valid answer, used by the exporters (qa-list, CSV,
	 * Markdown). Without it, the library converts the value generically.
	 */
	toDisplay?(value: A, field: F, context: DisplayContext): string;
}

export interface ValidationContext {
	readonly limits: Readonly<SchemaLimits>;
}

/** Helps type a custom field type. */
export function defineFieldType<F extends FieldBase, A>(
	definition: FieldTypeDefinition<F, A>,
): FieldTypeDefinition<F, A> {
	return definition;
}

export function isNullish(value: unknown): boolean {
	return value === undefined || value === null;
}
