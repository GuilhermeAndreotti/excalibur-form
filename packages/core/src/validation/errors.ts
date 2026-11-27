export type ValidationCode =
	| 'required'
	| 'invalid_type'
	| 'too_short'
	| 'too_long'
	| 'too_small'
	| 'too_big'
	| 'not_integer'
	| 'invalid_format'
	| 'invalid_option'
	| 'duplicate_option'
	| 'too_few'
	| 'too_many';

export type ValidationParams = Readonly<Record<string, string | number>>;

/** Problem with an answer. Only the code comes back: each app translates it. */
export interface AnswerIssue {
	readonly code: ValidationCode;
	readonly params?: ValidationParams;
}

export interface ValidationError extends AnswerIssue {
	/** `null` when the problem is with the answers object as a whole. */
	readonly fieldId: string | null;
}

export type AnswerCheck<A> =
	| { readonly ok: true; readonly value: A }
	| { readonly ok: false; readonly issues: readonly AnswerIssue[] };

export type ValidationResult<T> =
	| { readonly ok: true; readonly data: T }
	| { readonly ok: false; readonly errors: readonly ValidationError[] };

export function accept<A>(value: A): AnswerCheck<A> {
	return { ok: true, value };
}

export function reject(
	code: ValidationCode,
	params?: ValidationParams,
): AnswerCheck<never> {
	return {
		ok: false,
		issues: [params === undefined ? { code } : { code, params }],
	};
}
