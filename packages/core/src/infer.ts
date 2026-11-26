import type { FormSchema } from './schema/types.ts';

type OptionIds<F> = F extends { readonly options: readonly (infer O)[] }
	? O extends { readonly id: infer I extends string }
		? I
		: never
	: never;

/** Tipo da resposta de um campo, a partir da definição dele. */
export type AnswerOf<F> = F extends { readonly type: 'text' | 'longText' }
	? string
	: F extends { readonly type: 'number' | 'scale' }
		? number
		: F extends { readonly type: 'boolean' }
			? boolean
			: F extends { readonly type: 'choice' }
				? OptionIds<F>
				: F extends { readonly type: 'multiChoice' }
					? OptionIds<F>[]
					: unknown;

type AnswerFields<S extends FormSchema> = Exclude<
	S['fields'][number],
	{ readonly type: 'section' }
>;

/** Obrigatório e sem `showIf` = sempre presente quando a validação passa. */
type AlwaysPresent<F> = F extends { readonly required: true }
	? F extends { readonly showIf: object }
		? false
		: true
	: false;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * Tipo das respostas válidas de um form, indexadas pelo `id` de cada campo.
 *
 * ```ts
 * const form = defineForm({ ... });
 * type Answers = InferAnswers<typeof form.schema>;
 * ```
 */
export type InferAnswers<S extends FormSchema> = Simplify<
	{
		[
			F in AnswerFields<S> as AlwaysPresent<F> extends true
				? F['id']
				: never
		]: AnswerOf<F>;
	} & {
		[
			F in AnswerFields<S> as AlwaysPresent<F> extends true
				? never
				: F['id']
		]?: AnswerOf<F>;
	}
>;
