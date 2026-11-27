import type {
	AnswerInput,
	Form,
	FormSchema,
	InferAnswers,
	ValidationError,
	ValidationResult,
} from '@excalibur-form/core';
import { useCallback, useMemo, useState } from 'react';

/** When a field's errors start showing. */
export type ShowErrors =
	/** After the field loses focus, or after a submit attempt. */
	| 'touched'
	/** Only after a submit attempt. */
	| 'submit'
	/** Always, from the start. */
	| 'always';

export interface UseExcaliburFormOptions<S extends FormSchema = FormSchema> {
	/** Initial answers (e.g. a saved draft). */
	readonly initialAnswers?: AnswerInput;
	/** Called with the validated data. Can be async. */
	readonly onSubmit?: (data: InferAnswers<S>) => void | Promise<void>;
	/** Called when a submit fails validation. */
	readonly onInvalid?: (errors: readonly ValidationError[]) => void;
	/** Default: `'touched'`. */
	readonly showErrors?: ShowErrors;
}

/** Everything a component needs to render a field. */
export interface FieldState<F = FormSchema['fields'][number]> {
	readonly field: F;
	readonly visible: boolean;
	readonly value: unknown;
	readonly touched: boolean;
	/** Errors that should show right now (honors `showErrors`). */
	readonly errors: readonly ValidationError[];
	readonly invalid: boolean;
	readonly onChange: (value: unknown) => void;
	readonly onBlur: () => void;
}

export interface ExcaliburFormController<S extends FormSchema = FormSchema> {
	readonly form: Form<S>;
	/** Raw answers, including those of fields hidden right now. */
	readonly answers: AnswerInput;
	readonly setAnswer: (fieldId: string, value: unknown) => void;
	readonly setAnswers: (
		next: AnswerInput | ((previous: AnswerInput) => AnswerInput),
	) => void;
	/** Goes back to the initial state (or the given answers) and clears errors. */
	readonly reset: (answers?: AnswerInput) => void;
	readonly visibleFieldIds: ReadonlySet<string>;
	/** Result of `form.validate(answers)`, always up to date. */
	readonly result: ValidationResult<InferAnswers<S>>;
	/** Errors visible right now, by field (honors `showErrors`). */
	readonly errors: ReadonlyMap<string, readonly ValidationError[]>;
	readonly touched: ReadonlySet<string>;
	readonly touch: (fieldId: string) => void;
	/** How many submit attempts so far. */
	readonly submitCount: number;
	readonly isSubmitting: boolean;
	/** Validates and calls `onSubmit` / `onInvalid`. Works as the `<form>` `onSubmit`. */
	readonly handleSubmit: (event?: {
		preventDefault(): void;
	}) => Promise<void>;
	/** State of a field by `id`. */
	readonly fieldState: (fieldId: string) => FieldState<S['fields'][number]>;
}

const EMPTY: AnswerInput = Object.freeze({});
const NO_ERRORS: readonly ValidationError[] = Object.freeze([]);

/**
 * Form state, without rendering anything. Pass a stable `Form` (from
 * `defineForm`, or from `parseForm` inside a `useMemo`).
 */
export function useExcaliburForm<S extends FormSchema>(
	form: Form<S>,
	options: UseExcaliburFormOptions<S> = {},
): ExcaliburFormController<S> {
	const initial = options.initialAnswers ?? EMPTY;
	const [answers, setAnswersState] = useState<AnswerInput>(initial);
	const [touched, setTouched] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const [submitCount, setSubmitCount] = useState(0);
	const [isSubmitting, setSubmitting] = useState(false);

	const visibleFieldIds = useMemo(
		() => form.visibleFieldIds(answers),
		[form, answers],
	);
	const result = useMemo(() => form.validate(answers), [form, answers]);

	const showErrors = options.showErrors ?? 'touched';
	const errors = useMemo(() => {
		const byField = new Map<string, ValidationError[]>();
		if (result.ok) return byField;
		for (const error of result.errors) {
			const id = error.fieldId ?? '';
			const shown =
				showErrors === 'always' ||
				submitCount > 0 ||
				(showErrors === 'touched' && touched.has(id));
			if (!shown) continue;
			const list = byField.get(id);
			if (list === undefined) byField.set(id, [error]);
			else list.push(error);
		}
		return byField;
	}, [result, showErrors, submitCount, touched]);

	const setAnswers = useCallback(
		(next: AnswerInput | ((previous: AnswerInput) => AnswerInput)) => {
			setAnswersState((previous) =>
				typeof next === 'function' ? next(previous) : next,
			);
		},
		[],
	);

	const setAnswer = useCallback((fieldId: string, value: unknown) => {
		setAnswersState((previous) => {
			if (Object.is(previous[fieldId], value)) return previous;
			// defineProperty: an id like "constructor" becomes an own key.
			const next: Record<string, unknown> = { ...previous };
			Object.defineProperty(next, fieldId, {
				value,
				enumerable: true,
				writable: true,
				configurable: true,
			});
			return next;
		});
	}, []);

	const touch = useCallback((fieldId: string) => {
		setTouched((previous) =>
			previous.has(fieldId) ? previous : new Set(previous).add(fieldId),
		);
	}, []);

	const reset = (next?: AnswerInput) => {
		setAnswersState(next ?? initial);
		setTouched(new Set());
		setSubmitCount(0);
	};

	const handleSubmit = async (event?: { preventDefault(): void }) => {
		event?.preventDefault();
		setSubmitCount((count) => count + 1);
		if (!result.ok) {
			options.onInvalid?.(result.errors);
			return;
		}
		if (options.onSubmit === undefined) return;
		setSubmitting(true);
		try {
			await options.onSubmit(result.data);
		} finally {
			setSubmitting(false);
		}
	};

	const fieldState = (fieldId: string): FieldState<S['fields'][number]> => {
		const fieldErrors = errors.get(fieldId) ?? NO_ERRORS;
		return {
			field: form.field(fieldId) as S['fields'][number],
			visible: visibleFieldIds.has(fieldId),
			value: Object.hasOwn(answers, fieldId)
				? answers[fieldId]
				: undefined,
			touched: touched.has(fieldId),
			errors: fieldErrors,
			invalid: fieldErrors.length > 0,
			onChange: (value) => setAnswer(fieldId, value),
			onBlur: () => touch(fieldId),
		};
	};

	return {
		form,
		answers,
		setAnswer,
		setAnswers,
		reset,
		visibleFieldIds,
		result,
		errors,
		touched,
		touch,
		submitCount,
		isSubmitting,
		handleSubmit,
		fieldState,
	};
}
