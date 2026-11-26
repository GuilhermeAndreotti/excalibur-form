import type { ConditionOperator } from '../conditions/types.ts';
import type { SchemaLimits } from '../schema/limits.ts';
import type { ConfigReader } from '../schema/reader.ts';
import type { FieldBase } from '../schema/types.ts';
import type { AnswerCheck } from '../validation/errors.ts';

/**
 * Tudo que a lib precisa saber sobre um tipo de campo. Os tipos nativos são
 * definidos com esta mesma interface, e tipos customizados também.
 */
export interface FieldTypeDefinition<
	F extends FieldBase = FieldBase,
	A = unknown,
> {
	readonly type: F['type'];
	/** `false` pra blocos sem resposta (ex.: `section`). */
	readonly answerable: boolean;
	/** Operadores que outras condições podem usar referenciando este campo. */
	readonly conditionOps: readonly ConditionOperator[];
	/**
	 * Valida e limpa as propriedades específicas do tipo (as comuns, como
	 * `id`, `label` e `showIf`, a lib já trata). Problemas vão pro `reader`.
	 */
	parseConfig(reader: ConfigReader): Omit<F, keyof FieldBase>;
	/** Resposta conta como "não respondida"? Padrão sugerido: null/undefined. */
	isEmpty(value: unknown): boolean;
	/** Valida uma resposta não vazia e devolve o valor normalizado. */
	validate(
		value: unknown,
		field: F,
		context: ValidationContext,
	): AnswerCheck<A>;
	/** Valida o `value` de uma condição que referencia este campo. */
	isValidConditionValue?(field: F, value: unknown): boolean;
}

export interface ValidationContext {
	readonly limits: Readonly<SchemaLimits>;
}

/** Ajuda a tipar um tipo de campo customizado. */
export function defineFieldType<F extends FieldBase, A>(
	definition: FieldTypeDefinition<F, A>,
): FieldTypeDefinition<F, A> {
	return definition;
}

export function isNullish(value: unknown): boolean {
	return value === undefined || value === null;
}
