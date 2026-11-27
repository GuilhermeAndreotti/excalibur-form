/**
 * Limits applied to schemas and answers. Schemas usually come from users
 * (stored in a database), so everything is capped to prevent abuse.
 */
export interface SchemaLimits {
	/** Maximum number of fields in a form. */
	readonly maxFields: number;
	/** Maximum number of options in `choice` / `multiChoice`. */
	readonly maxOptions: number;
	/** Maximum length of labels, descriptions and placeholders. */
	readonly maxTextLength: number;
	/** Maximum number of languages in a `LocalizedText`. */
	readonly maxLocales: number;
	/** Maximum nesting depth in `showIf`. */
	readonly maxConditionDepth: number;
	/** Maximum number of nodes (groups + comparisons) in a `showIf`. */
	readonly maxConditionNodes: number;
	/** Maximum characters in a `text` answer. */
	readonly maxTextAnswerLength: number;
	/** Maximum characters in a `longText` answer. */
	readonly maxLongTextAnswerLength: number;
	/** Maximum steps in a `scale` (`max - min`). */
	readonly maxScaleSteps: number;
}

export const DEFAULT_LIMITS: Readonly<SchemaLimits> = Object.freeze({
	maxFields: 500,
	maxOptions: 200,
	maxTextLength: 2000,
	maxLocales: 20,
	maxConditionDepth: 8,
	maxConditionNodes: 64,
	maxTextAnswerLength: 10_000,
	maxLongTextAnswerLength: 100_000,
	maxScaleSteps: 100,
});
