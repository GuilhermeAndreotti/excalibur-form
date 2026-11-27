import { booleanFieldType, sectionFieldType } from './builtins/boolean.ts';
import { choiceFieldType, multiChoiceFieldType } from './builtins/choice.ts';
import { numberFieldType, scaleFieldType } from './builtins/number.ts';
import { longTextFieldType, textFieldType } from './builtins/text.ts';
import type { FieldTypeDefinition } from './definition.ts';

export interface FieldRegistry {
	get(type: string): FieldTypeDefinition | undefined;
	readonly types: readonly string[];
}

export const builtinFieldTypes: readonly FieldTypeDefinition[] = [
	textFieldType,
	longTextFieldType,
	numberFieldType,
	booleanFieldType,
	choiceFieldType,
	multiChoiceFieldType,
	scaleFieldType,
	sectionFieldType,
];

/**
 * Creates a registry with the given types. To extend the built-ins:
 * `createRegistry([...builtinFieldTypes, myType])`.
 */
export function createRegistry(
	definitions: readonly FieldTypeDefinition[],
): FieldRegistry {
	const byType = new Map<string, FieldTypeDefinition>();
	for (const definition of definitions) {
		if (byType.has(definition.type)) {
			throw new Error(`Field type "${definition.type}" registered twice`);
		}
		byType.set(definition.type, definition);
	}
	return Object.freeze({
		get: (type: string) => byType.get(type),
		types: Object.freeze([...byType.keys()]),
	});
}

export const defaultRegistry: FieldRegistry = createRegistry(builtinFieldTypes);
