import { evaluateCondition } from './conditions/evaluate.ts';
import type { FieldTypeDefinition } from './fields/definition.ts';
import { defaultRegistry, type FieldRegistry } from './fields/registry.ts';
import type { InferAnswers } from './infer.ts';
import { hasOwn, isRecord } from './internal/guards.ts';
import { FormSchemaError } from './schema/issues.ts';
import type { SchemaLimits } from './schema/limits.ts';
import {
	parseSchema,
	resolveLimits,
	type ParseOptions,
	type ParseResult,
} from './schema/parse.ts';
import type { BuiltinField, FieldBase, FormSchema } from './schema/types.ts';
import type { ValidationError, ValidationResult } from './validation/errors.ts';

/** Respostas ainda não validadas, indexadas pelo `id` do campo. */
export type AnswerInput = Readonly<Record<string, unknown>>;

export interface Form<S extends FormSchema = FormSchema> {
	readonly schema: S;
	readonly limits: Readonly<SchemaLimits>;
	/** Registry de tipos usado no parse (os exporters usam o `toDisplay`). */
	readonly registry: FieldRegistry;
	/** Campo pelo `id`. */
	field(id: string): S['fields'][number] | undefined;
	/** Campos com resposta (sem `section`), na ordem do schema. */
	readonly answerableFields: readonly S['fields'][number][];
	/** IDs dos campos visíveis pras respostas atuais (inclui `section`). */
	visibleFieldIds(answers: AnswerInput): ReadonlySet<string>;
	/**
	 * Valida as respostas. Campos escondidos e chaves desconhecidas são
	 * descartados; `data` só tem respostas visíveis e preenchidas.
	 */
	validate(answers: unknown): ValidationResult<InferAnswers<S>>;
}

interface ResolvedField {
	readonly field: FieldBase;
	readonly definition: FieldTypeDefinition;
}

function buildForm<S extends FormSchema>(
	schema: S,
	options: ParseOptions,
): Form<S> {
	const registry = options.registry ?? defaultRegistry;
	const limits = resolveLimits(options);
	const resolved: ResolvedField[] = schema.fields.map((field) => ({
		field,
		// parseSchema já garantiu que o tipo existe neste registry.
		definition: registry.get(field.type) as FieldTypeDefinition,
	}));
	const byId = new Map(schema.fields.map((field) => [field.id, field]));

	const visibleFieldIds = (answers: AnswerInput): Set<string> => {
		const visible = new Set<string>();
		const answered = new Map<string, unknown>();
		for (const { field, definition } of resolved) {
			const shown =
				field.showIf === undefined ||
				evaluateCondition(field.showIf, (id) =>
					answered.has(id)
						? { answered: true, value: answered.get(id) }
						: { answered: false },
				);
			if (!shown) continue;
			visible.add(field.id);
			if (
				definition.answerable &&
				hasOwn(answers, field.id) &&
				!definition.isEmpty(answers[field.id])
			) {
				answered.set(field.id, answers[field.id]);
			}
		}
		return visible;
	};

	return Object.freeze({
		schema,
		limits,
		registry,
		field: (id: string) => byId.get(id),
		answerableFields: Object.freeze(
			resolved.filter((r) => r.definition.answerable).map((r) => r.field),
		),
		visibleFieldIds,
		validate(input: unknown): ValidationResult<InferAnswers<S>> {
			if (!isRecord(input)) {
				return {
					ok: false,
					errors: [{ fieldId: null, code: 'invalid_type' }],
				};
			}
			const visible = visibleFieldIds(input);
			const errors: ValidationError[] = [];
			const data: Record<string, unknown> = {};
			for (const { field, definition } of resolved) {
				if (!definition.answerable || !visible.has(field.id)) continue;
				const value = hasOwn(input, field.id)
					? input[field.id]
					: undefined;
				if (definition.isEmpty(value)) {
					if (field.required === true) {
						errors.push({ fieldId: field.id, code: 'required' });
					}
					continue;
				}
				const check = definition.validate(value, field, { limits });
				if (check.ok) {
					data[field.id] = check.value;
				} else {
					for (const issue of check.issues) {
						errors.push({ fieldId: field.id, ...issue });
					}
				}
			}
			return errors.length > 0
				? { ok: false, errors }
				: { ok: true, data: data as InferAnswers<S> };
		},
	}) as Form<S>;
}

/**
 * Define um form em código, com tipos inferidos. Valida o schema na hora e
 * lança `FormSchemaError` se estiver inválido.
 */
export function defineForm<const S extends FormSchema<BuiltinField>>(
	schema: S,
	options: ParseOptions = {},
): Form<S> {
	const parsed = parseSchema(schema, options);
	if (!parsed.ok) throw new FormSchemaError(parsed.issues);
	return buildForm(parsed.value as unknown as S, options);
}

/** Monta um form a partir de um schema não confiável (banco, API, builder). */
export function parseForm(
	raw: unknown,
	options: ParseOptions = {},
): ParseResult<Form> {
	const parsed = parseSchema(raw, options);
	if (!parsed.ok) return parsed;
	return { ok: true, value: buildForm(parsed.value, options) };
}
