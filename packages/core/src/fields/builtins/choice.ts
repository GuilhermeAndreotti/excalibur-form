import type { DisplayContext } from '../../export/display.ts';
import { stripUndefined } from '../../internal/guards.ts';
import type {
	ChoiceField,
	ChoiceOption,
	MultiChoiceField,
} from '../../schema/types.ts';
import { accept, reject } from '../../validation/errors.ts';
import { isNullish, type FieldTypeDefinition } from '../definition.ts';

function optionLabel(
	options: readonly ChoiceOption[],
	id: string,
	context: DisplayContext,
): string {
	const option = options.find((o) => o.id === id);
	return option === undefined ? id : context.text(option.label);
}

function hasOption(options: readonly ChoiceOption[], id: unknown): boolean {
	return typeof id === 'string' && options.some((option) => option.id === id);
}

export const choiceFieldType: FieldTypeDefinition<ChoiceField, string> = {
	type: 'choice',
	answerable: true,
	conditionOps: ['eq', 'neq', 'in', 'notIn', 'answered', 'notAnswered'],
	parseConfig(reader) {
		return { options: reader.options('options') ?? [] };
	},
	isEmpty: (value) => isNullish(value) || value === '',
	validate(value, field) {
		if (typeof value !== 'string') return reject('invalid_type');
		if (!hasOption(field.options, value)) {
			return reject('invalid_option', { option: value });
		}
		return accept(value);
	},
	isValidConditionValue: (field, value) => hasOption(field.options, value),
	toDisplay: (value, field, context) =>
		optionLabel(field.options, value, context),
};

export const multiChoiceFieldType: FieldTypeDefinition<
	MultiChoiceField,
	string[]
> = {
	type: 'multiChoice',
	answerable: true,
	conditionOps: ['includes', 'answered', 'notAnswered'],
	parseConfig(reader) {
		const options = reader.options('options') ?? [];
		const ceiling = Math.max(options.length, 1);
		const minSelected = reader.number('minSelected', {
			integer: true,
			min: 0,
			max: ceiling,
		});
		const maxSelected = reader.number('maxSelected', {
			integer: true,
			min: 1,
			max: ceiling,
		});
		if (
			minSelected !== undefined &&
			maxSelected !== undefined &&
			minSelected > maxSelected
		) {
			reader.issue(
				'minSelected',
				'invalid_value',
				'minSelected > maxSelected',
			);
		}
		return stripUndefined({ options, minSelected, maxSelected });
	},
	isEmpty: (value) =>
		isNullish(value) || (Array.isArray(value) && value.length === 0),
	validate(value, field) {
		if (!Array.isArray(value)) return reject('invalid_type');
		const seen = new Set<string>();
		for (const item of value as unknown[]) {
			if (typeof item !== 'string') return reject('invalid_type');
			if (!hasOption(field.options, item)) {
				return reject('invalid_option', { option: item });
			}
			if (seen.has(item))
				return reject('duplicate_option', { option: item });
			seen.add(item);
		}
		if (field.minSelected !== undefined && seen.size < field.minSelected) {
			return reject('too_few', { min: field.minSelected });
		}
		if (field.maxSelected !== undefined && seen.size > field.maxSelected) {
			return reject('too_many', { max: field.maxSelected });
		}
		return accept([...seen]);
	},
	isValidConditionValue: (field, value) => hasOption(field.options, value),
	toDisplay: (value, field, context) =>
		value
			.map((id) => optionLabel(field.options, id, context))
			.join(context.labels.listSeparator),
};
