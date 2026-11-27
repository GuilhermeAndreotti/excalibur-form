import { parseCondition, type ReferencedField } from '../conditions/parse.ts';
import { defaultRegistry, type FieldRegistry } from '../fields/registry.ts';
import {
	deepFreeze,
	isRecord,
	ownValue,
	stripUndefined,
} from '../internal/guards.ts';
import type { SchemaIssue } from './issues.ts';
import { DEFAULT_LIMITS, type SchemaLimits } from './limits.ts';
import { createReader } from './reader.ts';
import type { FieldBase, FormSchema } from './types.ts';

export interface ParseOptions {
	/** Accepted field types. Default: the built-ins. */
	readonly registry?: FieldRegistry;
	readonly limits?: Partial<SchemaLimits>;
}

export type ParseResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly issues: readonly SchemaIssue[] };

export function resolveLimits(
	options: ParseOptions = {},
): Readonly<SchemaLimits> {
	return { ...DEFAULT_LIMITS, ...options.limits };
}

/**
 * Validates a schema from outside (database, API, builder) and returns a
 * clean, frozen copy. Unknown properties are dropped.
 */
export function parseSchema(
	raw: unknown,
	options: ParseOptions = {},
): ParseResult<FormSchema> {
	const registry = options.registry ?? defaultRegistry;
	const limits = resolveLimits(options);
	const issues: SchemaIssue[] = [];
	const fail = () => ({ ok: false, issues }) as const;

	if (!isRecord(raw)) {
		issues.push({
			path: [],
			code: 'invalid_type',
			message: 'schema must be an object',
		});
		return fail();
	}
	const root = createReader(raw, [], limits, issues);
	const id = root.id('id');
	if (ownValue(raw, 'id') === undefined)
		root.issue('id', 'required', '"id" is required');
	const version = root.number('version', { integer: true, min: 1 });
	if (ownValue(raw, 'version') === undefined) {
		root.issue('version', 'required', '"version" is required');
	}
	const title = root.text('title');
	const description = root.text('description');

	const rawFields = ownValue(raw, 'fields');
	if (!Array.isArray(rawFields)) {
		root.issue('fields', 'invalid_type', '"fields" must be an array');
		return fail();
	}
	if (rawFields.length > limits.maxFields) {
		root.issue(
			'fields',
			'too_many',
			`more than ${limits.maxFields} fields`,
		);
		return fail();
	}

	// First pass: id positions, to tell "doesn't exist" from "comes later".
	const indexById = new Map<string, number>();
	rawFields.forEach((item: unknown, index) => {
		const fieldId = isRecord(item) ? ownValue(item, 'id') : undefined;
		if (typeof fieldId === 'string' && !indexById.has(fieldId)) {
			indexById.set(fieldId, index);
		}
	});

	const parsedById = new Map<string, ReferencedField>();
	const seenKeys = new Set<string>();
	const fields: FieldBase[] = [];

	rawFields.forEach((item: unknown, index) => {
		const path = ['fields', index] as const;
		if (!isRecord(item)) {
			issues.push({
				path,
				code: 'invalid_type',
				message: 'field must be an object',
			});
			return;
		}
		const before = issues.length;
		const reader = createReader(item, path, limits, issues);

		const fieldId = reader.id('id');
		if (ownValue(item, 'id') === undefined)
			reader.issue('id', 'required', '"id" is required');
		const duplicateId =
			fieldId !== undefined && indexById.get(fieldId) !== index;
		if (duplicateId) {
			reader.issue(
				'id',
				'duplicate_id',
				`duplicate field id "${fieldId}"`,
			);
		}

		const type = ownValue(item, 'type');
		const definition =
			typeof type === 'string' ? registry.get(type) : undefined;
		if (definition === undefined) {
			reader.issue(
				'type',
				'unknown_field_type',
				`unknown field type "${String(type)}" (available: ${registry.types.join(', ')})`,
			);
			return;
		}

		const label = reader.requiredText('label');
		const fieldDescription = reader.text('description');
		const required = reader.boolean('required');
		const key = reader.id('key');

		if (!definition.answerable) {
			if (required === true) {
				reader.issue(
					'required',
					'invalid_value',
					`"${definition.type}" fields have no answer`,
				);
			}
			if (key !== undefined) {
				reader.issue(
					'key',
					'invalid_value',
					`"${definition.type}" fields have no answer`,
				);
			}
		} else {
			// With a duplicate id, the default key would clash too: one error is enough.
			const exportKey = key ?? (duplicateId ? undefined : fieldId);
			if (exportKey !== undefined) {
				if (seenKeys.has(exportKey)) {
					reader.issue(
						key === undefined ? 'id' : 'key',
						'duplicate_key',
						`export key "${exportKey}" is used by another field`,
					);
				}
				seenKeys.add(exportKey);
			}
		}

		const config = definition.parseConfig(reader);

		const rawShowIf = ownValue(item, 'showIf');
		const showIf =
			rawShowIf === undefined
				? undefined
				: parseCondition(rawShowIf, [...path, 'showIf'], {
						ownerIndex: index,
						limits,
						issues,
						lookup: (refId) => {
							const refIndex = indexById.get(refId);
							if (refIndex === undefined) return undefined;
							return parsedById.get(refId) ?? { index: refIndex };
						},
					});

		if (
			issues.length !== before ||
			fieldId === undefined ||
			label === undefined
		)
			return;

		const field = stripUndefined({
			...config,
			id: fieldId,
			key,
			type: definition.type,
			label,
			description: fieldDescription,
			required: definition.answerable ? required : undefined,
			showIf,
		}) as FieldBase;
		fields.push(field);
		parsedById.set(fieldId, { index, field, definition });
	});

	if (issues.length > 0 || id === undefined || version === undefined)
		return fail();

	const schema: FormSchema = stripUndefined({
		id,
		version,
		title,
		description,
		fields,
	});
	return { ok: true, value: deepFreeze(schema) };
}
